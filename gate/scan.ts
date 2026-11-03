// Shared engine for the gate: file listing, masking (comments and, for markdown,
// code), literal and class extraction, and the vs-allow escape hatch.
// Code files are tokenised with the TypeScript parser; CSS and markdown have
// small purpose-built maskers. Nothing here needs a dependency at runtime beyond
// the `typescript-js` dev dependency.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript-js";

// ---- types ----------------------------------------------------------------

export type Finding = {
  ruleId: string;
  /** 1-based */
  line: number;
  /** 1-based */
  column: number;
};

export type Rule = {
  id: string;
  title: string;
  /** One sentence naming the failure class (an agent default), never a client or incident. */
  why: string;
  fix: string;
  /** File extensions this rule reads. Defaults to code and CSS (not markdown). */
  extensions?: string[];
  /** `masked` is the file with comments blanked out, same length, same line/column. */
  check(file: string, masked: string, info: Analysis): Finding[];
};

export type Literal = { start: number; end: number; text: string };
export type Comment = { start: number; end: number; text: string; startLine: number; endLine: number; standalone: boolean };

export type Analysis = {
  file: string;
  kind: "code" | "css" | "md";
  text: string;
  masked: string;
  lines: LineIndex;
  comments: Comment[];
  /** String pieces (strings, template pieces); inner ranges. Code files only. */
  literals: Literal[];
  /** JSX text nodes. */
  jsxText: Literal[];
  /** Whole className={...} expressions, cn()/clsx()/cva() argument lists, whole templates, @apply bodies. */
  classSpans: Array<[number, number]>;
  /** Parsed source file for code files. */
  ast?: ts.SourceFile;
};

export const CODE_EXT = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
export const CSS_EXT = [".css"];
export const MD_EXT = [".md", ".mdx"];
export const DEFAULT_EXT = [...CODE_EXT, ...CSS_EXT];
export const ALL_EXT = [...DEFAULT_EXT, ...MD_EXT];

/**
 * The package directory the gate checks: the parent of gate/, wherever the command
 * is run from. GATE_ROOT overrides it (the tests point it at throwaway repositories).
 */
export function packageRoot(): string {
  return process.env.GATE_ROOT || join(import.meta.dir, "..");
}

export function extOf(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot) : "";
}
export const isCss = (file: string) => extOf(file) === ".css";
export const isMd = (file: string) => MD_EXT.includes(extOf(file));
export const isCode = (file: string) => CODE_EXT.includes(extOf(file));

// ---- scope ----------------------------------------------------------------

/** The single exact path that may hold raw visual values. */
export const TOKENS_FILE = "src/styles/tokens.css";

/**
 * Paths (relative to the package directory) the gate never scans. Everything
 * else with a scanned extension is in scope, wherever it lives. Markdown under
 * gate/ is scanned (the docs ship), except the fixtures.
 */
export function shouldIgnore(path: string): boolean {
  const p = path.split("\\").join("/");
  const segs = p.split("/");
  const base = segs[segs.length - 1]!;
  if (segs.some((s) => ["node_modules", ".git", "dist", ".tanstack", ".wrangler"].includes(s))) return true;
  if (p === TOKENS_FILE) return true;
  if (base === "routeTree.gen.ts") return true;
  if (/\.(?:test|spec)\./.test(base)) return true;
  if (segs.length === 1 && /\.config\.[^/]+$/.test(base)) return true; // tool config at the package root only
  if (base.startsWith("CHANGELOG")) return true;
  const top = segs[0]!;
  if (segs.length > 1 && ["scripts", ".github", "public"].includes(top)) return true;
  if (top === "gate" && segs.length > 1) return !isMd(base) || p.startsWith("gate/fixtures/");
  return false;
}

export function hasScannableExtension(path: string, exts: string[] = ALL_EXT): boolean {
  return exts.includes(extOf(path));
}

function git(root: string, args: string[]): { ok: boolean; out: string; err: string } {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  return { ok: r.status === 0, out: r.stdout ?? "", err: r.stderr ?? "" };
}

