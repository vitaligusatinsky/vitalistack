import ts from "typescript-js";
import { classGroups, finding, type Analysis, type Finding, type Rule } from "../scan";

const ID = "no-bounce-motion";
const BEZIER = /cubic-bezier\(([^)]*)\)/g;
const EASE_ARRAY = /\bease\s*:\s*\[([^\]]*)\]/g;
const EASE_NAME = /\bease\s*:\s*["'`](?:backIn|backOut|backInOut|anticipate)["'`]/g;
const BOUNCE_ANIMATION = /\banimation(?:-name)?\s*:\s*[^;}\n]*\bbounce\b/g;
const NUM = /-?\d*\.?\d+/g;
const MOTION_IMPORT = /\bfrom\s*["'](?:motion|motion\/react|framer-motion|react-spring|@react-spring\/[\w-]+)["']/;

/** y1 or y2 outside 0..1 means the curve overshoots. */
function overshoots(args: string): boolean {
  const n = (args.match(NUM) ?? []).map(Number);
  if (n.length !== 4) return false;
  return [n[1]!, n[3]!].some((y) => y < 0 || y > 1);
}

function num(node: ts.Expression | undefined): number | null {
  if (!node) return null;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) return -Number(node.operand.text);
  return null;
}

function propName(p: ts.ObjectLiteralElementLike, sf: ts.SourceFile): string | null {
  return ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : (p.name ? p.name.getText(sf) : null);
}

/** Is any ancestor a `transition` property or attribute? */
function inTransition(node: ts.Node, sf: ts.SourceFile): boolean {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if (ts.isPropertyAssignment(n) && /^transition/.test(n.name.getText(sf))) return true;
    if (ts.isJsxAttribute(n) && /^transition/.test(n.name.getText(sf))) return true;
  }
  return false;
}

/**
 * Underdamped when damping / (2 * sqrt(stiffness * mass)) < 1. Defaults are the
 * motion library's: stiffness 100, damping 10, mass 1 (a bouncy spring).
 */
export function dampingRatio(stiffness = 100, damping = 10, mass = 1): number {
  return damping / (2 * Math.sqrt(stiffness * mass));
}

const rule: Rule = {
  id: ID,
  title: "Bounce or overshoot motion",
  why: "Coding agents add bouncy springs and overshooting easing curves by default, which reads as playful noise in product UI.",
  fix: "Use ease-out or ease-in-out with a duration token, or a spring with bounce: 0 (critically damped).",
  check(file: string, masked: string, info: Analysis): Finding[] {
    const lines = info.lines;
    const out: Finding[] = [];
    for (const group of classGroups(info)) {
      for (const t of group.tokens) {
        if (t.base === "animate-bounce" || t.base.startsWith("animate-[bounce")) out.push(finding(ID, lines, t.index));
      }
    }
    for (const m of masked.matchAll(BEZIER)) if (overshoots(m[1]!)) out.push(finding(ID, lines, m.index!));
    for (const m of masked.matchAll(EASE_ARRAY)) if (overshoots(m[1]!)) out.push(finding(ID, lines, m.index!));
    for (const m of masked.matchAll(EASE_NAME)) out.push(finding(ID, lines, m.index!));
    for (const m of masked.matchAll(BOUNCE_ANIMATION)) out.push(finding(ID, lines, m.index!));

    const sf = info.ast;
    if (!sf) return out;
    const motionFile = MOTION_IMPORT.test(masked);

    // const EASE = [0.34, 1.56, 0.64, 1] ... { ease: EASE }
    const overshooting = new Set<string>();
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
        if (overshoots(node.initializer.elements.map((e) => e.getText(sf)).join(","))) overshooting.add(node.name.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);

    const walk = (node: ts.Node) => {
      if (ts.isPropertyAssignment(node) && propName(node, sf) === "ease" && ts.isIdentifier(node.initializer) && overshooting.has(node.initializer.text)) {
        out.push(finding(ID, lines, node.initializer.getStart(sf)));
      }
      if (ts.isObjectLiteralExpression(node)) {
        const props = new Map<string, ts.PropertyAssignment>();
        for (const p of node.properties) {
          const name = propName(p, sf);
          if (name && ts.isPropertyAssignment(p)) props.set(name, p);
        }
        const inScope = motionFile || inTransition(node, sf);
        const type = props.get("type");
        const isSpring = !!type && ts.isStringLiteralLike(type.initializer) && type.initializer.text === "spring";
        const bounce = props.get("bounce");
        const bounceValue = bounce ? num(bounce.initializer) : null;
        if (inScope && bounce && bounceValue !== null && bounceValue > 0) out.push(finding(ID, lines, bounce.getStart(sf)));
        if (inScope && isSpring && !bounce) {
          const has = (k: string) => props.has(k);
          const physics = ["stiffness", "damping", "mass"].filter(has);
          const values = physics.map((k) => num(props.get(k)!.initializer));
          if (values.every((v) => v !== null)) {
            const get = (k: string) => (has(k) ? num(props.get(k)!.initializer)! : undefined);
            const durationBased = (has("duration") || has("visualDuration")) && physics.length === 0;
            // Duration-based springs default to bounce 0.25 in the motion library.
            if (durationBased || (!durationBased && dampingRatio(get("stiffness"), get("damping"), get("mass")) < 1)) {
              out.push(finding(ID, lines, type!.getStart(sf)));
            }
          }
        }
      }
      ts.forEachChild(node, walk);
    };
    walk(sf);
    return out;
  },
};

export default rule;
