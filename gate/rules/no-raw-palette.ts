import { classGroups, finding, type Analysis, type Finding, LineIndex, type Rule } from "../scan";

const ID = "no-raw-palette";
const PREFIX =
  "(?:bg|text|border(?:-[xytblrse])?|ring(?:-offset)?|inset-ring|inset-shadow|outline|fill|stroke|from|via|to|divide|decoration|shadow|accent|caret|placeholder)";
// Every palette name in Tailwind 4.3.4 (node_modules/tailwindcss/theme.css).
const PALETTE =
  "(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|mauve|olive|mist|taupe)";
const RAW = new RegExp(`^${PREFIX}-(?:${PALETTE}-\\d{2,3}|black|white)(?:/\\S+)?$`);
const VAR = new RegExp(`var\\(\\s*--color-${PALETTE}-\\d{2,3}\\s*\\)`, "g");

const rule: Rule = {
  id: ID,
  title: "Tailwind default palette colour",
  why: "Coding agents colour UI with Tailwind's default palette (bg-blue-500, text-gray-600), which bypasses the design tokens and drifts from them.",
  fix: "Use a semantic token such as bg-surface, text-ink, text-ink-muted, bg-accent or border-border. Add a token to src/styles/tokens.css if none fits.",
  check(_file: string, masked: string, info: Analysis): Finding[] {
    const lines: LineIndex = info.lines;
    const out: Finding[] = [];
    for (const group of classGroups(info)) {
      for (const t of group.tokens) if (RAW.test(t.base)) out.push(finding(ID, lines, t.index));
    }
    for (const m of masked.matchAll(VAR)) out.push(finding(ID, lines, m.index!));
    return out;
  },
};

export default rule;
