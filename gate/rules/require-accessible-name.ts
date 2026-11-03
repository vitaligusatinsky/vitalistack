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
