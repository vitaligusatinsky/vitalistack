// One generated test per rule: the lines the rule fires on in each bad fixture
// must equal the lines marked `@expect <rule-id>`, exactly. Good fixtures must
// produce no findings from any rule. Engine tests (masking, escape hatch, scope)
// follow; each names the review item it pins.
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expectedLines, fixtureFiles, oxlintFixture, readFixture } from "./fixtures-util";
import { analyze, applyExemptions, checkContent, loadRules, maskComments, parseAllow } from "./scan";
import { dampingRatio } from "./rules/no-bounce-motion";

const rules = await loadRules();
const ids = (src: string, file = "x.tsx") => checkContent(rules, file, src).findings.map((f) => `${f.ruleId}@${f.line}`);

describe("rule set", () => {
  test("there are seven rules with the agreed ids", () => {
    expect(rules.map((r) => r.id).sort()).toEqual(
      [
        "no-bounce-motion",
        "no-default-ai-gradient",
        "no-emoji-icon",
        "no-raw-palette",
        "no-side-accent-border",
        "no-slop-copy",
        "require-accessible-name",
      ].sort(),
    );
  });

  test("every rule has text, a bad fixture with markers and a good fixture", () => {
    for (const rule of rules) {
      expect(rule.title.length).toBeGreaterThan(10);
      expect(rule.why.length).toBeGreaterThan(20);
      expect(rule.fix.length).toBeGreaterThan(10);
      const bad = fixtureFiles(rule.id, "bad");
      expect(bad.length).toBeGreaterThan(0);
      expect(fixtureFiles(rule.id, "good").length).toBeGreaterThan(0);
      expect(bad.flatMap((f) => expectedLines(readFixture(rule.id, f), rule.id)).length).toBeGreaterThan(0);
    }
  });

  test("no stray fixture directories without a rule", () => {
    const dirs = readdirSync(join(import.meta.dir, "fixtures"));
    expect(dirs.sort()).toEqual(rules.map((r) => r.id).sort());
  });

  test("every rule's bad fixtures hold an exempted line, and a bare or too-short vs-allow that still fires", () => {
    for (const rule of rules) {
      let exempted = 0;
      let stillFires = 0;
      for (const name of fixtureFiles(rule.id, "bad")) {
        const content = readFixture(rule.id, name);
        exempted += checkContent(rules, name, content).used.filter((u) => u.ruleId === rule.id).length;
        const lines = content.split("\n");
        for (const n of expectedLines(content, rule.id)) {
          const above = lines[n - 2] ?? "";
          const info = analyze(name, content);
          const comment = info.comments.find((c) => c.endLine === n - 1 && c.standalone && /vs-allow/.test(c.text));
          if (comment && above.includes("vs-allow")) {
            // a standalone vs-allow comment sits above and the line still fires: it must be an invalid one
            expect(parseAllow(comment.text.replace(/^\/\/|^\/\*+|\*+\/$|^<!--|-->$/g, ""))).toBeNull();
            stillFires++;
          }
        }
      }
      if (rule.id !== "no-slop-copy" || exempted > 0) expect(exempted).toBeGreaterThanOrEqual(1);
      expect(stillFires).toBeGreaterThanOrEqual(1);
    }
  });
});

for (const rule of rules) {
  describe(rule.id, () => {
    for (const name of fixtureFiles(rule.id, "bad")) {
      test(`fires on exactly the marked lines of ${name}`, () => {
        const content = readFixture(rule.id, name);
        const { findings } = checkContent(rules, name, content);
        const fired = [...new Set(findings.filter((f) => f.ruleId === rule.id).map((f) => f.line))].sort((a, b) => a - b);
        const expected = [...new Set(expectedLines(content, rule.id))].sort((a, b) => a - b);
        expect(fired).toEqual(expected);
      });
    }
    for (const name of fixtureFiles(rule.id, "good")) {
      test(`reports nothing on ${name}`, () => {
        const { findings } = checkContent(rules, name, readFixture(rule.id, name));
        expect(findings).toEqual([]);
      });
    }
  });
}