function walk(root: string, dir: string, out: string[]) {
  let entries: string[];
  try {
    entries = readdirSync(join(root, dir));
  } catch {
    return;
  }
  for (const entry of entries.sort()) {
    if (["node_modules", ".git", "dist", ".tanstack", ".wrangler"].includes(entry)) continue;
    const rel = dir ? `${dir}/${entry}` : entry;
    if (statSync(join(root, rel)).isDirectory()) walk(root, rel, out);
    else out.push(rel);
  }
}

/**
 * Files in scope, relative to `root`. With `rev`, the files of that commit
 * (`git ls-tree`); otherwise tracked plus untracked-and-not-ignored files in the
 * working tree (`git ls-files`), or a plain directory walk outside a repository.
 */
export function listFiles(root: string, rev?: string, exts: string[] = ALL_EXT): string[] {
  let all: string[];
  if (rev) {
    const r = git(root, ["ls-tree", "-r", "--name-only", "-z", "--end-of-options", rev, "--", "."]);
    if (!r.ok) throw new Error(`gate cannot list files of ${rev}: ${r.err.trim()}`);
    all = r.out.split("\0").filter(Boolean);
    // Run from the package directory, ls-tree prints paths relative to it and lists only it.
  } else {
    const r = git(root, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]);
    if (r.ok) all = [...new Set(r.out.split("\0").filter(Boolean))].filter((f) => existsSync(join(root, f)));
    else {
      all = [];
      walk(root, "", all);
    }
  }
  return all.filter((f) => hasScannableExtension(f, exts) && !shouldIgnore(f)).sort();
}

/** Content of `path` at `rev`, or from the working tree when `rev` is undefined. */
export function readAt(root: string, rev: string | undefined, path: string): string {
  if (!rev) return readFileSync(join(root, path), "utf8");
  const r = git(root, ["show", `${rev}:./${path}`]);
  if (!r.ok) throw new Error(`gate cannot read ${path} at ${rev}: ${r.err.trim()}`);
  return r.out;
}

// ---- positions ------------------------------------------------------------

export class LineIndex {
  private starts: number[] = [0];
  constructor(text: string) {
    for (let i = 0; i < text.length; i++) if (text[i] === "\n") this.starts.push(i + 1);
  }
  at(index: number): { line: number; column: number } {
    let lo = 0;
    let hi = this.starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.starts[mid]! <= index) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, column: index - this.starts[lo]! + 1 };
  }
}

export function finding(ruleId: string, lines: LineIndex, index: number): Finding {
  return { ruleId, ...lines.at(index) };
}

// ---- masking --------------------------------------------------------------

function blank(text: string, ranges: Array<[number, number]>): string {
  if (ranges.length === 0) return text;
  const chars = text.split("");
  for (const [s, e] of ranges) for (let i = s; i < e && i < chars.length; i++) if (chars[i] !== "\n") chars[i] = " ";
  return chars.join("");
}

function mkComment(text: string, lines: LineIndex, start: number, end: number): Comment {
  const a = lines.at(start);
  const b = lines.at(Math.max(start, end - 1));
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  let lineEnd = text.indexOf("\n", end);
  if (lineEnd < 0) lineEnd = text.length;
  const around = text.slice(lineStart, start) + text.slice(end, lineEnd);
  return { start, end, text: text.slice(start, end), startLine: a.line, endLine: b.line, standalone: /^[{}\s]*$/.test(around) };
}

