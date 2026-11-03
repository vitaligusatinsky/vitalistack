#!/usr/bin/env bun
// Adapted from DesignAnswers Oy's token audit (MIT, same copyright holder).
//
// The ratchet blocks NEW hardcoded visual values (colours, pixels, shadows,
// arbitrary Tailwind values, numeric style values) compared with a base commit.
// Values a file already had never block; a new copy of one does. When no base
// can be found it runs a full scan and blocks on everything, since a new project
// starts with no debt.
//
//   bun gate/ratchet.ts [--base=<ref>] [--rev <sha>] [--full] [--json]
import { changedFiles, newViolations, resolveBase, showAtBase } from "./ratchet-diff";
import ts from "typescript-js";
import { CODE_EXT, CSS_EXT, analyze, applyExemptions, hasScannableExtension, listFiles, matchingParen, packageRoot, readAt, shouldIgnore, type Exemption } from "./scan";

type Rule = { code: string; message: string; pattern: RegExp; suggestion: string };
export type Violation = {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
  suggestion: string;
  /** The matched text. The fingerprint is (rule, token), per file. */
  token: string;
  sample: string;
};

const LENGTH = "px|rem|em|vw|vh|%";
const NAMED = [
  "aliceblue", "antiquewhite", "aqua", "aquamarine", "azure", "beige", "bisque", "black", "blanchedalmond", "blue", "blueviolet", "brown",
  "burlywood", "cadetblue", "chartreuse", "chocolate", "coral", "cornflowerblue", "cornsilk", "crimson", "cyan", "darkblue", "darkcyan",
  "darkgoldenrod", "darkgray", "darkgreen", "darkgrey", "darkkhaki", "darkmagenta", "darkolivegreen", "darkorange", "darkorchid", "darkred",
  "darksalmon", "darkseagreen", "darkslateblue", "darkslategray", "darkturquoise", "darkviolet", "deeppink", "deepskyblue", "dimgray",
  "dodgerblue", "firebrick", "floralwhite", "forestgreen", "fuchsia", "gainsboro", "ghostwhite", "gold", "goldenrod", "gray", "green",
  "greenyellow", "grey", "honeydew", "hotpink", "indianred", "indigo", "ivory", "khaki", "lavender", "lavenderblush", "lawngreen",
  "lemonchiffon", "lightblue", "lightcoral", "lightcyan", "lightgoldenrodyellow", "lightgray", "lightgreen", "lightgrey", "lightpink",
  "lightsalmon", "lightseagreen", "lightskyblue", "lightslategray", "lightsteelblue", "lightyellow", "lime", "limegreen", "linen", "magenta",
  "maroon", "mediumaquamarine", "mediumblue", "mediumorchid", "mediumpurple", "mediumseagreen", "mediumslateblue", "mediumspringgreen",
  "mediumturquoise", "mediumvioletred", "midnightblue", "mintcream", "mistyrose", "moccasin", "navajowhite", "navy", "oldlace", "olive",
  "olivedrab", "orange", "orangered", "orchid", "palegoldenrod", "palegreen", "paleturquoise", "palevioletred", "papayawhip", "peachpuff",
  "peru", "pink", "plum", "powderblue", "purple", "rebeccapurple", "red", "rosybrown", "royalblue", "saddlebrown", "salmon", "sandybrown",
  "seagreen", "seashell", "sienna", "silver", "skyblue", "slateblue", "slategray", "snow", "springgreen", "steelblue", "tan", "teal",
  "thistle", "tomato", "turquoise", "violet", "wheat", "white", "whitesmoke", "yellow", "yellowgreen",
].join("|");
const CSS_COLOR_PROPS = "(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?(?:-color)?|outline(?:-color)?|fill|stroke|caret-color|accent-color|text-decoration-color|column-rule-color)";
const JS_COLOR_KEYS = /^(?:color|background|backgroundColor|border|borderColor|borderTopColor|borderRightColor|borderBottomColor|borderLeftColor|outline|outlineColor|fill|stroke|caretColor|accentColor|textDecorationColor)$/;
const STYLE_NUMBER_KEYS =
  /^(?:padding(?:Top|Right|Bottom|Left|Inline|Block)?(?:Start|End)?|margin(?:Top|Right|Bottom|Left|Inline|Block)?(?:Start|End)?|gap|rowGap|columnGap|(?:min|max)?(?:Width|Height)|width|height|top|right|bottom|left|inset|fontSize|borderRadius|borderWidth|letterSpacing)$/;

