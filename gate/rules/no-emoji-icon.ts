import ts from "typescript-js";
import { finding, type Analysis, type Finding, type Rule } from "../scan";

const ID = "no-emoji-icon";
// Extended_Pictographic includes (c), (R), TM and the arrow block; those are text, not icons.
const PICTO = /\p{Extended_Pictographic}/u;
const NOT_ICON = /[©®™←-⇿]/gu;
const STRING_PROPS = new Set(["label", "title", "aria-label", "alt", "placeholder"]);
const TAGS = new Set(["nav", "header", "button", "a", "li", "h1", "h2", "h3", "h4", "h5", "h6"]);
const NAME_SUFFIX = /(?:Button|Link|NavItem|Title|Heading)$/;

function hasEmoji(text: string): number {
  const cleaned = text.replace(NOT_ICON, " ");
  const m = PICTO.exec(cleaned);
  return m ? m.index : -1;
}

/** Does the text begin with an emoji, ignoring leading space? */
function startsWithEmoji(text: string): boolean {
  return /^\s*\p{Extended_Pictographic}/u.test(text.replace(NOT_ICON, " ").replace(/^\s+/, " ").replace(/^ (?=\p{Extended_Pictographic})/u, ""));
}

/** Only emoji, joiners and space: a decorative glyph in its own element. */
const ONLY_EMOJI = /^(?:\s|\p{Extended_Pictographic}|‍|️|\p{Emoji_Modifier})+$/u;

function tagName(el: ts.Node, sf: ts.SourceFile): string | null {
  if (ts.isJsxElement(el)) return el.openingElement.tagName.getText(sf);
  if (ts.isJsxSelfClosingElement(el)) return el.tagName.getText(sf);
  return null;
}

function isToast(e: ts.Expression): boolean {
  return (ts.isIdentifier(e) && e.text === "toast") || (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === "toast");
}

/** Is this string inside a { ... } child of a JSX element (not an attribute value)? */
function inChildExpression(node: ts.Node): boolean {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if (ts.isJsxAttribute(n) || ts.isArrowFunction(n) || ts.isFunctionLike(n)) return false;
    if (ts.isJsxExpression(n)) return ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent);
  }
  return false;
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
      // <div className="text-4xl">🚀</div>: an element holding nothing but emoji, any tag.
      if (ts.isJsxElement(node) && node.children.length > 0) {
        const texts = node.children.filter(ts.isJsxText);
        const joined = texts.map((t) => t.text).join("");
        if (texts.length === node.children.length && joined.trim() !== "" && ONLY_EMOJI.test(joined) && hasEmoji(joined) >= 0) {
          flag(texts[0]!.pos, texts[0]!.text);
        }
      }
      // {"🚀 Launch"} and {cond ? "🔽 Less" : "More"} as children in an icon context.
      if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && inChildExpression(node) && inIconContext(node, sf)) {
        flag(node.getStart(sf) + 1, node.text);
      }
      // toast("🎉 Saved"), toast.success("✅ Done")
      if (ts.isCallExpression(node) && isToast(node.expression) && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0]!)) {
        const arg = node.arguments[0] as ts.StringLiteralLike;
        if (startsWithEmoji(arg.text)) flag(arg.getStart(sf) + 1, arg.text);
      }
      if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
        const name = node.name.getText(sf);
        const tag = node.parent.parent;
        if ((STRING_PROPS.has(name) && inIconContext(tag, sf)) || name === "icon" || name === "emoji") flag(node.initializer.getStart(sf) + 1, node.initializer.text);
      }
      if (ts.isPropertyAssignment(node) && (ts.isStringLiteralLike(node.initializer))) {
        const key = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : "";
        if (key === "icon" || key === "emoji") flag(node.initializer.getStart(sf) + 1, node.initializer.text);
        if ((key === "label" || key === "title") && startsWithEmoji(node.initializer.text)) flag(node.initializer.getStart(sf) + 1, node.initializer.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    return out;
  },
};

export default rule;
