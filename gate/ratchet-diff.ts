// Adapted from DesignAnswers Oy's token audit (MIT, same copyright holder).
// Git helpers for the ratchet. Every command runs from the package directory
// (`root`), which is the repository root in the public repo and the `oss/`
// subdirectory in the private monorepo. `--relative`, `ls-files` and `./path`
// all resolve against that directory, so the same code works in both layouts.
import { spawnSync } from "node:child_process";

export function gitOutput(root: string, args: string[]): string {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(`ratchet cannot read Git state: ${result.stderr?.trim() || result.error?.message || "git failed"}`);
  }
  return result.stdout;
}

function tryGit(root: string, args: string[]): string | null {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) return null;
  const out = result.stdout.trim();
  return out === "" ? null : out;
}

export type Base = {
  sha: string;
  /** Which rule in the resolution order chose this base. */
  source: string;
};

const ZERO = /^0+$/;

function verify(root: string, ref: string): string {
  return gitOutput(root, ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`]).trim();
}

/**
 * Pick the commit to compare against, in this order:
 *   --base=<ref>, env GATE_BASE, merge-base with @{upstream}, merge-base with origin/main.
 * Returns null when none resolves: the caller then runs the full scan in blocking mode.
 * An explicit --base or a non-empty GATE_BASE that cannot be resolved is an error, never a fallback.
 * An empty or all-zero GATE_BASE (what a first push reports) counts as unset.
 * `rev` is the commit being checked (HEAD by default). On CI, a merge-base equal to `rev`
 * means nothing is left to compare, so it also returns null.
 */
export function resolveBase(
  root: string,
  baseArg: string | undefined,
  env: Record<string, string | undefined>,
  rev = "HEAD",
): Base | null {
  if (baseArg !== undefined) {
    if (baseArg === "") throw new Error("ratchet: --base requires a Git commit or ref");
    return { sha: verify(root, baseArg), source: `--base=${baseArg}` };
  }
  const fromEnv = env.GATE_BASE?.trim();
  if (fromEnv && !ZERO.test(fromEnv)) return { sha: verify(root, fromEnv), source: `GATE_BASE=${fromEnv.slice(0, 12)}` };
  const head = verify(root, rev);
  const upstream = tryGit(root, ["merge-base", rev, "@{upstream}"]);
  const origin = upstream ? null : tryGit(root, ["merge-base", rev, "origin/main"]);
  const sha = upstream ?? origin;
  if (!sha) return null;
  if (sha === head && env.CI) return null;
  return { sha, source: upstream ? "merge-base with @{upstream}" : "merge-base with origin/main" };
}

/**
 * Files changed since `base`, with the path each had at `base` (differs after a
 * rename; null when new). Without `rev` this compares the working tree (staged or
 * not) and adds untracked files. With `rev` it compares the two commits only.
 * Paths are relative to `root`.
 */
export function changedFiles(root: string, base: string, rev?: string): Map<string, string | null> {
  const entries = gitOutput(root, [
    "diff", "--relative", "--name-status", "-z", "--find-renames", "--diff-filter=ACMR", base, ...(rev ? [rev] : []), "--",
  ]).split("\0");
  const files = new Map<string, string | null>();
  for (let i = 0; i < entries.length && entries[i];) {
    const status = entries[i++]!;
    const first = entries[i++];
    if (!first) throw new Error("ratchet: invalid Git diff path");
    if (status.startsWith("R") || status.startsWith("C")) {
      const path = entries[i++];
      if (!path) throw new Error("ratchet: invalid Git rename path");
      files.set(path, status.startsWith("R") ? first : null);
    } else {
      files.set(first, status === "A" ? null : first);
    }
  }
  if (!rev) {
    for (const path of gitOutput(root, ["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean)) {
      files.set(path, null);
    }
  }
  return files;
}

/** Content of `path` (relative to `root`) at commit `base`. */
export function showAtBase(root: string, base: string, path: string): string {
  return gitOutput(root, ["show", `${base}:./${path}`]);
}

/**
 * A per-file multiset of (rule, matched token). Adding another copy of a token a
 * file already had is still new; editing other tokens on the same line is not.
 */
export function newViolations<T extends { code: string; token: string }>(current: T[], previous: T[]): T[] {
  const key = (item: T) => `${item.code}\0${item.token}`;
  const counts = new Map<string, number>();
  for (const item of previous) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return current.filter((item) => {
    const fingerprint = key(item);
    const count = counts.get(fingerprint) ?? 0;
    if (count === 0) return true;
    counts.set(fingerprint, count - 1);
    return false;
  });
}
