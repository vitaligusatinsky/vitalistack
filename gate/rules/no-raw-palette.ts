import { classGroups, finding, LineIndex, type Rule } from "../scan";

const ID = "no-raw-palette";
const PREFIX =
  "(?:bg|text|border(?:-[xytblrse])?|ring(?:-offset)?|outline|fill|stroke|from|via|to|divide|decoration|shadow|accent|caret|placeholder)";
const PALETTE =
  "(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)";
const RAW = new RegExp(`^${PREFIX}-(?:${PALETTE}-\\d{2,3}|black|white)(?:/\\S+)?$`);

const rule: Rule = {
  id: ID,
  title: "Tailwind default palette colour",
  why: "Coding agents colour UI with Tailwind's default palette (bg-blue-500, text-gray-600), which bypasses the design tokens and drifts from them.",
  fix: "Use a semantic token such as bg-surface, text-ink, text-ink-muted, bg-accent or border-border. Add a token to src/styles/tokens.css if none fits.",
  check(file, masked) {
    const lines = new LineIndex(masked);
    const out = [];
    for (const group of classGroups(file, masked)) {
      for (const t of group.tokens) if (RAW.test(t.base)) out.push(finding(ID, lines, t.index));
    }
    return out;
  },
};

export default rule;
