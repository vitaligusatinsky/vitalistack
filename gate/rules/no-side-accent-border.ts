import { classGroups, finding, type Analysis, type Finding, type Rule } from "../scan";

const ID = "no-side-accent-border";
// Left / start only. Right and end borders are split panes and sidebars, not accent bars.
const TW_SIDE = /^border-(?:l|s)-(?:(\d+)|\[(\d*\.?\d+)(px|rem|em)\])$/;
const CSS_SIDE = /\bborder-(?:left|inline-start)(?:-width)?\s*:\s*([^;}\n]*)/g;
const CSS_WIDTH = /\bborder-width\s*:\s*([^;}\n]*)/g;
const JS_SIDE = /\bborder(?:Left|InlineStart)(?:Width)?\s*:\s*([^,}\n]*)/g;
const JS_WIDTH = /\bborderWidth\s*:\s*([^,}\n]*)/g;

function px(n: number, unit: string | undefined): number {
  return unit === "rem" || unit === "em" ? n * 16 : n;
}

/** Width in px of the first length in a border value; null when there is none. */
function widthPx(value: string, jsNumber: boolean): number | null {
  const length = /(\d*\.?\d+)\s*(px|rem|em)\b/.exec(value);
  if (length) return px(Number(length[1]), length[2]);
  if (/\b(?:medium|thick)\b/.test(value)) return 3;
  if (jsNumber && /^\s*\d*\.?\d+\s*$/.test(value)) return Number(value);
  return null;
}

/** `border-width: 0 0 0 4px`: a thick left edge with a thin right edge. */
function fourValueLeft(value: string): boolean {
  const parts = value.replace(/["'`]/g, "").trim().split(/\s+/);
  if (parts.length !== 4) return false;
  const [right, left] = [widthPx(parts[1]!, true) ?? 0, widthPx(parts[3]!, true) ?? 0];
  return left >= 2 && right < 2;
}

const rule: Rule = {
  id: ID,
  title: "Thick border on the left edge used as an accent bar",
  why: "Coding agents mark cards and callouts with a coloured left border of 2px or more, which signals generated design.",
  fix: "Use a full border, a background tint, or an icon. A 1px divider is fine.",
  check(file: string, masked: string, info: Analysis): Finding[] {
    const out: Finding[] = [];
    for (const group of classGroups(info)) {
      // A full border set in the same class list (border-4, border) at least as wide makes it a box, not a bar.
      const full = (variant: string) =>
        Math.max(0, ...group.tokens.filter((t) => t.variant === variant).map((t) => (t.base === "border" ? 1 : /^border-(\d+)$/.test(t.base) ? Number(t.base.slice(7)) : 0)));
      for (const t of group.tokens) {
        const m = TW_SIDE.exec(t.base);
        if (!m) continue;
        const width = m[1] !== undefined ? Number(m[1]) : px(Number(m[2]), m[3]);
        if (width >= 2 && full(t.variant) < width) out.push(finding(ID, info.lines, t.index));
      }
    }
    for (const m of masked.matchAll(CSS_SIDE)) {
      const w = widthPx(m[1]!, false);
      if (w !== null && w >= 2) out.push(finding(ID, info.lines, m.index!));
    }
    for (const m of masked.matchAll(CSS_WIDTH)) if (fourValueLeft(m[1]!)) out.push(finding(ID, info.lines, m.index!));
    if (!file.endsWith(".css")) {
      for (const m of masked.matchAll(JS_SIDE)) {
        const w = widthPx(m[1]!.replace(/["'`]/g, ""), true);
        if (w !== null && w >= 2) out.push(finding(ID, info.lines, m.index!));
      }
      for (const m of masked.matchAll(JS_WIDTH)) if (fourValueLeft(m[1]!)) out.push(finding(ID, info.lines, m.index!));
    }
    return out;
  },
};

export default rule;