describe("require-accessible-name: the part oxlint covers", () => {
  test("oxlint fires on every @expect-oxlint line of the a11y fixture", () => {
    const ox = oxlintFixture()!;
    const r = spawnSync(join(import.meta.dir, "..", "node_modules/.bin/oxlint"), ["-c", ox.config, "-f", "json", ox.file], { encoding: "utf8" });
    const diagnostics = JSON.parse(r.stdout).diagnostics as Array<{ code: string; labels: Array<{ span: { line: number } }> }>;
    const got = diagnostics.map((d) => `${d.labels[0]!.span.line}:${d.code}`);
    const lines = readFixture("require-accessible-name", ox.name).split("\n");
    let expected = 0;
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/@expect-oxlint\s+([a-z-]+)/g)) {
        expected++;
        expect(got).toContain(`${i + 1}:jsx-a11y(${m[1]})`);
      }
    });
    expect(expected).toBeGreaterThanOrEqual(3);
    expect(got.length).toBe(expected);
  });
  test("the repo .oxlintrc.json enables the same three rules", async () => {
    const cfg = JSON.parse(await Bun.file(join(import.meta.dir, "..", ".oxlintrc.json")).text());
    for (const r of ["alt-text", "anchor-has-content", "control-has-associated-label"]) expect(cfg.rules[`jsx-a11y/${r}`]).toBe("error");
  });
});

describe("B2 masking with a real tokenizer", () => {
  test("a regex literal containing a quote or // does not hide the rest of the line", () => {
    expect(ids('const r = /"/; const c = "bg-blue-500";')).toContain("no-raw-palette@1");
    expect(ids('const r = /\\/\\//; const c = "bg-blue-500";')).toContain("no-raw-palette@1");
  });
  test("JSX text // does not open a comment", () => {
    expect(ids('export const A = () => <div><span>//</span><i className="bg-blue-500" /></div>')).toContain("no-raw-palette@1");
  });
  test("a multi-line JSX className string is scanned", () => {
    const src = 'export const A = () => (\n  <p className="\n    flex\n    bg-gray-100\n  ">x</p>\n)\n';
    expect(ids(src)).toContain("no-raw-palette@4");
  });
  test("a string glued to a keyword, return\"...\", is scanned", () => {
    expect(ids('function f() {\n  return"bg-blue-500"\n}\n', "x.ts")).toContain("no-raw-palette@2");
  });
  test("an apostrophe in JSX text does not swallow the line", () => {
    expect(ids("export const A = () => <p>Don't <b className=\"bg-blue-500\">x</b></p>")).toContain("no-raw-palette@1");
  });
  test("a commented-out class is not scanned", () => {
    expect(ids('const a = "ok"; // bg-white\n/* <p className="bg-white"> */\n')).toEqual([]);
  });
  test("masking keeps length, lines and columns", () => {
    const src = 'const a = 1; // bg-white\n/* bg-white\n bg-white */ const b = "//bg-white";\n';
    const masked = maskComments(src);
    expect(masked.length).toBe(src.length);
    expect(masked.split("\n").length).toBe(src.split("\n").length);
    expect(masked).not.toContain("// bg-white");
    expect(masked).toContain('"//bg-white"');
  });
  test("CSS url(\"x/*.png\") and url(x/*.png) do not open a comment", () => {
    expect(ids('.a { background: url("x/*.png"); }\n.b { @apply bg-white; }\n', "x.css")).toContain("no-raw-palette@2");
    expect(ids(".a { background: url(x/*.png); }\n.b { @apply bg-white; }\n", "x.css")).toContain("no-raw-palette@2");
  });
  test("a real CSS comment is masked", () => {
    expect(ids("/* @apply bg-white; */\n.a { color: red; }\n", "x.css")).toEqual([]);
  });
  test(".jsx, .js and .mjs files are parsed", () => {
    for (const f of ["x.jsx", "x.js", "x.mjs", "x.cjs"]) expect(ids('const a = "bg-white"; // c', f)).toEqual(["no-raw-palette@1"]);
  });
});

