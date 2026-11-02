// Shared helpers for the gate: file listing, comment masking, token and literal
// extraction, and the vs-allow escape hatch. Plain TypeScript, no dependencies.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

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
  /** `maskedContent` is the file with comments blanked out, same length, same line/column. */
  check(file: string, maskedContent: string): Finding[];
};

export const SCAN_DIR = "src";
export const EXTENSIONS = new Set([".ts", ".tsx", ".css"]);

/** Paths (relative to the package directory, forward slashes) the gate never scans. */
export function shouldIgnore(path: string): boolean {
  const p = path.split("\\").join("/");
  if (p.split("/").includes("node_modules")) return true;
  if (p === "src/styles/tokens.css" || p.endsWith("/styles/tokens.css")) return true;
  if (p.endsWith("routeTree.gen.ts")) return true;
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(p)) return true;
  return false;
}

export function hasScannableExtension(path: string): boolean {
  const dot = path.lastIndexOf(".");
  return dot >= 0 && EXTENSIONS.has(path.slice(dot));
}

/** Every scannable file under `<root>/src`, as paths relative to `root`. */
export function listSourceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(join(root, dir));
    } catch {
      return;
    }
    for (const entry of entries.sort()) {
      const rel = `${dir}/${entry}`;
      if (shouldIgnore(rel)) continue;
      const stats = statSync(join(root, rel));
      if (stats.isDirectory()) walk(rel);
      else if (hasScannableExtension(rel)) out.push(rel);
    }
  };
  walk(SCAN_DIR);
  return out;
}

export function isCss(file: string): boolean {
  return file.endsWith(".css");
}

/**
 * Blank out comments, keeping every other character and every newline, so
 * line and column numbers still match the source. Strings are kept.
 * Known limits (documented in gate/README.md): no regex-literal awareness; a
 * quote glued to the end of a word (don't) is treated as an apostrophe.
 */
export function maskComments(content: string, file = "x.tsx"): string {
  const css = isCss(file);
  let out = "";
  let i = 0;
  let inBlock = false;
  let inLine = false;
  let inString: "'" | '"' | "`" | null = null;
  let escaped = false;

  while (i < content.length) {
    const c = content[i]!;
    const n = content[i + 1];

    if (inLine) {
      if (c === "\n") {
        inLine = false;
        out += c;
      } else out += " ";
      i++;
      continue;
    }
    if (inBlock) {
      if (c === "*" && n === "/") {
        out += "  ";
        inBlock = false;
        i += 2;
        continue;
      }
      out += c === "\n" ? "\n" : " ";
      i++;
      continue;
    }
    if (inString) {
      out += c;
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === inString) inString = null;
      else if (c === "\n" && inString !== "`") inString = null;
      i++;
      continue;
    }
    if (!css && c === "/" && n === "/" && content[i - 1] !== ":") {
      out += "  ";
      inLine = true;
      i += 2;
      continue;
    }
    if (c === "/" && n === "*") {
      out += "  ";
      inBlock = true;
      i += 2;
      continue;
    }
    if (!css && (c === "'" || c === '"' || c === "`")) {
      const prev = content[i - 1] ?? " ";
      const apostrophe = c !== "`" && /[A-Za-z0-9]/.test(prev);
      if (!apostrophe) inString = c;
    }
    out += c;
    i++;
  }
  return out;
}

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

/** A string literal in masked source. `start`/`end` index the inner text. */
export type Literal = { start: number; end: number; text: string };

/** Every '...', "..." and `...` literal, including ones nested in ${...}. */
export function scanLiterals(masked: string): Literal[] {
  const out: Literal[] = [];
  const scan = (from: number, untilBrace: boolean): number => {
    let i = from;
    let depth = 0;
    while (i < masked.length) {
      const c = masked[i]!;
      if (untilBrace) {
        if (c === "{") depth++;
        else if (c === "}") {
          if (depth === 0) return i + 1;
          depth--;
        }
      }
      if (c === "'" || c === '"') {
        const prev = masked[i - 1] ?? " ";
        if (/[A-Za-z0-9]/.test(prev)) {
          i++;
          continue;
        }
        let j = i + 1;
        while (j < masked.length && masked[j] !== c && masked[j] !== "\n") {
          if (masked[j] === "\\") j++;
          j++;
        }
        if (masked[j] === c) {
          out.push({ start: i + 1, end: j, text: masked.slice(i + 1, j) });
          i = j + 1;
        } else i++;
        continue;
      }
      if (c === "`") {
        let j = i + 1;
        while (j < masked.length && masked[j] !== "`") {
          if (masked[j] === "\\") j += 2;
          else if (masked[j] === "$" && masked[j + 1] === "{") {
            j = scan(j + 2, true);
          } else j++;
        }
        out.push({ start: i + 1, end: j, text: masked.slice(i + 1, j) });
        i = j + 1;
        continue;
      }
      i++;
    }
    return i;
  };
  scan(0, false);
  return out;
}

