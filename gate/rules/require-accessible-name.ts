import ts from "typescript-js";
import { finding, type Analysis, type Finding, type Rule } from "../scan";

const ID = "require-accessible-name";
const CONTROLS = new Set(["button", "a", "Button", "IconButton", "Link"]);
const NAMING_ATTRS = new Set(["aria-label", "aria-labelledby", "title"]);

function attrs(el: ts.JsxOpeningLikeElement): { names: Set<string>; spread: boolean } {
  const names = new Set<string>();
  let spread = false;
  for (const a of el.attributes.properties) {
    if (ts.isJsxSpreadAttribute(a)) spread = true;
    else names.add(a.name.getText());
  }
  return { names, spread };
}

function unwrap(e: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(e)) e = e.expression;
  return e;
}

function isIcon(node: ts.Node, sf: ts.SourceFile): boolean {
  if (!ts.isJsxSelfClosingElement(node)) return false;
  if (!/^[A-Z]/.test(node.tagName.getText(sf))) return false;
  const a = attrs(node);
  return !a.spread && ![...a.names].some((n) => NAMING_ATTRS.has(n));
}

/**
 * An expression that can only render an icon or nothing: <Icon />, a conditional whose
 * branches are all icons or empty, or `cond && <Icon />`. Returns the icons found, or -1
 * when anything else (text, a variable, another element) can appear.
 */
function iconsIn(raw: ts.Expression, sf: ts.SourceFile): number {
  const e = unwrap(raw);
  if (isIcon(e, sf)) return 1;
  if (e.kind === ts.SyntaxKind.NullKeyword || e.kind === ts.SyntaxKind.FalseKeyword) return 0;
  if (ts.isIdentifier(e) && e.text === "undefined") return 0;
  if (ts.isConditionalExpression(e)) {
    const a = iconsIn(e.whenTrue, sf);
    const b = iconsIn(e.whenFalse, sf);
    return a < 0 || b < 0 ? -1 : a + b;
  }
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return iconsIn(e.right, sf);
  return -1;
}

/** Children that are only PascalCase self-closing components (icons), with no text or expressions. */
function iconOnly(el: ts.JsxElement, sf: ts.SourceFile): boolean {
  let icons = 0;
  for (const child of el.children) {
    if (ts.isJsxText(child)) {
      if (child.text.trim() !== "") return false;
    } else if (ts.isJsxSelfClosingElement(child)) {
      const name = child.tagName.getText(sf);
      if (!/^[A-Z]/.test(name)) return false;
      const a = attrs(child);
      if (a.spread || [...a.names].some((n) => NAMING_ATTRS.has(n))) return false;
      icons++;
    } else if (ts.isJsxExpression(child) && child.expression) {
      const n = iconsIn(child.expression, sf);
      if (n < 0) return false;
      icons += n;
    } else return false;
  }
  return icons > 0;
}

const rule: Rule = {
  id: ID,
  title: "Icon-only control without an accessible name, or image without alt",
  why: "Coding agents ship icon-only buttons and images that a screen reader announces as nothing.",
  fix: "Add aria-label (or visible text) to the control, and an alt attribute to the image (alt=\"\" if decorative).",
  check(_file: string, _masked: string, info: Analysis): Finding[] {
    const sf = info.ast;
    if (!sf) return [];
    const out: Finding[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isJsxElement(node)) {
        const name = node.openingElement.tagName.getText(sf);
        const a = attrs(node.openingElement);
        if (CONTROLS.has(name) && !a.spread && ![...a.names].some((n) => NAMING_ATTRS.has(n)) && iconOnly(node, sf)) {
          out.push(finding(ID, info.lines, node.openingElement.getStart(sf)));
        }
        if (name === "img" && !a.spread && !a.names.has("alt")) out.push(finding(ID, info.lines, node.openingElement.getStart(sf)));
      } else if (ts.isJsxSelfClosingElement(node)) {
        if (node.tagName.getText(sf) === "img") {
          const a = attrs(node);
          if (!a.spread && !a.names.has("alt")) out.push(finding(ID, info.lines, node.getStart(sf)));
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    return out;
  },
};

export default rule;
