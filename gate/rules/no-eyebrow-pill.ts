import { classGroups, finding, LineIndex, type Rule } from "../scan";

const ID = "no-eyebrow-pill";
const TRACKED = /^tracking-(?:wide|wider|widest|\[(?!-|0(?:\.0+)?(?:em|px|rem)?\]).+\])$/;
const HEADING = /<h[123]\b/;

const rule: Rule = {
  id: ID,
  title: "Small uppercase letter-spaced label used as a section kicker (eyebrow / pill)",
  why: "Coding agents add an uppercase, letter-spaced eyebrow above every heading by default, and it signals generated design.",
  fix: "Drop the label, or state the point in the heading itself. A status badge with real meaning may use uppercase without letter-spacing.",
  check(file, masked) {
    const lines = new LineIndex(masked);
    const rows = masked.split("\n");
    const out = [];
    for (const group of classGroups(file, masked)) {
      const upper = group.tokens.find((t) => t.base === "uppercase");
      if (!upper) continue;
      const tracked = group.tokens.some((t) => TRACKED.test(t.base));
      if (!tracked) continue;
      const pill = group.tokens.some((t) => t.base === "rounded-full");
      let kicker = false;
      if (!pill) {
        // A heading opening on the same line or within the next 3 lines.
        const last = lines.at(group.end).line;
        const from = lines.at(group.end).column;
        const sameLine = (rows[last - 1] ?? "").slice(from - 1);
        kicker = HEADING.test(sameLine);
        for (let l = last + 1; l <= last + 3 && !kicker; l++) kicker = HEADING.test(rows[l - 1] ?? "");
      }
      if (pill || kicker) out.push(finding(ID, lines, upper.index));
    }
    return out;
  },
};

export default rule;
