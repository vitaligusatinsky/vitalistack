import ts from "typescript-js";
import { finding, type Analysis, type Finding, type Rule, ALL_EXT, CSS_EXT, isMd } from "../scan";
import { PHRASES } from "./copy-phrases";

const ID = "no-slop-copy";

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function phraseRegex(phrase: string): RegExp {
  const body = [...phrase]
    .map((c) => (c === " " ? "\\s+" : c === "-" ? "[-\\s]" : c === "'" ? "['’]" : escape(c)))
    .join("");
  return new RegExp(`(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])`, "giu");
}

const MATCHERS = PHRASES.map(phraseRegex);
const EM_DASH = /—|&mdash;|&#8212;|&#x2014;/gi;

function scan(text: string, offset: number, info: Analysis, out: Finding[]) {
  for (const re of MATCHERS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) out.push(finding(ID, info.lines, offset + m.index!));
  }
  for (const m of text.matchAll(EM_DASH)) out.push(finding(ID, info.lines, offset + m.index!));
}

const SKIP_ATTRS = new Set(["className", "class", "key", "id", "href", "to", "src", "htmlFor"]);

/** Ranges of strings that are code, not copy: module specifiers, class names, data-*, key, id, href, to. */
function codeStringRanges(sf: ts.SourceFile): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const add = (n: ts.Node) => out.push([n.getStart(sf), n.end]);
  const visit = (n: ts.Node) => {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier) add(n.moduleSpecifier);
    if (ts.isImportTypeNode(n)) add(n);
    if (ts.isCallExpression(n) && n.arguments[0]) {
      const callee = n.expression;
      if (callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === "require")) add(n.arguments[0]);
    }
    if (ts.isJsxAttribute(n)) {
      const name = n.name.getText(sf);
      if (SKIP_ATTRS.has(name) || name.startsWith("data-")) out.push([n.getStart(sf), n.end]);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

const rule: Rule = {
  id: ID,
  title: "Banned copy phrase or em dash",
  why: "Coding agents fill copy with stock marketing phrases and em dashes, which reads as machine-written.",
  fix: "Say the plain thing in your own words, and use a comma, colon or full stop instead of an em dash. Edit gate/rules/copy-phrases.ts to change the list.",
  extensions: ALL_EXT.filter((e) => !CSS_EXT.includes(e)),
  check(file: string, masked: string, info: Analysis): Finding[] {
    const out: Finding[] = [];
    if (isMd(file)) scan(masked, 0, info, out);
    else {
      const skip = info.ast ? codeStringRanges(info.ast) : [];
      for (const l of info.literals) if (!skip.some(([a, b]) => l.start >= a && l.end <= b)) scan(l.text, l.start, info, out);
      for (const l of info.jsxText) scan(l.text, l.start, info, out);
    }
    return out;
  },
};

export default rule;