describe("B3 escape hatch", () => {
  const allow = (body: string) => parseAllow(body);
  test("needs a reason of at least 10 characters and a 3-letter word", () => {
    expect(allow(" vs-allow no-raw-palette: vendor logo colour")?.reason).toBe("vendor logo colour");
    expect(allow(" vs-allow no-raw-palette: ten chars!")?.reason).toBe("ten chars!");
    expect(allow(" vs-allow no-raw-palette: short")).toBeNull();
    expect(allow(" vs-allow no-raw-palette")).toBeNull();
    expect(allow(" vs-allow no-raw-palette:")).toBeNull();
    expect(allow(" vs-allow no-raw-palette: ..........")).toBeNull();
    expect(allow(" vs-allow no-raw-palette: 1234567890 12")).toBeNull();
  });
  test("a vs-allow inside a string does not exempt", () => {
    const src = 'const s = "// vs-allow no-raw-palette: a long enough reason";\nconst c = "bg-white";\n';
    expect(ids(src)).toContain("no-raw-palette@2");
    const src2 = 'const c = "bg-white"; const s = "// vs-allow no-raw-palette: a long enough reason";\n';
    expect(ids(src2)).toContain("no-raw-palette@1");
  });
  test("a vs-allow inside a template literal or JSX text does not exempt", () => {
    expect(ids('const t = `// vs-allow no-raw-palette: a long enough reason`;\nconst c = "bg-white";\n')).toContain("no-raw-palette@2");
    expect(ids('export const A = () => (\n  <div>\n    <i>// vs-allow no-raw-palette: a long enough reason</i>\n    <b className="bg-white" />\n  </div>\n)\n')).toContain("no-raw-palette@4");
  });
  test("a // vs-allow in a CSS file does not exempt, a /* */ one does", () => {
    expect(ids("// vs-allow no-raw-palette: a long enough reason\n.a { @apply bg-white; }\n", "x.css")).toContain("no-raw-palette@2");
    expect(ids("/* vs-allow no-raw-palette: a long enough reason */\n.a { @apply bg-white; }\n", "x.css")).toEqual([]);
  });
  test("a trailing comment exempts its own line, a standalone comment the next line", () => {
    expect(ids('const c = "bg-white"; // vs-allow no-raw-palette: a long enough reason\n')).toEqual([]);
    expect(ids('// vs-allow no-raw-palette: a long enough reason\nconst c = "bg-white";\n')).toEqual([]);
  });
  test("a trailing comment does not exempt the next line, a standalone one not the one after", () => {
    expect(ids('const a = 1; // vs-allow no-raw-palette: a long enough reason\nconst c = "bg-white";\n')).toContain("no-raw-palette@2");
    expect(ids('// vs-allow no-raw-palette: a long enough reason\n\nconst c = "bg-white";\n')).toContain("no-raw-palette@3");
  });
  test("it is specific to one rule", () => {
    expect(ids('// vs-allow no-bounce-motion: a long enough reason\nconst c = "bg-white";\n')).toContain("no-raw-palette@2");
  });
  test("a markdown comment exempts, a bare one does not", () => {
    expect(ids("<!-- vs-allow no-slop-copy: quoting the phrase on purpose -->\nIt is truly fine.\n", "x.md")).toEqual([]);
    expect(ids("<!-- vs-allow no-slop-copy -->\nIt is truly fine.\n", "x.md")).toEqual(["no-slop-copy@2"]);
  });
  test("used exemptions are counted per comment, not per finding", () => {
    const src = '// vs-allow no-raw-palette: a long enough reason\nconst c = "bg-white text-black bg-black";\n';
    const r = checkContent(rules, "x.ts", src);
    expect(r.exempt.length).toBeGreaterThan(1);
    expect(r.used.length).toBe(1);
    expect(r.used[0]).toEqual({ file: "x.ts", line: 1, ruleId: "no-raw-palette", reason: "a long enough reason" });
  });
  test("applyExemptions takes an analysis, not raw text", () => {
    const info = analyze("x.ts", '// vs-allow no-raw-palette: a long enough reason\nconst c = "bg-white";\n');
    expect(applyExemptions(info, [{ ruleId: "no-raw-palette", line: 2, column: 1 }]).exempt.length).toBe(1);
  });
});

