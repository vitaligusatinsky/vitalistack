// Adapted from DesignAnswers Oy's token audit tests (MIT, same copyright holder).
// Every CLI test runs the real ratchet in a throwaway git repository, twice: once with
// the package at the repository root (the public repo) and once with the package
// in an `oss/` subdirectory (the private monorepo).
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { auditContent } from "./ratchet";

const cli = join(import.meta.dir, "ratchet.ts");

const codes = (file: string, src: string) => auditContent(file, src).map((v) => v.code);
const tokens = (file: string, src: string) => auditContent(file, src).map((v) => v.token);

describe("detectors (C8, C10)", () => {
  test("modern colour functions are raw colours", () => {
    for (const fn of ["oklch(0.6 0.2 250)", "oklab(0.6 0.1 0.1)", "lab(50% 40 59)", "lch(50% 40 59)", "color-mix(in srgb, red 50%, blue)"]) {
      expect(codes("a.css", `.a { color: ${fn}; }\n`)).toContain("raw-color");
    }
  });
  test("arbitrary Tailwind values with any length unit", () => {
    for (const v of ["w-[2rem]", "p-[1.5em]", "w-[50vw]", "h-[80vh]", "w-[33%]", "bg-[#fff]", "w-[13px]"]) {
      expect(codes("a.tsx", `export const a = "${v}";\n`)).toContain("tailwind-arbitrary-visual");
    }
  });
  test("arbitrary media-query variants are not visual values", () => {
    expect(codes("a.tsx", 'export const a = "min-[600px]:flex max-[40rem]:hidden @min-[30rem]:grid";\n')).not.toContain("tailwind-arbitrary-visual");
  });
  test("numeric React style values block, zero does not", () => {
    expect(codes("a.tsx", "export const s = { padding: 12, marginTop: 8, gap: 4, width: 300, fontSize: 14, borderRadius: 6, lineHeight: 1.5, top: 10 };\n")).toContain("raw-style-number");
    expect(tokens("a.tsx", "export const s = { padding: 12, marginTop: 8 };\n")).toEqual(["padding: 12", "marginTop: 8"]);
    expect(codes("a.tsx", "export const s = { padding: 0, margin: 0, top: 0.0 };\n")).toEqual([]);
    expect(codes("a.tsx", 'export const s = { padding: "var(--space-3)", width: size };\n')).toEqual([]);
  });
  test("named colours only where a colour is set", () => {
    expect(codes("a.css", ".a { color: red; }\n")).toContain("raw-color");
    expect(codes("a.css", ".a { border: 1px solid blue; }\n")).toContain("raw-color");
    expect(codes("a.tsx", 'export const s = { color: "red", backgroundColor: "navy" };\n')).toEqual(["raw-color", "raw-color"]);
    expect(codes("a.tsx", "export const A = () => <p>The red fox and the blue whale are not a palette.</p>;\n")).toEqual([]);
    expect(codes("a.tsx", 'export const s = { label: "red", name: "blue" };\n')).toEqual([]);
    expect(codes("a.css", ".a { color: transparent; border-color: currentColor; background: none; }\n")).toEqual([]);
  });
  test("hex fragments and URLs are not colours", () => {
    for (const src of [
      'export const A = () => <a href="#abc">x</a>;\n',
      'export const A = () => <Link to="#fade">x</Link>;\n',
      'export const A = () => <div id="#bed" />;\n',
      'export const u = "https://example.com/page#add";\n',
      'export const u = "/docs#bad";\n',
      "if (location.hash === \"#abc\") {}\n",
    ]) expect(codes("a.tsx", src)).toEqual([]);
    expect(codes("a.css", ".a { background: url(#grad); }\n")).toEqual([]);
    expect(codes("a.tsx", 'export const c = "#abc";\n')).toEqual(["raw-color"]);
  });
  test("pixels inside media queries are not visual values", () => {
    expect(codes("a.css", "@media (min-width: 640px) {\n  .a { margin: 0; }\n}\n")).toEqual([]);
    expect(codes("a.css", "@container (min-width: 400px) { .a { margin: 0; } }\n")).toEqual([]);
    expect(codes("a.tsx", 'const q = window.matchMedia("(min-width: 768px)");\n')).toEqual([]);
    expect(codes("a.tsx", 'const q = useMediaQuery("(max-width: 600px)");\n')).toEqual([]);
    expect(codes("a.css", ".a { gap: 13px; }\n")).toContain("raw-pixel");
  });
  test("comments are not scanned", () => {
    expect(codes("a.tsx", "// #abcdef 12px\n/* oklch(0.5 0.1 10) */\nexport const a = 1;\n")).toEqual([]);
  });
});

