#!/usr/bin/env bun
// What the pre-push hook checks. Git feeds it one line per ref being pushed on stdin:
//   <local ref> <local sha> <remote ref> <remote sha>
// For each pushed commit it runs the rules and the ratchet against that commit's own
// files (--rev), not the working tree, so a violation cannot be fixed only on disk and
// still be pushed. Typecheck, oxlint and the tests run on the working tree in the shell hook.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { packageRoot } from "./scan";

const root = packageRoot();
const remote = process.argv[2] || "origin";
const ZERO = /^0+$/;

const git = (args: string[]) => {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
};

/** The commit to compare a push against: what the remote has, else the merge-base with its default branch, else none. */
export function baseFor(remoteSha: string, localSha: string): string | null {
  if (!ZERO.test(remoteSha) && git(["cat-file", "-e", `${remoteSha}^{commit}`]) !== null) return remoteSha;
  const head = git(["symbolic-ref", "--short", `refs/remotes/${remote}/HEAD`]) ?? `${remote}/main`;
  return git(["merge-base", localSha, head]) || null;
}

const input = await Bun.stdin.text();
const lines = input.split("\n").map((l) => l.trim()).filter(Boolean);
let failed = false;
let checked = 0;
for (const line of lines) {
  const [localRef, localSha, , remoteSha = "0"] = line.split(/\s+/);
  if (!localSha || ZERO.test(localSha)) continue; // deleting a ref
  checked++;
  const base = baseFor(remoteSha, localSha);
  console.log(`pre-push: checking ${localRef} at ${localSha.slice(0, 10)}${base ? `, base ${base.slice(0, 10)}` : ", no base"}`);
  const run = spawnSync(process.execPath, [join(import.meta.dir, "run.ts"), "--rev", localSha], { cwd: root, stdio: "inherit" });
  const ratchet = spawnSync(process.execPath, [join(import.meta.dir, "ratchet.ts"), "--rev", localSha, ...(base ? ["--base", base] : [])], { cwd: root, stdio: "inherit" });
  if (run.status !== 0 || ratchet.status !== 0) failed = true;
}
if (checked === 0) console.log("pre-push: no commits to check");
process.exit(failed ? 1 : 0);