describe("C4 gradient", () => {
  test("stops pair only within a variant", () => {
    expect(ids('const c = "from-purple-500 dark:to-pink-500";')).not.toContain("no-default-ai-gradient@1");
    expect(ids('const c = "dark:from-purple-500 dark:to-pink-500";').join()).toContain("no-default-ai-gradient@1");
    expect(ids('const c = "from-purple-500 to-pink-500";').join()).toContain("no-default-ai-gradient@1");
  });
  test("hue helper bands", () => {
    expect(ids('const c = "linear-gradient(135deg,#667eea 0%,#764ba2 100%)";').join()).toContain("no-default-ai-gradient@1");
    expect(ids('const c = "linear-gradient(135deg,#2563eb,#1d4ed8)";').join()).not.toContain("no-default-ai-gradient");
    expect(ids('const c = "linear-gradient(135deg,#888,#999)";').join()).not.toContain("no-default-ai-gradient");
  });
});

describe("C9 motion", () => {
  test("damping ratio uses the motion defaults", () => {
    expect(dampingRatio()).toBeCloseTo(0.5);
    expect(dampingRatio(400, 40)).toBeCloseTo(1);
    expect(dampingRatio(100, 30)).toBeCloseTo(1.5);
    expect(dampingRatio(300, 10)).toBeLessThan(1);
  });
  test("spring options outside a motion file or transition are ignored", () => {
    expect(ids("export const p = { type: 'spring', bounce: 0.4 };", "x.ts")).toEqual([]);
  });
  test("inside a transition object they are read without a motion import", () => {
    expect(ids("export const A = () => <m.div transition={{ type: 'spring', bounce: 0.4 }} />").join()).toContain("no-bounce-motion@1");
    expect(ids("export const v = { show: { transition: { type: 'spring', stiffness: 300, damping: 10 } } };", "x.ts").join()).toContain("no-bounce-motion@1");
  });
  test("a critically damped spring is allowed", () => {
    expect(ids("import { motion } from 'motion/react';\nexport const s = { type: 'spring', stiffness: 400, damping: 40 };", "x.ts")).toEqual([]);
  });
});

describe("C8 palette and ratchet-adjacent", () => {
  test("trailing ! is stripped", () => {
    expect(ids('const c = "bg-white!";')).toEqual(["no-raw-palette@1"]);
  });
  test("tailwind 4.3.4 palette names exist in theme.css", async () => {
    const css = await Bun.file(join(import.meta.dir, "..", "node_modules/tailwindcss/theme.css")).text();
    for (const n of ["mauve", "olive", "mist", "taupe"]) expect(css).toContain(`--color-${n}-500`);
  });
});

describe("C10 border", () => {
  test("right and end borders do not fire; left and start do", () => {
    expect(ids('const c = "border-r-4 border-e-8";')).toEqual([]);
    expect(ids('const c = "border-l-[0.25rem]";')).toEqual(["no-side-accent-border@1"]);
  });
});

describe("D25 emoji detail", () => {
  test("digits, #, * and (c) (R) TM do not count", () => {
    expect(ids("export const A = () => <li>1 # * © ® ™</li>")).toEqual([]);
  });
  test("an emoji in a plain paragraph is user text", () => {
    expect(ids("export const A = () => <div><p>hello 🚀</p></div>")).toEqual([]);
  });
});

describe("C26 copy detail", () => {
  test("seamless is bounded exactly: seamlessly passes", () => {
    expect(ids("export const A = () => <p>It works seamlessly.</p>")).toEqual([]);
    expect(ids("export const A = () => <p>Seamless.</p>")).toEqual(["no-slop-copy@1"]);
  });
  test("an en dash passes, an em dash fires", () => {
    expect(ids("export const A = () => <p>2–3</p>")).toEqual([]);
    expect(ids("export const A = () => <p>2—3</p>")).toEqual(["no-slop-copy@1"]);
  });
});