/** CSS: comments only, ignoring `/*` inside strings and url(...). */
function cssComments(text: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (c === '"' || c === "'") {
      i++;
      while (i < text.length && text[i] !== c && text[i] !== "\n") i += text[i] === "\\" ? 2 : 1;
      i++;
    } else if (c === "u" && /^url\(\s*[^"'\s)]/i.test(text.slice(i, i + 40)) && !/[\w-]/.test(text[i - 1] ?? " ")) {
      const close = text.indexOf(")", i);
      i = close < 0 ? text.length : close + 1;
    } else if (c === "/" && text[i + 1] === "*") {
      const close = text.indexOf("*/", i + 2);
      const end = close < 0 ? text.length : close + 2;
      out.push([i, end]);
      i = end;
    } else i++;
  }
  return out;
}

/** Markdown: HTML comments are comments; fenced code and inline code are masked. */
function markdownRanges(text: string): { comments: Array<[number, number]>; code: Array<[number, number]> } {
  const comments: Array<[number, number]> = [];
  const code: Array<[number, number]> = [];
  let pos = 0;
  let fence: { ch: string; len: number } | null = null;
  const rows = text.split("\n");
  for (const row of rows) {
    const m = /^ {0,3}(`{3,}|~{3,})/.exec(row);
    if (fence) {
      code.push([pos, pos + row.length]);
      if (m && m[1]![0] === fence.ch && m[1]!.length >= fence.len && row.trim() === m[1]) fence = null;
    } else if (m) {
      fence = { ch: m[1]![0]!, len: m[1]!.length };
      code.push([pos, pos + row.length]);
    } else {
      for (const span of row.matchAll(/(`+)(?!`)([\s\S]*?[^`])\1(?!`)/g)) code.push([pos + span.index!, pos + span.index! + span[0].length]);
    }
    pos += row.length + 1;
  }
  for (const m of text.matchAll(/<!--[\s\S]*?-->/g)) comments.push([m.index!, m.index! + m[0].length]);
  return { comments, code };
}

const CLASS_CALLS = new Set(["cn", "clsx", "cva", "twMerge", "tv", "classNames"]);

function scriptKind(file: string): ts.ScriptKind {
  switch (extOf(file)) {
    case ".tsx": return ts.ScriptKind.TSX;
    case ".jsx": return ts.ScriptKind.JSX;
    case ".js": case ".mjs": case ".cjs": return ts.ScriptKind.JS;
    default: return ts.ScriptKind.TS;
  }
}

function analyzeCode(file: string, text: string, lines: LineIndex): Pick<Analysis, "comments" | "literals" | "jsxText" | "classSpans" | "ast" | "masked"> {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file));
  const ranges = new Map<number, [number, number]>();
  const literals: Literal[] = [];
  const jsxText: Literal[] = [];
  const classSpans: Array<[number, number]> = [];

  const addLiteral = (start: number, end: number) => literals.push({ start, end, text: text.slice(start, end) });

  const visit = (node: ts.Node) => {
    if (node.kind !== ts.SyntaxKind.JsxText) {
      // Same-line comments are trailing trivia of the previous token; the rest are leading.
      for (const r of ts.getLeadingCommentRanges(text, node.pos) ?? []) ranges.set(r.pos, [r.pos, r.end]);
      for (const r of ts.getTrailingCommentRanges(text, node.end) ?? []) ranges.set(r.pos, [r.pos, r.end]);
    }
    switch (node.kind) {
      case ts.SyntaxKind.StringLiteral:
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral: {
        const s = node.getStart(sf);
        addLiteral(s + 1, node.end - 1);
        if (node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral) classSpans.push([s + 1, node.end - 1]);
        break;
      }
      case ts.SyntaxKind.TemplateExpression: {
        const t = node as ts.TemplateExpression;
        classSpans.push([node.getStart(sf) + 1, node.end - 1]);
        addLiteral(t.head.getStart(sf) + 1, t.head.end - 2);
        for (const span of t.templateSpans) {
          const lit = span.literal;
          const isTail = lit.kind === ts.SyntaxKind.TemplateTail;
          addLiteral(lit.getStart(sf) + 1, lit.end - (isTail ? 1 : 2));
        }
        break;
      }
      case ts.SyntaxKind.JsxText:
        jsxText.push({ start: node.pos, end: node.end, text: text.slice(node.pos, node.end) });
        break;
      case ts.SyntaxKind.JsxAttribute: {
        const a = node as ts.JsxAttribute;
        const name = a.name.getText(sf);
        if ((name === "className" || name === "class") && a.initializer && ts.isJsxExpression(a.initializer)) {
          classSpans.push([a.initializer.getStart(sf), a.initializer.end]);
        }
        break;
      }
      case ts.SyntaxKind.CallExpression: {
        const c = node as ts.CallExpression;
        if (ts.isIdentifier(c.expression) && CLASS_CALLS.has(c.expression.text)) classSpans.push([c.arguments.pos, c.arguments.end]);
        break;
      }
    }
    for (const child of node.getChildren(sf)) visit(child);
  };
  visit(sf);

  // Text that merely looks like a comment inside JSX text (<span>//</span>) is not one.
  const rs = [...ranges.values()]
    .filter(([s]) => !jsxText.some((t) => s >= t.start && s < t.end))
    .sort((a, b) => a[0] - b[0]);
  return {
    comments: rs.map(([s, e]) => mkComment(text, lines, s, e)),
    literals,
    jsxText,
    classSpans,
    ast: sf,
    masked: blank(text, rs),
  };
}

export function analyze(file: string, text: string): Analysis {
  const lines = new LineIndex(text);
  if (isCss(file)) {
    const rs = cssComments(text);
    const masked = blank(text, rs);
    const classSpans: Array<[number, number]> = [];
    for (const m of masked.matchAll(/@apply\s+([^;}]+)/g)) {
      const start = m.index! + m[0].length - m[1]!.length;
      classSpans.push([start, start + m[1]!.length]);
    }
    return { file, kind: "css", text, masked, lines, comments: rs.map(([s, e]) => mkComment(text, lines, s, e)), literals: [], jsxText: [], classSpans };
  }
  if (isMd(file)) {
    const { comments, code } = markdownRanges(text);
    const masked = blank(text, [...comments, ...code]);
    return { file, kind: "md", text, masked, lines, comments: comments.map(([s, e]) => mkComment(text, lines, s, e)), literals: [], jsxText: [], classSpans: [] };
  }
  const a = analyzeCode(file, text, lines);
  return { file, kind: "code", text, lines, ...a };
}

/** Compatibility helper: the masked text of a file. */
export function maskComments(content: string, file = "x.tsx"): string {
  return analyze(file, content).masked;
}

// ---- class tokens ---------------------------------------------------------

export type ClassToken = {
  /** Token with variants (md:, hover:, dark:) and leading or trailing ! / - removed. */
  base: string;
  /** The variant prefix ("" when none), used to pair gradient stops. */
  variant: string;
  /** Index of the token start in the masked source. */
  index: number;
};

export type ClassGroup = { start: number; end: number; tokens: ClassToken[] };

const SPLIT = /[^\s"'`{}(),;?&|]+/g;

function tokenize(masked: string, start: number, end: number): ClassToken[] {
  const text = masked.slice(start, end);
  const tokens: ClassToken[] = [];
  for (const m of text.matchAll(SPLIT)) {
    let base = m[0];
    let variant = "";
    const cut = base.includes("[") ? base.lastIndexOf("]:") + 1 : base.lastIndexOf(":");
    if (cut > 0 && base[cut] === ":") {
      variant = base.slice(0, cut);
      base = base.slice(cut + 1);
    }
    base = base.replace(/^[!-]+/, "").replace(/!+$/, "");
    if (base) tokens.push({ base, variant, index: start + m.index! });
  }
  return tokens;
}

/**
 * Places where Tailwind class names live: every string piece, every whole
 * template, every className={...} expression, every cn()/clsx()/cva() call,
 * and each `@apply` in CSS. Several literals in one expression form one group.
 */
export function classGroups(info: Analysis): ClassGroup[] {
  const spans: Array<[number, number]> = [...info.literals.map((l) => [l.start, l.end] as [number, number]), ...info.classSpans];
  return spans.map(([start, end]) => ({ start, end, tokens: tokenize(info.masked, start, end) }));
}

/** Remove findings that point at the same rule, line and column twice. */
export function dedupe(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.ruleId}:${f.line}:${f.column}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---- escape hatch ---------------------------------------------------------

export const MIN_REASON = 10;
const ALLOW = /^\s*vs-allow\s+([a-z][a-z0-9-]*)\s*:\s*([\s\S]*)$/;

function commentBody(c: Comment, file: string): string {
  let t = c.text;
  if (isMd(file)) t = t.replace(/^<!--/, "").replace(/-->$/, "");
  else if (t.startsWith("//")) t = t.slice(2);
  else t = t.replace(/^\/\*+/, "").replace(/\*+\/$/, "");
  return t;
}

/** Parse the body of a real comment into an exemption, or null. */
export function parseAllow(body: string): { ruleId: string; reason: string } | null {
  const m = ALLOW.exec(body.replace(/\s*\n\s*\*?\s*/g, " "));
  if (!m) return null;
  const reason = m[2]!.trim();
  if (reason.length < MIN_REASON || !/\p{L}{3,}/u.test(reason)) return null;
  return { ruleId: m[1]!, reason };
}

export type Exemption = { file: string; line: number; ruleId: string; reason: string };
export type Checked = { findings: Finding[]; exempt: Finding[]; used: Exemption[] };

/**
 * Split findings into blocking ones and ones exempted by a vs-allow comment:
 * a standalone comment exempts the next line, a trailing comment its own line.
 * Only real comment tokens count (not strings, and not `//` in CSS).
 */
export function applyExemptions(info: Analysis, findings: Finding[]): Checked {
  const byLine = new Map<number, Array<{ ruleId: string; reason: string; commentLine: number }>>();
  for (const c of info.comments) {
    if (info.kind === "css" && c.text.startsWith("//")) continue;
    const allow = parseAllow(commentBody(c, info.file));
    if (!allow) continue;
    const target = c.standalone ? c.endLine + 1 : c.startLine;
    const list = byLine.get(target) ?? [];
    list.push({ ...allow, commentLine: c.startLine });
    byLine.set(target, list);
  }
  const kept: Finding[] = [];
  const exempt: Finding[] = [];
  const used = new Map<string, Exemption>();
  for (const f of findings) {
    const hit = byLine.get(f.line)?.find((a) => a.ruleId === f.ruleId);
    if (hit) {
      exempt.push(f);
      used.set(`${hit.commentLine}:${hit.ruleId}`, { file: info.file, line: hit.commentLine, ruleId: hit.ruleId, reason: hit.reason });
    } else kept.push(f);
  }
  return { findings: kept, exempt, used: [...used.values()] };
}

// ---- running rules --------------------------------------------------------

export async function loadRules(): Promise<Rule[]> {
  const dir = join(import.meta.dir, "rules");
  const names = readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.endsWith("-phrases.ts"))
    .sort();
  const rules: Rule[] = [];
  for (const name of names) {
    const mod = (await import(join(dir, name))) as { default?: Rule };
    const rule = mod.default;
    if (!rule || typeof rule.check !== "function" || !rule.id) {
      throw new Error(`gate/rules/${name} must default-export a rule { id, title, why, fix, check }`);
    }
    if (`${rule.id}.ts` !== name) throw new Error(`gate/rules/${name}: rule id "${rule.id}" must match the file name`);
    rules.push(rule);
  }
  if (rules.length === 0) throw new Error("gate: no rules found in gate/rules, refusing to pass");
  return rules;
}

export function checkContent(rules: Rule[], file: string, content: string): Checked {
  const info = analyze(file, content);
  const ext = extOf(file);
  const all = dedupe(rules.filter((r) => (r.extensions ?? DEFAULT_EXT).includes(ext)).flatMap((r) => r.check(file, info.masked, info)));
  return applyExemptions(info, all);
}

export function checkFile(rules: Rule[], root: string, file: string, rev?: string): Checked {
  return checkContent(rules, file, readAt(root, rev, file));
}

/** Index just past the `)` that closes the `(` at `open`. Plain counting; for gradient bodies. */
export function matchingParen(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return i + 1;
  }
  return text.length;
}