describe("round 3 detectors", () => {
  test("R3-3 arbitrary values need a class-token bracket: JS arrays and multi-line arrays are not matches", () => {
    expect(codes("a.tsx", 'export const k = ["0%", "100%"];\n')).toEqual([]);
    expect(codes("a.tsx", 'export const m = [\n  { title: "x" },\n  { content: "p-4" },\n];\n')).toEqual([]);
    expect(codes("a.tsx", 'export const a = "w-[13px] bg-[#fff] [&_p]:mt-[2rem]";\n')).toContain("tailwind-arbitrary-visual");
    expect(tokens("a.tsx", 'export const a = "w-[13px]";\n')).toContain("[13px]");
  });
  test("R3-3 a hex in a meta array is a raw colour on its own terms, and nothing else", () => {
    const src = 'export const m = [\n  { title: "x" },\n  { name: "theme-color", content: "#0b0b0b" },\n];\n';
    expect(codes("a.tsx", src)).toEqual(["raw-color"]);
  });
  test("R3-3 vs-allow exempts a ratchet finding, a bare one does not", () => {
    const ok = '// vs-allow raw-color: theme-color meta must be a literal colour\nexport const c = "#0b0b0b";\n';
    expect(codes("a.tsx", ok)).toEqual([]);
    expect(codes("a.tsx", '// vs-allow raw-color\nexport const c = "#0b0b0b";\n')).toEqual(["raw-color"]);
  });
});

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
  /** Run the ratchet. Pass `--base=HEAD` yourself when a test wants to compare with the last commit. */
  const run = (args: string[] = [], env: Record<string, string> = {}) => {
    const clean = { ...process.env } as Record<string, string | undefined>;
    delete clean.GATE_BASE;
    delete clean.CI;
    return spawnSync(process.execPath, [cli, "--json", ...args], { cwd: pkg, encoding: "utf8", env: { ...clean, GATE_ROOT: pkg, ...env } });
  };
  const vs = (r: ReturnType<typeof run>) => JSON.parse(r.stdout);
  const count = (r: ReturnType<typeof run>): number => vs(r).violationCount;
  const HEAD = ["--base=HEAD"];

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
    const r = run(HEAD);
    expect(r.status).toBe(1);
    expect(count(r)).toBe(1);
    expect(vs(r).violations[0].code).toBe("raw-color");
  });

  test("an existing violation does not block", () => {
    file("src/legacy.css", ".legacy { color: #abcdef; }\n");
    commit();
    file("src/legacy.css", "/* a comment moves the line */\n.legacy { color: #abcdef; }\n");
    const r = run(HEAD);
    expect(r.status).toBe(0);
    expect(count(r)).toBe(0);
  });

  test("a second copy of the same value in the file blocks, the original stays free", () => {
    const debt = ".legacy { color: #abcdef; }\n";
    file("src/legacy.css", debt);
    commit();
    file("src/legacy.css", debt + debt);
    const r = run(HEAD);
    expect(r.status).toBe(1);
    expect(count(r)).toBe(1);
  });

  test("C10 fingerprint: editing another token on a line that holds old debt does not report the debt", () => {
    file("src/a.tsx", 'export const a = "p-4 w-[13px]";\n');
    commit();
    file("src/a.tsx", 'export const a = "p-6 w-[13px]";\n');
    const r = run(HEAD);
    expect(r.status).toBe(0);
    expect(count(r)).toBe(0);
  });

  test("C10 fingerprint: a second w-[13px] in the same file is new, even on another line", () => {
    file("src/a.tsx", 'export const a = "p-4 w-[13px]";\n');
    commit();
    file("src/a.tsx", 'export const a = "p-4 w-[13px]";\nexport const b = "w-[13px]";\n');
    const r = run(HEAD);
    expect(r.status).toBe(1);
    expect(count(r)).toBeGreaterThanOrEqual(1);
    expect(vs(r).violations.every((v: { line: number }) => v.line === 2)).toBe(true);
  });

  test("C10 fingerprint: moving a value to a new file is new", () => {
    file("src/a.tsx", 'export const a = "w-[13px]";\n');
    commit();
    file("src/a.tsx", "export const a = 1;\n");
    file("src/b.tsx", 'export const b = "w-[13px]";\n');
    expect(run(HEAD).status).toBe(1);
  });

  test("a staged rename keeps its debt", () => {
    file("src/old.css", ".legacy { color: #abcdef; }\n");
    commit();
    renameSync(join(pkg, "src/old.css"), join(pkg, "src/new.css"));
    git("add", "-A");
    expect(run(HEAD).status).toBe(0);
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
    const r = run(HEAD);
    expect(r.status).toBe(1);
    expect(count(r)).toBe(1);
    expect(vs(r).violations[0].code).toBe("raw-pixel");
  });

  test("an untracked file counts as new", () => {
    file("src/untracked.tsx", 'export const x = "#fff";\n');
    expect(git("status", "--porcelain")).toContain("??");
    expect(run(HEAD).status).toBe(1);
  });

  test("a staged new file counts as new", () => {
    file("src/staged.tsx", 'export const x = "13px";\n');
    git("add", "-A");
    expect(run(HEAD).status).toBe(1);
  });

  test("B1 only the exact src/styles/tokens.css is exempt", () => {
    file("src/styles/tokens.css", ":root { --color-ink: #111111; --space: 8px; }\n");
    expect(run(HEAD).status).toBe(0);
    file("src/components/styles/tokens.css", ":root { --color-ink: #111111; }\n");
    expect(run(HEAD).status).toBe(1);
  });

  test("B1 files outside src/ are scanned, config, test and generated files are not", () => {
    file("components/D.tsx", 'export const x = "#fff";\n');
    expect(run(HEAD).status).toBe(1);
    rmSync(join(pkg, "components"), { recursive: true });
    file("src/a.test.ts", 'const f = "#123456";\n');
    file("src/routeTree.gen.ts", 'const f = "#123456";\n');
    file("tailwind.config.ts", 'export default { c: "#123456" };\n');
    file("scripts/tool.ts", 'const f = "#123456";\n');
    file("src/page.jsx", "export const A = () => null;\n");
    expect(run(HEAD).status).toBe(0);
    file("src/page.jsx", 'export const A = () => <i style={{ color: "#123456" }} />;\n');
    expect(run(HEAD).status).toBe(1);
  });

  test("comments and semantic tokens pass", () => {
    file("src/good.tsx", '// #abcdef 12px\nconst s = { gap: "var(--space-3)", color: "var(--color-accent)" };\n');
    expect(run(HEAD).status).toBe(0);
  });

  test("tailwind arbitrary visual values and raw shadows block", () => {
    file("src/arb.tsx", 'export const a = "bg-[#fff] w-[13px]";\nexport const b = { boxShadow: "0 1px 2px black" };\n');
    const found = vs(run(HEAD)).violations.map((v: { code: string }) => v.code);
    expect(found).toContain("tailwind-arbitrary-visual");
    expect(found).toContain("raw-shadow");
  });

  test("a committed violation is caught with --base even on a clean worktree", () => {
    const base = git("rev-parse", "HEAD");
    file("src/new.tsx", 'const style = { padding: "17px" };\n');
    commit();
    expect(git("status", "--porcelain")).toBe("");
    expect(run(HEAD).status).toBe(0);
    const r = run([`--base=${base}`]);
    expect(r.status).toBe(1);
    expect(count(r)).toBe(1);
  });

  test("an unresolvable --base fails closed", () => {
    const r = run(["--base=does-not-exist"]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("cannot read Git state");
  });

  test("an unresolvable non-empty GATE_BASE fails closed", () => {
    const r = run([], { GATE_BASE: "1234567890abcdef1234567890abcdef12345678" });
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

  test("base order: then origin/main", () => {
    git("checkout", "-b", "feature");
    git("update-ref", "refs/remotes/origin/main", git("rev-parse", "main"));
    file("src/a.tsx", 'export const a = "#111111";\n');
    commit();
    const r = run();
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("origin/main");
  });

  describe("B5 no base: the full scan blocks", () => {
    const MSG = "no base found, running the full scan (blocking)";
    test("no flag, no env, no upstream, no origin/main", () => {
      file("src/legacy.css", ".legacy { color: #abcdef; }\n");
      commit();
      const r = run();
      expect(r.status).toBe(1);
      expect(r.stderr).toContain(MSG);
      expect(count(r)).toBe(1);
    });
    test("an empty GATE_BASE", () => {
      file("src/a.tsx", 'export const a = "#111111";\n');
      commit();
      const r = run([], { GATE_BASE: "" });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain(MSG);
    });
    test("an all-zero GATE_BASE (the first push)", () => {
      file("src/a.tsx", 'export const a = "#111111";\n');
      commit();
      const r = run([], { GATE_BASE: "0000000000000000000000000000000000000000" });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain(MSG);
    });
    test("on CI, an upstream equal to HEAD leaves nothing to compare, so it scans in full", () => {
      file("src/a.tsx", 'export const a = "#111111";\n');
      commit();
      git("update-ref", "refs/remotes/origin/main", git("rev-parse", "HEAD"));
      const r = run([], { CI: "true" });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain(MSG);
    });
    test("off CI, origin/main equal to HEAD checks only uncommitted changes", () => {
      file("src/a.tsx", 'export const a = "#111111";\n');
      commit();
      git("update-ref", "refs/remotes/origin/main", git("rev-parse", "HEAD"));
      expect(run().status).toBe(0);
    });
    test("a clean project passes the full scan", () => {
      file("src/a.tsx", 'export const a = "p-4";\n');
      commit();
      const r = run();
      expect(r.status).toBe(0);
      expect(r.stderr).toContain(MSG);
    });
  });

  test("R3-nit GATE_BASE equal to HEAD on CI falls to the full scan", () => {
    file("src/a.tsx", 'export const a = "#111111";\n');
    commit();
    const r = run([], { GATE_BASE: "HEAD", CI: "true" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("no base found");
    expect(run([], { GATE_BASE: "HEAD" }).status).toBe(0);
  });

  test("R3-3 editing a title in a multi-line meta array reports nothing new", () => {
    const a = (t: string) => `export const m = [\n  { title: "${t}" },\n  { content: "#0b0b0b" },\n];\n`;
    file("src/m.tsx", a("one"));
    commit();
    file("src/m.tsx", a("two"));
    expect(run(HEAD).status).toBe(0);
  });

  describe("B4 --rev checks the commit, not the working tree", () => {
    test("a violation committed and then fixed only in the working tree is caught", () => {
      const base = git("rev-parse", "HEAD");
      file("src/a.tsx", 'export const a = "#111111";\n');
      const bad = commit();
      file("src/a.tsx", 'export const a = "p-4";\n');
      expect(run([`--base=${base}`]).status).toBe(0);
      const r = run([`--base=${base}`, "--rev", bad]);
      expect(r.status).toBe(1);
      expect(count(r)).toBe(1);
    });
    test("a clean commit with a dirty working tree passes", () => {
      const base = git("rev-parse", "HEAD");
      file("src/a.tsx", 'export const a = "p-4";\n');
      const good = commit();
      file("src/a.tsx", 'export const a = "#111111";\n');
      expect(run([`--base=${base}`]).status).toBe(1);
      expect(run([`--base=${base}`, "--rev", good]).status).toBe(0);
    });
    test("--rev with no base runs the full scan of that commit", () => {
      file("src/a.tsx", 'export const a = "#111111";\n');
      const bad = commit();
      file("src/a.tsx", 'export const a = "p-4";\n');
      expect(run(["--rev", bad]).status).toBe(1);
    });
    test("untracked files are not part of a --rev check", () => {
      const base = git("rev-parse", "HEAD");
      file("src/ok.tsx", 'export const a = "p-4";\n');
      const good = commit();
      file("src/untracked.tsx", 'export const a = "#111111";\n');
      expect(run([`--base=${base}`, "--rev", good]).status).toBe(0);
    });
  });

  if (sub) {
    test("a violation in a sibling directory of the package is ignored", () => {
      file("../sibling/src/x.tsx", 'const f = "#123456";\n');
      expect(run(HEAD).status).toBe(0);
    });

    test("paths are relative to the package directory", () => {
      file("src/routes/new.tsx", 'const f = "#123456";\n');
      expect(vs(run(HEAD)).violations[0].file).toBe("src/routes/new.tsx");
    });

    test("--rev lists the package directory only", () => {
      file("src/ok.tsx", 'export const a = "p-4";\n');
      file("../sibling/src/x.tsx", 'const f = "#123456";\n');
      const sha = commit();
      expect(run(["--rev", sha]).status).toBe(0);
    });
  }

  test("--full reports the advisory count and never blocks by itself", () => {
    file("src/legacy.css", ".legacy { color: #abcdef; }\n");
    commit();
    const r = run([...HEAD, "--full"]);
    expect(r.status).toBe(0);
    expect(vs(r).fullScanCount).toBe(1);
  });
});
