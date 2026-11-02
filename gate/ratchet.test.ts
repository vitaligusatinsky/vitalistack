// Adapted from DesignAnswers Oy's token audit tests (MIT, same copyright holder).
// Every test runs the real CLI in a throwaway git repository, twice: once with
// the package at the repository root (the public repo) and once with the package
// in an `oss/` subdirectory (the private monorepo).
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const cli = join(import.meta.dir, "ratchet.ts");

describe.each([
  ["package at the repository root", ""],
  ["package in an oss/ subdirectory", "oss"],
])("ratchet, %s", (_name, sub) => {
  let repo: string;
  let pkg: string;

  const git = (...args: string[]): string => {
    const r = spawnSync("git", ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", ...args], { cwd: repo, encoding: "utf8" });
    if (r.status !== 0) throw new Error(r.stderr);
    return r.stdout.trim();
  };
  /** Write a file relative to the package directory. */
  const file = (path: string, content: string) => {
    mkdirSync(dirname(join(pkg, path)), { recursive: true });
    writeFileSync(join(pkg, path), content);
  };
  const commit = (): string => {
    git("add", "-A");
    git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "-m", "fixture");
    return git("rev-parse", "HEAD");
  };
  const run = (args: string[] = [], env: Record<string, string> = {}) => {
    const clean = { ...process.env } as Record<string, string | undefined>;
    delete clean.GATE_BASE;
    return spawnSync(process.execPath, [cli, "--json", ...args], { cwd: pkg, encoding: "utf8", env: { ...clean, ...env } });
  };
  const count = (r: ReturnType<typeof run>): number => JSON.parse(r.stdout).violationCount;

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "gate-ratchet-"));
    pkg = sub ? join(repo, sub) : repo;
    git("init", "-b", "main");
    file("README.md", "fixture\n");
    if (sub) file("../sibling/README.md", "sibling\n");
    commit();
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  test("a new raw value in a changed file blocks", () => {
    file("src/routes/new.tsx", 'const style = { color: "#123456" };\n');
    const r = run();
    expect(r.status).toBe(1);
    expect(count(r)).toBe(1);
    expect(JSON.parse(r.stdout).violations[0].code).toBe("raw-color");
  });

  test("an existing violation does not block", () => {
    file("src/legacy.css", ".legacy { color: #abcdef; }\n");
    commit();
    file("src/legacy.css", "/* a comment moves the line */\n.legacy { color: #abcdef; }\n");
    const r = run();
    expect(r.status).toBe(0);
    expect(count(r)).toBe(0);
  });

  test("a second copy of the same line blocks, the original stays free", () => {
    const debt = ".legacy { color: #abcdef; }\n";
    file("src/legacy.css", debt);
    commit();
    file("src/legacy.css", debt + debt);
    const r = run();
    expect(r.status).toBe(1);
    expect(count(r)).toBe(1);
  });

  test("a staged rename keeps its debt", () => {
    file("src/old.css", ".legacy { color: #abcdef; }\n");
    commit();
    renameSync(join(pkg, "src/old.css"), join(pkg, "src/new.css"));
    git("add", "-A");
    const r = run();
    expect(r.status).toBe(0);
  });

  test("a committed rename keeps its debt when compared with the earlier base", () => {
    file("src/old.css", ".legacy { color: #abcdef; }\n.keep { margin: 0; }\n");
    const base = commit();
    renameSync(join(pkg, "src/old.css"), join(pkg, "src/new.css"));
    commit();
    expect(run([`--base=${base}`]).status).toBe(0);
  });

  test("a rename that also adds a raw value blocks only the new one", () => {
    file("src/old.css", ".legacy { color: #abcdef; }\n");
    commit();
    renameSync(join(pkg, "src/old.css"), join(pkg, "src/new.css"));
    file("src/new.css", ".legacy { color: #abcdef; }\n.fresh { gap: 13px; }\n");
    git("add", "-A");
    const r = run();
    expect(r.status).toBe(1);
    expect(count(r)).toBe(1);
    expect(JSON.parse(r.stdout).violations[0].code).toBe("raw-pixel");
  });

  test("an untracked file counts as new", () => {
    file("src/untracked.tsx", 'export const x = "#fff";\n');
    expect(git("status", "--porcelain")).toContain("??");
    expect(run().status).toBe(1);
  });

  test("a staged new file counts as new", () => {
    file("src/staged.tsx", 'export const x = "13px";\n');
    git("add", "-A");
    expect(run().status).toBe(1);
  });

  test("tokens.css is exempt, other css is not", () => {
    file("src/styles/tokens.css", ":root { --color-ink: #111111; --space: 8px; }\n");
    expect(run().status).toBe(0);
    file("src/styles/app.css", ".x { color: #111111; }\n");
    expect(run().status).toBe(1);
  });

  test("test files, generated route tree and files outside src/ are not scanned", () => {
    file("src/a.test.ts", 'const f = "#123456";\n');
    file("src/routeTree.gen.ts", 'const f = "#123456";\n');
    file("scripts/tool.ts", 'const f = "#123456";\n');
    expect(run().status).toBe(0);
  });

  test("comments and semantic tokens pass", () => {
    file("src/good.tsx", '// #abcdef 12px\nconst s = { gap: "var(--space-3)", color: "var(--color-accent)" };\n');
    expect(run().status).toBe(0);
  });

  test("tailwind arbitrary visual values and raw shadows block", () => {
    file("src/arb.tsx", 'export const a = "bg-[#fff] w-[13px]";\nexport const b = { boxShadow: "0 1px 2px black" };\n');
    const codes = JSON.parse(run().stdout).violations.map((v: { code: string }) => v.code);
    expect(codes).toContain("tailwind-arbitrary-visual");
    expect(codes).toContain("raw-shadow");
  });

  test("a committed violation is caught with --base even on a clean worktree", () => {
    const base = git("rev-parse", "HEAD");
    file("src/new.tsx", 'const style = { padding: "17px" };\n');
    commit();
    expect(git("status", "--porcelain")).toBe("");
    expect(run().status).toBe(0);
    const r = run([`--base=${base}`]);
    expect(r.status).toBe(1);
    expect(count(r)).toBe(1);
  });

  test("an unresolvable --base fails closed", () => {
    const r = run(["--base=does-not-exist"]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("cannot read Git state");
  });

  test("an unresolvable GATE_BASE fails closed", () => {
    const r = run([], { GATE_BASE: "0000000000000000000000000000000000000000" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("cannot read Git state");
  });

  test("base order: --base wins over GATE_BASE", () => {
    const first = git("rev-parse", "HEAD");
    file("src/a.tsx", 'export const a = "#111111";\n');
    commit();
    const r = run([`--base=${first}`], { GATE_BASE: "HEAD" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("--base=");
  });

  test("base order: GATE_BASE is used when no flag is given", () => {
    const first = git("rev-parse", "HEAD");
    file("src/a.tsx", 'export const a = "#111111";\n');
    commit();
    const r = run([], { GATE_BASE: first });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("GATE_BASE=");
  });

  test("base order: falls back to the upstream merge-base", () => {
    git("checkout", "-b", "feature");
    git("branch", "--set-upstream-to=main");
    file("src/a.tsx", 'export const a = "#111111";\n');
    commit();
    const r = run();
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("@{upstream}");
  });

  test("base order: then origin/main, then HEAD", () => {
    git("checkout", "-b", "feature");
    git("update-ref", "refs/remotes/origin/main", git("rev-parse", "main"));
    file("src/a.tsx", 'export const a = "#111111";\n');
    commit();
    const viaOrigin = run();
    expect(viaOrigin.status).toBe(1);
    expect(viaOrigin.stderr).toContain("origin/main");

    git("update-ref", "-d", "refs/remotes/origin/main");
    const viaHead = run();
    expect(viaHead.status).toBe(0);
    expect(viaHead.stderr).toContain("HEAD");
  });

  if (sub) {
    test("a violation in a sibling directory of the package is ignored", () => {
      file("../sibling/src/x.tsx", 'const f = "#123456";\n');
      expect(run().status).toBe(0);
    });

    test("paths are relative to the package directory", () => {
      file("src/routes/new.tsx", 'const f = "#123456";\n');
      expect(JSON.parse(run().stdout).violations[0].file).toBe("src/routes/new.tsx");
    });
  }

  test("--full reports the advisory count and never blocks by itself", () => {
    file("src/legacy.css", ".legacy { color: #abcdef; }\n");
    commit();
    const r = run(["--full"]);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).fullScanCount).toBe(1);
  });
});