export const rules: Rule[] = [
  {
    code: "raw-color",
    message: "Raw colour value outside the token layer.",
    pattern: new RegExp(
      [
        "#[0-9a-fA-F]{3,8}\\b",
        "\\b(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch)\\([^)]*\\)",
        "\\bcolor-mix\\((?:[^()]|\\([^)]*\\))*\\)",
        // Named colours only where a colour is set, never in prose.
        `(?<![\\w-])${CSS_COLOR_PROPS}\\s*:\\s*(?:[^;}\\n]*?\\s)?(?:${NAMED})(?![\\w-])`,
        "\\bcolor\\((?:display-p3|srgb-linear|srgb|a98-rgb|prophoto-rgb|rec2020|xyz-d50|xyz-d65|xyz)\\s[^)]*\\)",
      ].join("|"),
      "gi",
    ),
    suggestion: "Use a semantic colour token from src/styles/tokens.css.",
  },
  {
    code: "raw-pixel",
    message: "Raw pixel value outside the token layer.",
    pattern: /(?<![\w.-])-?\d+(?:\.\d+)?px\b/g,
    suggestion: "Use a spacing, radius, type, border or layout token.",
  },
  {
    code: "raw-shadow",
    message: "Raw shadow value outside the token layer.",
    pattern: /(?:boxShadow|box-shadow)\s*[:=]\s*["'`]?[^\n;"'`]*\d+(?:\.\d+)?(?:px|rem|em)[^\n;"'`]*/g,
    suggestion: "Use an elevation token such as --shadow-card.",
  },
  {
    code: "tailwind-arbitrary-visual",
    message: "Tailwind arbitrary visual value outside the token layer.",
    pattern: new RegExp(
      // A bracket inside a class token: it follows `-` or `:` and holds no quote or newline.
      `(?<=[-:])\\[[^\\]\\n"'\`]*(?:#[0-9a-fA-F]{3,8}|\\d*\\.?\\d+(?:${LENGTH})|(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch)\\(|color-mix\\()[^\\]\\n"'\`]*\\]`,
      "g",
    ),
    suggestion: "Use a design token, or add a semantic token before using this value.",
  },
];

const STYLE_NUMBER_MESSAGE = "Raw numeric style value outside the token layer.";
const STYLE_NUMBER_FIX = "Use a spacing, size or type token (a CSS variable or a Tailwind scale class).";
const NAMED_SET = new Set(NAMED.split("|"));

type Range = [number, number];
const within = (ranges: Range[], i: number) => ranges.some(([a, b]) => i >= a && i < b);

/** Media-query arguments: where a pixel width is a breakpoint, not a visual value. */
function mediaRanges(masked: string): Range[] {
  const out: Range[] = [];
  for (const m of masked.matchAll(/@(?:media|container|supports)\b[^{;]*/g)) out.push([m.index!, m.index! + m[0].length]);
  for (const m of masked.matchAll(/\b(?:matchMedia|useMediaQuery)\(/g)) {
    const open = m.index! + m[0].length - 1;
    out.push([open, matchingParen(masked, open)]);
  }
  return out;
}

/** URL, fragment and identifier expressions: where a `#abc` is not a colour. Only these spans are exempt. */
function fragmentRanges(masked: string): Range[] {
  const out: Range[] = [];
  const add = (re: RegExp) => {
    for (const m of masked.matchAll(re)) out.push([m.index!, m.index! + m[0].length]);
  };
  add(/\b(?:href|to|id|htmlFor|src|name|key|from)\s*[=:]\s*\{?\s*(["'`])[^"'`\n]*\1/g);
  add(/\bhash\s*(?:[!=]==?|=)\s*(["'`])[^"'`\n]*\1/g);
  add(/https?:\/\/[^\s"'`)]*/g);
  add(/url\(\s*["']?#[^)"']*/g);
  return out;
}

function unwrap(e: ts.Expression): ts.Expression {
  for (;;) {
    if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isNonNullExpression(e) || ts.isTypeAssertionExpression(e)) e = e.expression;
    else return e;
  }
}

/** Style-object properties: numeric sizes and named colours, with quoted keys and wrappers handled. */
function styleProperties(sf: ts.SourceFile): Array<{ index: number; code: string; token: string }> {
  const out: Array<{ index: number; code: string; token: string }> = [];
  const visit = (n: ts.Node) => {
    if (ts.isPropertyAssignment(n) && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name))) {
      const key = n.name.text;
      const init = unwrap(n.initializer);
      const token = n.getText(sf).replace(/\s+/g, " ");
      let value: number | null = null;
      if (ts.isNumericLiteral(init)) value = Number(init.text);
      else if (ts.isPrefixUnaryExpression(init) && ts.isNumericLiteral(init.operand)) value = -Number(init.operand.text);
      if (STYLE_NUMBER_KEYS.test(key) && value !== null && value !== 0) out.push({ index: n.getStart(sf), code: "raw-style-number", token });
      if (JS_COLOR_KEYS.test(key) && ts.isStringLiteralLike(init) && NAMED_SET.has(init.text.toLowerCase())) out.push({ index: n.getStart(sf), code: "raw-color", token });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** Violations in one file, with the vs-allow comments that exempted some. */
export function auditFile(file: string, content: string): { violations: Violation[]; used: Exemption[] } {
  const info = analyze(file, content);
  const masked = info.masked;
  const contentLines = content.split("\n");
  const media = mediaRanges(masked);
  const fragments = fragmentRanges(masked);
  const violations: Violation[] = [];
  const push = (index: number, rule: { code: string; message: string; suggestion: string }, token: string) => {
    const { line, column } = info.lines.at(index);
    violations.push({
      file, line, column, code: rule.code, message: rule.message, suggestion: rule.suggestion,
      token: token.replace(/\s+/g, " ").trim(), sample: (contentLines[line - 1] ?? "").trim(),
    });
  };
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    for (const match of masked.matchAll(rule.pattern)) {
      const index = match.index ?? 0;
      const token = match[0];
      const before = masked.slice(Math.max(0, index - 40), index);
      if (rule.code === "raw-color" && token.startsWith("#") && (/[\w/.&?=-]$/.test(before) || within(fragments, index))) continue;
      if (rule.code === "raw-pixel" && within(media, index)) continue;
      if (rule.code === "tailwind-arbitrary-visual" && /(?:^|[\s"'`:])@?(?:min|max)-$/.test(before)) continue;
      push(index, rule, token);
    }
  }
  if (info.ast) {
    for (const p of styleProperties(info.ast)) {
      push(p.index, p.code === "raw-color" ? rules[0]! : { code: "raw-style-number", message: STYLE_NUMBER_MESSAGE, suggestion: STYLE_NUMBER_FIX }, p.token);
    }
  }
  // `vs-allow <code>: <reason>` works here too (for example raw-color on a theme-color meta tag).
  const checked = applyExemptions(info, violations.map((v) => ({ ruleId: v.code, line: v.line, column: v.column })));
  const keep = new Set(checked.findings.map((f) => `${f.ruleId}:${f.line}:${f.column}`));
  return { violations: violations.filter((v) => keep.has(`${v.code}:${v.line}:${v.column}`)), used: checked.used };
}

export function auditContent(file: string, content: string): Violation[] {
  return auditFile(file, content).violations;
}

const CODE_AND_CSS = [...CODE_EXT, ...CSS_EXT];

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const flags = new Set(argv);
  const baseArg = argv.find((a) => a.startsWith("--base="))?.slice("--base=".length);
  const baseSpaced = argv.indexOf("--base") >= 0 ? argv[argv.indexOf("--base") + 1] : undefined;
  const revIndex = argv.indexOf("--rev");
  const rev = revIndex >= 0 ? argv[revIndex + 1] : argv.find((a) => a.startsWith("--rev="))?.slice(6);
  const json = flags.has("--json");
  const forceFull = flags.has("--full-scan-blocking") || process.env.GATE_FULL_SCAN === "1";
  const root = packageRoot();
  const log = (s: string) => (json ? console.error(s) : console.log(s));

  try {
    if (argv.some((a) => a === "--rev" || a.startsWith("--rev=")) && !rev) throw new Error("ratchet: --rev needs a commit");
    const base = forceFull ? null : resolveBase(root, baseArg ?? baseSpaced, process.env, rev ?? "HEAD", !!rev);
    const scope = (f: string) => hasScannableExtension(f, CODE_AND_CSS) && !shouldIgnore(f);
    const used: Exemption[] = [];
    const audit = (f: string) => {
      const r = auditFile(f, readAt(root, rev, f));
      used.push(...r.used);
      return r.violations;
    };

    let violations: Violation[];
    let checked: number;
    if (base) {
      log(`ratchet: comparing with ${base.sha.slice(0, 10)} (${base.source})${rev ? ` at ${rev.slice(0, 10)}` : ""}`);
      const changed = changedFiles(root, base.sha, rev);
      const files = [...changed.keys()].filter(scope);
      checked = files.length;
      violations = files.flatMap((file) => {
        const current = audit(file);
        const previousPath = changed.get(file);
        // A rename from a path the gate does not read (a test, gate/, scripts/, public/, tokens.css) has no baseline.
        if (!previousPath || !scope(previousPath)) return current;
        return newViolations(current, auditContent(file, showAtBase(root, base.sha, previousPath)));
      });
    } else {
      log("ratchet: no base found, running the full scan (blocking)");
      const files = listFiles(root, rev, CODE_AND_CSS);
      checked = files.length;
      violations = files.flatMap(audit);
    }

    const full = flags.has("--full") && base ? listFiles(root, rev, CODE_AND_CSS).flatMap((f) => auditContent(f, readAt(root, rev, f))) : null;

    if (json) {
      console.log(JSON.stringify({
        base: base?.sha ?? null, source: base?.source ?? "full scan", changedFileCount: checked,
        violationCount: violations.length, fullScanCount: full?.length ?? null, violations, exemptions: used,
      }, null, 2));
    } else {
      for (const v of violations) {
        console.log(`${v.file}:${v.line}:${v.column} [${v.code}] ${v.message}`);
        console.log(`  ${v.sample}`);
        console.log(`  Fix: ${v.suggestion}`);
      }
      console.log(`ratchet: vs-allow exemptions used: ${used.length}`);
      for (const e of used) console.log(`  ${e.file}:${e.line} ${e.ruleId} "${e.reason}"${e.count > 1 ? ` (exempts ${e.count} findings)` : ""}`);
      if (full) console.log(`ratchet: advisory full scan finds ${full.length} raw visual value(s) in scope (never blocks)`);
      console.log(violations.length === 0
        ? `ratchet: no new raw visual values (${checked} file(s) checked)`
        : base
          ? `ratchet: ${violations.length} new raw visual value(s) added since the base`
          : `ratchet: ${violations.length} raw visual value(s) found by the full scan`);
    }
    process.exit(violations.length > 0 ? 1 : 0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}
