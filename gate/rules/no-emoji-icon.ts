import ts from "typescript-js";
import { finding, type Analysis, type Finding, type Rule } from "../scan";

const ID = "no-emoji-icon";
// Extended_Pictographic includes (c), (R), TM and the arrow block; those are text, not icons.
const PICTO = /\p{Extended_Pictographic}/u;
const NOT_ICON = /[©®™←-⇿]/gu;
const STRING_PROPS = new Set(["label", "title", "aria-label", "alt", "placeholder"]);
const TAGS = new Set(["nav", "header", "button", "a", "li", "h1", "h2", "h3", "h4"]);
const NAME_SUFFIX = /(?:Button|Link|NavItem|Title|Heading)$/;

function hasEmoji(text: string): number {
  const cleaned = text.replace(NOT_ICON, " ");
  const m = PICTO.exec(cleaned);
  return m ? m.index : -1;
}

function tagName(el: ts.Node, sf: ts.SourceFile): string | null {
  if (ts.isJsxElement(el)) return el.openingElement.tagName.getText(sf);
  if (ts.isJsxSelfClosingElement(el)) return el.tagName.getText(sf);
  return null;
}

function interesting(name: string): boolean {
  return TAGS.has(name) || NAME_SUFFIX.test(name);
}

/** Is `node` inside a JSX element that is a nav, header, button, link, list item, heading or such a component? */
function inIconContext(node: ts.Node, sf: ts.SourceFile): boolean {
  for (let n: ts.Node | undefined = node; n; n = n.parent) {
    const name = tagName(n, sf);
    if (name && interesting(name)) return true;
  }
  return false;
}

const rule: Rule = {
  id: ID,
  title: "Emoji used as an icon or bullet",
  why: "Coding agents put emoji in nav, buttons, list items and feature cards where an icon belongs, which signals generated design.",
  fix: "Use an icon from your icon set, or no icon. Emoji in user-written text is fine.",
  check(_file: string, _masked: string, info: Analysis): Finding[] {
    const sf = info.ast;
    if (!sf) return [];
    const out: Finding[] = [];
    const flag = (start: number, text: string) => {
      const at = hasEmoji(text);
      if (at >= 0) out.push(finding(ID, info.lines, start + at));
    };
    const visit = (node: ts.Node) => {
      if (ts.isJsxText(node) && inIconContext(node, sf)) flag(node.pos, node.text);
      if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
        const name = node.name.getText(sf);
        const tag = node.parent.parent;
        if ((STRING_PROPS.has(name) && inIconContext(tag, sf)) || name === "icon") flag(node.initializer.getStart(sf) + 1, node.initializer.text);
      }
      if (ts.isPropertyAssignment(node) && (ts.isStringLiteralLike(node.initializer))) {
        const key = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : "";
        if (key === "icon") flag(node.initializer.getStart(sf) + 1, node.initializer.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    return out;
  },
};

export default rule;
