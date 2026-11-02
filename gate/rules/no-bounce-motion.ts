import { classGroups, finding, LineIndex, matchingClose, type Finding, type Rule } from "../scan";

const ID = "no-bounce-motion";
const BEZIER = /cubic-bezier\(([^)]*)\)/g;
const EASE_ARRAY = /\bease\s*:\s*\[([^\]]*)\]/g;
const NUM = /-?\d*\.?\d+/g;

/** y1 or y2 outside 0..1 means the curve overshoots. */
function overshoots(args: string): boolean {
  const n = (args.match(NUM) ?? []).map(Number);
  if (n.length !== 4) return false;
  return [n[1]!, n[3]!].some((y) => y < 0 || y > 1);
}

const rule: Rule = {
  id: ID,
  title: "Bounce or overshoot motion",
  why: "Coding agents add bouncy springs and overshooting easing curves by default, which reads as playful noise in product UI.",
  fix: "Use ease-out or ease-in-out with a duration token, or a spring with bounce: 0.",
  check(file, masked) {
    const lines = new LineIndex(masked);
    const out: Finding[] = [];
    for (const group of classGroups(file, masked)) {
      for (const t of group.tokens) if (t.base === "animate-bounce") out.push(finding(ID, lines, t.index));
    }
    for (const m of masked.matchAll(BEZIER)) if (overshoots(m[1]!)) out.push(finding(ID, lines, m.index!));
    for (const m of masked.matchAll(EASE_ARRAY)) if (overshoots(m[1]!)) out.push(finding(ID, lines, m.index!));
    if (file.endsWith(".css")) return out;
    for (const m of masked.matchAll(/\bbounce\s*:\s*(-?\d*\.?\d+)/g)) {
      if (Number(m[1]) > 0) out.push(finding(ID, lines, m.index!));
    }
    for (const m of masked.matchAll(/\btype\s*:\s*["'`]spring["'`]/g)) {
      // Find the object literal that holds this `type`.
      let open = m.index!;
      for (let depth = 0; open > 0; open--) {
        const c = masked[open - 1];
        if (c === "}") depth++;
        else if (c === "{") {
          if (depth === 0) break;
          depth--;
        }
      }
      const body = open > 0 ? masked.slice(open - 1, matchingClose(masked, open - 1)) : "";
      if (!/\bbounce\s*:\s*0(?:\.0+)?\s*[,}\s]/.test(body)) out.push(finding(ID, lines, m.index!));
    }
    return out;
  },
};

export default rule;
