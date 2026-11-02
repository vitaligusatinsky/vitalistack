import { classGroups, finding, LineIndex, type Finding, type Rule } from "../scan";

const ID = "no-default-ai-gradient";
const STOP = /^(from|via|to)-(purple|violet|indigo|fuchsia|blue)-\d{2,3}(?:\/\S+)?$/;
const FIRST = new Set(["purple", "violet", "indigo", "fuchsia"]);
const SECOND = new Set(["indigo", "blue", "purple", "violet", "fuchsia"]);

const rule: Rule = {
  id: ID,
  title: "Default purple-to-indigo gradient or gradient text",
  why: "Coding agents reach for a purple-indigo gradient and gradient-clipped headline text when asked for something modern.",
  fix: "Use a flat token colour. Emphasise text with weight or size, not a gradient fill.",
  check(file, masked) {
    const lines = new LineIndex(masked);
    const out: Finding[] = [];
    for (const group of classGroups(file, masked)) {
      const stops = group.tokens.flatMap((t) => {
        const m = STOP.exec(t.base);
        return m ? [{ colour: m[2]!, index: t.index }] : [];
      });
      for (let i = 0; i < stops.length; i++) {
        const a = stops[i]!;
        if (!FIRST.has(a.colour)) continue;
        if (stops.some((b, j) => j !== i && SECOND.has(b.colour))) {
          out.push(finding(ID, lines, a.index));
          break;
        }
      }
      const clip = group.tokens.find((t) => t.base === "bg-clip-text");
      if (clip && group.tokens.some((t) => t.base === "text-transparent")) out.push(finding(ID, lines, clip.index));
    }
    if (file.endsWith(".css")) {
      for (const block of masked.matchAll(/\{([^{}]*)\}/g)) {
        const body = block[1]!;
        const clip = /(?:-webkit-)?background-clip\s*:\s*text/.exec(body);
        if (clip && /(?:-webkit-text-fill-color|(?<![\w-])color)\s*:\s*transparent/.test(body)) {
          out.push(finding(ID, lines, block.index! + 1 + clip.index));
        }
      }
    } else {
      for (const m of masked.matchAll(/\b(?:Webkit|webkit)?[bB]ackgroundClip\s*:\s*["'`]text/g)) {
        out.push(finding(ID, lines, m.index!));
      }
    }
    return out;
  },
};

export default rule;
