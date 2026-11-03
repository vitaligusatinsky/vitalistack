import { COLOR_LITERAL, hueOf } from "../color";
import { classGroups, finding, matchingParen, type Analysis, type Finding, type Rule } from "../scan";

const ID = "no-default-ai-gradient";
const STOP = /^(from|via|to)-(purple|violet|indigo|fuchsia|blue|pink|rose)-\d{2,3}(?:\/\S+)?$/;
const ARBITRARY_STOP = /^(?:from|via|to)-\[(#[0-9a-fA-F]{3,8})\]$/;
const FIRST = new Set(["purple", "violet", "indigo", "fuchsia"]);
const SECOND = new Set(["indigo", "blue", "purple", "violet", "fuchsia", "pink", "rose"]);

// Blue-violet to pink. Widened from 250..330 so that #667eea (229 degrees) paired with
// #764ba2 (270 degrees), the best-known purple gradient, is caught.
const BAND: [number, number] = [225, 335];
const PURPLE_SIDE = 255;

function inBand(hue: number): boolean {
  return hue >= BAND[0] && hue <= BAND[1];
}

/** True when two or more stops sit in the blue-violet-to-pink band, one of them on the purple side. */
function purpleStops(colours: string[]): boolean {
  const hues = colours.map(hueOf).filter((h): h is NonNullable<typeof h> => !!h && h.saturated && inBand(h.hue));
  return hues.length >= 2 && hues.some((h) => h.hue >= PURPLE_SIDE);
}

const rule: Rule = {
  id: ID,
  title: "Default purple-to-indigo gradient or gradient text",
  why: "Coding agents reach for a purple, indigo or pink gradient and gradient-clipped headline text when asked for something modern.",
  fix: "Use a flat token colour. Emphasise text with weight or size, not a gradient fill.",
  check(file: string, masked: string, info: Analysis): Finding[] {
    const lines = info.lines;
    const out: Finding[] = [];
    for (const group of classGroups(info)) {
      // Stops pair only within the same variant prefix: dark:from-* goes with dark:to-*.
      const byVariant = new Map<string, Array<{ colour: string; hex?: string; index: number }>>();
      for (const t of group.tokens) {
        const m = STOP.exec(t.base);
        const a = ARBITRARY_STOP.exec(t.base);
        if (!m && !a) continue;
        const list = byVariant.get(t.variant) ?? [];
        list.push(m ? { colour: m[2]!, index: t.index } : { colour: "", hex: a![1]!, index: t.index });
        byVariant.set(t.variant, list);
      }
      for (const stops of byVariant.values()) {
        for (let i = 0; i < stops.length; i++) {
          const a = stops[i]!;
          if (a.colour && FIRST.has(a.colour) && stops.some((b, j) => j !== i && b.colour && SECOND.has(b.colour))) {
            out.push(finding(ID, lines, a.index));
            break;
          }
        }
        const hexes = stops.filter((s) => s.hex);
        if (hexes.length >= 2 && purpleStops(hexes.map((s) => s.hex!))) out.push(finding(ID, lines, hexes[0]!.index));
      }
      const clip = group.tokens.find((t) => t.base === "bg-clip-text");
      if (clip && group.tokens.some((t) => t.base === "text-transparent" && t.variant === clip.variant)) out.push(finding(ID, lines, clip.index));
    }
    // linear-gradient(...), radial-gradient(...), conic-gradient(...) anywhere: CSS, style strings, arbitrary values.
    for (const m of masked.matchAll(/\b(?:linear|radial|conic)-gradient\(/g)) {
      const open = m.index! + m[0].length - 1;
      const body = masked.slice(open, matchingParen(masked, open));
      if (purpleStops(body.match(COLOR_LITERAL) ?? [])) out.push(finding(ID, lines, m.index!));
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