/** Index just past the bracket that closes the one at `open`, skipping strings. */
export function matchingClose(masked: string, open: number): number {
  const pairs: Record<string, string> = { "{": "}", "(": ")", "[": "]" };
  const openCh = masked[open]!;
  const closeCh = pairs[openCh]!;
  let depth = 0;
  for (let i = open; i < masked.length; i++) {
    const c = masked[i]!;
    if (c === "'" || c === '"' || c === "`") {
      const prev = masked[i - 1] ?? " ";
      if (c !== "`" && /[A-Za-z0-9]/.test(prev)) continue;
      let j = i + 1;
      while (j < masked.length && masked[j] !== c && (c === "`" || masked[j] !== "\n")) {
        if (masked[j] === "\\") j++;
        j++;
      }
      i = j;
      continue;
    }
    if (c === openCh) depth++;
    else if (c === closeCh) {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return masked.length;
}

export type ClassToken = {
  /** Token with variants (md:, hover:, dark:) and a leading ! or - removed. */
  base: string;
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
    const colon = base.lastIndexOf(":");
    if (colon >= 0 && !base.includes("[")) base = base.slice(colon + 1);
    else if (colon >= 0) base = base.slice(base.lastIndexOf("]:") + 2);
    base = base.replace(/^[!-]+/, "");
    if (base) tokens.push({ base, index: start + m.index! });
  }
  return tokens;
}

/**
 * Places where Tailwind class names live. In .css files that is each `@apply`.
 * In .ts/.tsx it is every string literal, every className={...} expression and
 * every cn()/clsx()/cva()/twMerge()/tv() call, so classes split across several
 * literals still count as one group.
 */
export function classGroups(file: string, masked: string): ClassGroup[] {
  const spans: Array<[number, number]> = [];
  if (isCss(file)) {
    for (const m of masked.matchAll(/@apply\s+([^;}]+)/g)) {
      const start = m.index! + m[0].length - m[1]!.length;
      spans.push([start, start + m[1]!.length]);
    }
  } else {
    for (const lit of scanLiterals(masked)) spans.push([lit.start, lit.end]);
    for (const m of masked.matchAll(/\bclass(?:Name)?\s*=\s*\{/g)) {
      const open = m.index! + m[0].length - 1;
      spans.push([open, matchingClose(masked, open)]);
    }
    for (const m of masked.matchAll(/\b(?:cn|clsx|cva|twMerge|tv|classNames)\s*\(/g)) {
      const open = m.index! + m[0].length - 1;
      spans.push([open, matchingClose(masked, open)]);
    }
  }
  return spans.map(([start, end]) => ({ start, end, tokens: tokenize(masked, start, end) }));
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
const ALLOW = /(?:\/\/|\/\*)\s*vs-allow\s+([a-z][a-z0-9-]*)\s*:\s*(.*)$/;

/** The reason on a vs-allow comment line for `ruleId`, or null when it is absent or too short. */
export function allowReason(line: string, ruleId: string): string | null {
  const m = ALLOW.exec(line);
  if (!m || m[1] !== ruleId) return null;
  const reason = m[2]!.replace(/\s*\*\/\s*\}?\s*$/, "").trim();
  return reason.length >= MIN_REASON ? reason : null;
}

export type Checked = { findings: Finding[]; exempt: Finding[] };

/** Split findings into blocking ones and ones exempted by a vs-allow on the line above. */
export function applyExemptions(rawContent: string, findings: Finding[]): Checked {
  const lines = rawContent.split("\n");
  const kept: Finding[] = [];
  const exempt: Finding[] = [];
  for (const f of findings) {
    const above = f.line >= 2 ? (lines[f.line - 2] ?? "") : "";
    if (allowReason(above, f.ruleId)) exempt.push(f);
    else kept.push(f);
  }
  return { findings: kept, exempt };
}

// ---- running rules --------------------------------------------------------

export async function loadRules(): Promise<Rule[]> {
  const dir = join(import.meta.dir, "rules");
  const names = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")).sort();
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
  const masked = maskComments(content, file);
  const all = dedupe(rules.flatMap((r) => r.check(file, masked)));
  return applyExemptions(content, all);
}

export function checkFile(rules: Rule[], root: string, file: string): Checked {
  return checkContent(rules, file, readFileSync(join(root, file), "utf8"));
}

export function relativeTo(root: string, abs: string): string {
  return relative(root, abs).split("\\").join("/");
}
