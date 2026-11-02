import { finding, LineIndex, scanLiterals, type Rule } from "../scan";

const ID = "no-decorative-numbering";
const MARKER = /^(?:\/\s*)?0[1-9]\.?$/;
const PAD = /\.padStart\(\s*2\s*,\s*(["'`])0\1\s*\)/g;

const rule: Rule = {
  id: ID,
  title: "Decorative 01 / 02 / 03 numbering",
  why: "Coding agents label sections and cards with zero-padded index numbers as decoration, and the numbers carry no information.",
  fix: "Remove the number. If order matters, use a real ordered list (<ol>) or a plain step label such as 'Step 1'.",
  check(file, masked) {
    const lines = new LineIndex(masked);
    const out = [];
    for (const lit of scanLiterals(masked)) {
      if (MARKER.test(lit.text.trim())) out.push(finding(ID, lines, lit.start + lit.text.indexOf(lit.text.trim())));
    }
    if (file.endsWith(".tsx")) {
      for (const m of masked.matchAll(/[>}]([^<>{}]*)[<{]/g)) {
        const text = m[1]!;
        if (MARKER.test(text.trim())) out.push(finding(ID, lines, m.index! + 1 + text.indexOf(text.trim())));
      }
      for (const m of masked.matchAll(PAD)) out.push(finding(ID, lines, m.index!));
    }
    return out;
  },
};

export default rule;
