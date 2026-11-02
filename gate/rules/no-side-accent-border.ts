import { classGroups, finding, LineIndex, type Finding, type Rule } from "../scan";

const ID = "no-side-accent-border";
const TW_SIDE = /^border-(?:l|s|r|e)-(?:(\d+)|\[(\d*\.?\d+)px\])$/;
const CSS_SIDE = /\bborder-(?:left|right|inline-start|inline-end)(?:-width)?\s*:\s*([^;}\n]*)/g;
const JS_SIDE = /\bborder(?:Left|Right|InlineStart|InlineEnd)(?:Width)?\s*:\s*([^,}\n]*)/g;

/** Width in px of the first length in a border value; null when there is none. */
function widthPx(value: string, jsNumber: boolean): number | null {
  const length = /(\d*\.?\d+)\s*(px|rem|em)\b/.exec(value);
  if (length) {
    const n = Number(length[1]);
    return length[2] === "px" ? n : n * 16;
  }
  if (/\b(?:medium|thick)\b/.test(value)) return 3;
  if (jsNumber && /^\s*\d*\.?\d+\s*$/.test(value)) return Number(value);
  return null;
}

const rule: Rule = {
  id: ID,
  title: "Thick border on one side used as an accent bar",
  why: "Coding agents mark cards and callouts with a coloured left border of 2px or more, which signals generated design.",
  fix: "Use a full border, a background tint, or an icon. A 1px divider is fine.",
  check(file, masked) {
    const lines = new LineIndex(masked);
    const out: Finding[] = [];
    for (const group of classGroups(file, masked)) {
      for (const t of group.tokens) {
        const m = TW_SIDE.exec(t.base);
        if (!m) continue;
        if (Number(m[1] ?? m[2]) >= 2) out.push(finding(ID, lines, t.index));
      }
    }
    for (const m of masked.matchAll(CSS_SIDE)) {
      const w = widthPx(m[1]!, false);
      if (w !== null && w >= 2) out.push(finding(ID, lines, m.index!));
    }
    if (!file.endsWith(".css")) {
      for (const m of masked.matchAll(JS_SIDE)) {
        const w = widthPx(m[1]!.replace(/["'`]/g, ""), true);
        if (w !== null && w >= 2) out.push(finding(ID, lines, m.index!));
      }
    }
    return out;
  },
};

export default rule;
