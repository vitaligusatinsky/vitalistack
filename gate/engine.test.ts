// Tests for the parts around the rules: what is scanned (B1), the pre-push hook (B4),
// and the hook installer (B6). Each runs the real scripts in a throwaway git repository.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, statSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { shouldIgnore } from "./scan";

const gate = import.meta.dir;
const bun = process.execPath;

let repo: string;
const git = (...args: string[]): string => {
  const r = spawnSync("git", ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", ...args], { cwd: repo, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
};
const hooksPath = () => spawnSync("git", ["config", "--get", "core.hooksPath"], { cwd: repo, encoding: "utf8" }).stdout.trim();
const file = (path: string, content: string) => {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), content);
};
const commit = (): string => {
  git("add", "-A");
  git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "-m", "fixture");
  return git("rev-parse", "HEAD");
};
const script = (name: string, args: string[] = [], input?: string) =>
  spawnSync(bun, [join(gate, name), ...args], { cwd: repo, encoding: "utf8", input, env: { ...process.env, CI: "", GATE_BASE: "", GATE_ROOT: repo } });

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "gate-engine-"));
  git("init", "-b", "main");
  file("src/ok.tsx", "export const A = () => <p>ok</p>;\n");
  commit();
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe("B1 scan scope", () => {
  test("the ignore list", () => {
    for (const p of [
      "node_modules/x/y.ts", "gate/rules/a.ts", "gate/fixtures/a/bad.tsx", "gate/fixtures/a/bad.md", "scripts/a.ts", ".github/a.ts", "public/a.js",
      "vite.config.ts", "tailwind.config.js", "src/routeTree.gen.ts", "src/a.test.tsx", "src/a.spec.ts", "src/styles/tokens.css", "CHANGELOG.md", "dist/a.js",
    ]) expect(shouldIgnore(p)).toBe(true);
    for (const p of [
      "src/a.tsx", "components/D.tsx", "app/x.jsx", "lib/y.mjs", "src/components/styles/tokens.css", "styles/tokens.css", "tokens.css", "README.md",
      "gate/README.md", "docs/decisions.md", "build-log/01-a.md", "src/nested/scripts/a.ts",
    ]) expect(shouldIgnore(p)).toBe(false);
  });

  test("a nested styles/tokens.css with violations is caught, the exact one is not", () => {
    file("src/styles/tokens.css", ".a { @apply bg-white; }\n");
    expect(script("run.ts").status).toBe(0);
    file("src/components/styles/tokens.css", ".a { @apply bg-white; }\n");
    const r = script("run.ts");
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("src/components/styles/tokens.css:1");
  });

  test("a root-level components/D.tsx is caught", () => {
    file("components/D.tsx", 'export const D = () => <i className="bg-white" />;\n');
    const r = script("run.ts");
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("components/D.tsx:1");
  });

  test("a .jsx file is caught", () => {
    file("src/E.jsx", 'export const E = () => <i className="bg-white" />;\n');
    expect(script("run.ts").stdout).toContain("src/E.jsx:1");
  });

  test("markdown is scanned by no-slop-copy only", () => {
    file("README.md", "Unlock the potential of it — now bg-white.\n");
    const r = script("run.ts");
    expect(r.stdout).toContain("README.md:1:1 [no-slop-copy]");
    expect(r.stdout).not.toContain("no-raw-palette");
  });

  test("an empty scan refuses to pass", () => {
    rmSync(join(repo, "src"), { recursive: true });
    git("add", "-A");
    expect(script("run.ts").status).toBe(1);
  });

  test("the exemption list prints file:line rule-id and reason", () => {
    file("src/x.tsx", '// vs-allow no-raw-palette: vendor logo colour\nexport const x = "bg-white";\n');
    const r = script("run.ts");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("vs-allow exemptions used: 1");
    expect(r.stdout).toContain('src/x.tsx:1 no-raw-palette "vendor logo colour"');
  });
});

