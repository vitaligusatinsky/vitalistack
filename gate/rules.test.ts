// One generated test per rule: the lines the rule fires on in each bad fixture
// must equal the lines marked `@expect <rule-id>`, exactly. Good fixtures must
// produce no findings from any rule.
import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expectedLines, fixtureFiles, readFixture } from "./fixtures-util";
import { allowReason, applyExemptions, checkContent, loadRules, maskComments } from "./scan";

const rules = await loadRules();

describe("rule set", () => {
  test("there are six hard rules with the agreed ids", () => {
    expect(rules.map((r) => r.id).sort()).toEqual(
      [
        "no-bounce-motion",
        "no-decorative-numbering",
        "no-default-ai-gradient",
        "no-eyebrow-pill",
        "no-raw-palette",
        "no-side-accent-border",
      ].sort(),
    );
  });

  test("every rule has text, a bad fixture with markers and a good fixture", () => {
    for (const rule of rules) {
      expect(rule.title.length).toBeGreaterThan(10);
      expect(rule.why.length).toBeGreaterThan(20);
      expect(rule.fix.length).toBeGreaterThan(10);
      const bad = fixtureFiles(rule.id, "bad");
      const good = fixtureFiles(rule.id, "good");
      expect(bad.length).toBeGreaterThan(0);
      expect(good.length).toBeGreaterThan(0);
      const marked = bad.flatMap((f) => expectedLines(readFixture(rule.id, f), rule.id));
      expect(marked.length).toBeGreaterThan(0);
    }
  });

  test("no stray fixture directories without a rule", () => {
    const dirs = readdirSync(join(import.meta.dir, "fixtures"));
    expect(dirs.sort()).toEqual(rules.map((r) => r.id).sort());
  });

  test("across the fixtures there are exempted lines and bare vs-allow lines that still fire", () => {
    let exempted = 0;
    let bareStillFires = 0;
    for (const rule of rules) {
      for (const name of fixtureFiles(rule.id, "bad")) {
        const content = readFixture(rule.id, name);
        const { exempt } = checkContent(rules, name, content);
        exempted += exempt.filter((f) => f.ruleId === rule.id).length;
        const lines = content.split("\n");
        const expected = new Set(expectedLines(content, rule.id));
        for (const n of expected) {
          const above = lines[n - 2] ?? "";
          if (/vs-allow\s+[a-z-]+(?!\s*:\s*\S{10})/.test(above) && allowReason(above, rule.id) === null) bareStillFires++;
        }
      }
    }
    expect(exempted).toBeGreaterThanOrEqual(rules.length);
    expect(bareStillFires).toBeGreaterThanOrEqual(rules.length);
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

describe("escape hatch", () => {
  test("needs a reason of at least 10 characters", () => {
    expect(allowReason("// vs-allow no-raw-palette: vendor logo colour", "no-raw-palette")).toBe("vendor logo colour");
    expect(allowReason("// vs-allow no-raw-palette: ten chars!", "no-raw-palette")).toBe("ten chars!");
    expect(allowReason("// vs-allow no-raw-palette: short", "no-raw-palette")).toBeNull();
    expect(allowReason("// vs-allow no-raw-palette", "no-raw-palette")).toBeNull();
    expect(allowReason("// vs-allow no-raw-palette:", "no-raw-palette")).toBeNull();
    expect(allowReason("// vs-allow no-raw-palette:            ", "no-raw-palette")).toBeNull();
  });
  test("is specific to one rule", () => {
    expect(allowReason("// vs-allow no-bounce-motion: a long enough reason", "no-raw-palette")).toBeNull();
  });
  test("a vs-allow inside a string does not count", () => {
    expect(allowReason('const s = "vs-allow no-raw-palette: a long enough reason"', "no-raw-palette")).toBeNull();
  });
  test("only the line directly above exempts", () => {
    const src = "// vs-allow no-raw-palette: a long enough reason\n\nbg-white\n";
    const f = { ruleId: "no-raw-palette", line: 3, column: 1 };
    expect(applyExemptions(src, [f]).findings).toEqual([f]);
    const src2 = "// vs-allow no-raw-palette: a long enough reason\nbg-white\n";
    expect(applyExemptions(src2, [{ ...f, line: 2 }]).exempt.length).toBe(1);
  });
  test("a block comment form closes cleanly", () => {
    expect(allowReason("{/* vs-allow no-raw-palette: a long enough reason */}", "no-raw-palette")).toBe("a long enough reason");
  });
});

describe("comment masking", () => {
  test("keeps length, lines and columns", () => {
    const src = 'const a = 1; // bg-white\n/* bg-white\n bg-white */ const b = "//bg-white";\n';
    const masked = maskComments(src);
    expect(masked.length).toBe(src.length);
    expect(masked.split("\n").length).toBe(src.split("\n").length);
    expect(masked).not.toContain("// bg-white");
    expect(masked).toContain('"//bg-white"');
  });
  test("an apostrophe in JSX text does not swallow the rest of the line", () => {
    const masked = maskComments(`<p>Don't</p> <b className="x">y</b> // c\n`);
    expect(masked).toContain('className="x"');
    expect(masked).not.toContain("// c");
  });
  test("a rule does not fire on a commented-out class", () => {
    const src = 'const a = "ok"; // bg-white\n/* <p className="bg-white"> */\n';
    expect(checkContent(rules, "x.tsx", src).findings).toEqual([]);
  });
});