describe("B4 the pre-push hook checks what is pushed", () => {
  const stdin = (sha: string, remoteSha = "0".repeat(40)) => `refs/heads/main ${sha} refs/heads/main ${remoteSha}\n`;

  test("a violation committed and fixed only in the working tree fails the hook", () => {
    const remote = git("rev-parse", "HEAD");
    file("src/bad.tsx", 'export const A = () => <i className="bg-white" />;\n');
    const bad = commit();
    file("src/bad.tsx", 'export const A = () => <i className="bg-surface" />;\n');
    expect(script("run.ts").status).toBe(0); // the working tree looks clean
    const r = script("pre-push.ts", ["origin"], stdin(bad, remote));
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("src/bad.tsx:1");
  });

  test("a clean commit with a dirty working tree passes the hook", () => {
    const remote = git("rev-parse", "HEAD");
    file("src/good.tsx", 'export const A = () => <i className="bg-surface" />;\n');
    const good = commit();
    file("src/good.tsx", 'export const A = () => <i className="bg-white" />;\n');
    expect(script("run.ts").status).toBe(1); // the working tree is dirty
    const r = script("pre-push.ts", ["origin"], stdin(good, remote));
    expect(r.status).toBe(0);
  });

  test("a new raw value in the pushed commit fails the ratchet half", () => {
    const remote = git("rev-parse", "HEAD");
    file("src/raw.tsx", 'export const s = { color: "#123456" };\n');
    const bad = commit();
    const r = script("pre-push.ts", ["origin"], stdin(bad, remote));
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("[raw-color]");
  });

  test("deleting a ref checks nothing", () => {
    const r = script("pre-push.ts", ["origin"], `(delete) ${"0".repeat(40)} refs/heads/old ${"a".repeat(40)}\n`);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("no commits to check");
  });

  test("a new branch (all-zero remote sha) compares with the remote default branch, or scans in full", () => {
    const main = git("rev-parse", "HEAD");
    git("update-ref", "refs/remotes/origin/main", main);
    file("src/raw.tsx", 'export const s = { color: "#123456" };\n');
    const bad = commit();
    const r = script("pre-push.ts", ["origin"], stdin(bad));
    expect(r.status).toBe(1);
    expect(r.stdout).toContain(`base ${main.slice(0, 10)}`);
  });

  test("a remote sha this clone does not have falls back instead of crashing", () => {
    file("src/raw.tsx", 'export const s = { color: "#123456" };\n');
    const bad = commit();
    const r = script("pre-push.ts", ["origin"], stdin(bad, "f".repeat(40)));
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("no base");
  });

  test("the shell hook is executable and hands stdin to pre-push.ts", () => {
    const hook = join(gate, "..", ".githooks", "pre-push");
    expect(statSync(hook).mode & 0o111).not.toBe(0);
    const text = readFileSync(hook, "utf8");
    expect(text).toContain("gate/pre-push.ts");
    expect(text).toContain("input=$(cat)");
  });
});

describe("round 3", () => {
  test("R3-6 CODEOWNERS and the CI warning watch package.json and .oxlintrc.json", () => {
    const owners = readFileSync(join(gate, "..", ".github", "CODEOWNERS"), "utf8");
    const wf = readFileSync(join(gate, "..", ".github", "workflows", "gate.yml"), "utf8");
    for (const p of ["/package.json", "/.oxlintrc.json", "/gate/", "/.githooks/", "/.github/"]) expect(owners).toContain(p + " @");
    for (const p of ["package.json", ".oxlintrc.json", "gate", ".githooks"]) expect(wf).toContain(p);
  });
  test("R3-nit run.ts and ratchet.ts find the package from their own location, not the cwd", () => {
    const elsewhere = mkdtempSync(join(tmpdir(), "gate-cwd-"));
    try {
      const r = spawnSync(bun, [join(gate, "run.ts")], { cwd: elsewhere, encoding: "utf8", env: { ...process.env, GATE_ROOT: "" } });
      expect(r.status).toBe(0);
      expect(r.stdout).toMatch(/gate: 7 rules, \d+ files scanned/);
    } finally {
      rmSync(elsewhere, { recursive: true, force: true });
    }
  });
  test("R3-nit a global core.hooksPath does not block installing the local one", () => {
    const globalCfg = join(repo, "..", `gitconfig-${Date.now()}`);
    writeFileSync(globalCfg, "[core]\n\thooksPath = /somewhere/global\n");
    const r = spawnSync(bun, [join(gate, "..", "scripts", "install-hooks.ts")], { cwd: repo, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: globalCfg } });
    rmSync(globalCfg);
    expect(r.stdout).toContain("installed");
    expect(spawnSync("git", ["config", "--local", "--get", "core.hooksPath"], { cwd: repo, encoding: "utf8" }).stdout.trim()).toBe(".githooks");
  });
  test("R3-4 the shadcn recipe tokens exist", () => {
    const css = readFileSync(join(gate, "..", "src", "styles", "tokens.css"), "utf8");
    for (const t of ["--color-on-accent", "--color-overlay", "--color-danger"]) expect(css).toContain(t);
    const doc = readFileSync(join(gate, "README.md"), "utf8");
    expect(doc).toContain("Adding shadcn/ui components");
    for (const t of ["text-on-accent", "bg-overlay", "ring-3", "top-1/2", "-translate-x-1/2"]) expect(doc).toContain(t);
  });
});

describe("B6 the hook installer", () => {
  const install = () => spawnSync(bun, [join(gate, "..", "scripts", "install-hooks.ts")], { cwd: repo, encoding: "utf8" });
  test("installs in a repository root", () => {
    const r = install();
    expect(r.stdout).toContain("installed");
    expect(hooksPath()).toBe(".githooks");
  });
  test("is idempotent", () => {
    install();
    expect(install().stdout).toContain("already installed");
  });
  test("does not overwrite an existing hooks path and says how to chain", () => {
    spawnSync("git", ["config", "core.hooksPath", ".husky"], { cwd: repo });
    const r = install();
    expect(hooksPath()).toBe(".husky");
    expect(r.stdout).toContain("\".husky\"");
    expect(r.stdout).toContain(".githooks/pre-push");
    expect(r.stdout).toContain("left unchanged");
  });
  test("does nothing inside a subdirectory of a larger repository", () => {
    file("oss/README.md", "x\n");
    const r = spawnSync(bun, [join(gate, "..", "scripts", "install-hooks.ts")], { cwd: join(repo, "oss"), encoding: "utf8" });
    expect(r.stdout).toContain("hooks not installed");
    expect(hooksPath()).toBe("");
  });
});
