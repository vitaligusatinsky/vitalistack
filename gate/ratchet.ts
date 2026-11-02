#!/usr/bin/env bun
// Adapted from DesignAnswers Oy's token audit (MIT, same copyright holder).
//
// The ratchet blocks NEW hardcoded visual values (colours, pixels, shadows,
// arbitrary Tailwind values) under src/, compared with a base commit. Existing
// ones never block, so a project can adopt it on day one and only tighten.
//
//   bun gate/ratchet.ts [--base=<ref>] [--full] [--json]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { changedFiles, newViolations, resolveBase, showAtBase } from "./ratchet-diff";
import { hasScannableExtension, listSourceFiles, maskComments, shouldIgnore, SCAN_DIR } from "./scan";

type Rule = { code: string; message: string; pattern: RegExp; suggestion: string };
export type Violation = {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
  suggestion: string;
  sample: string;
};

export const rules: Rule[] = [
  {
    code: "raw-color",
    message: "Raw colour value outside the token layer.",
    pattern: /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g,
    suggestion: "Use a semantic colour token from src/styles/tokens.css.",
  },
  {
    code: "raw-pixel",
    message: "Raw pixel value outside the token layer.",
    pattern: /(?<![\w-])\d+(?:\.\d+)?px\b/g,
    suggestion: "Use a spacing, radius, type, border or layout token.",
  },
  {
    code: "raw-shadow",
    message: "Raw shadow value outside the token layer.",
    pattern: /(?:boxShadow|box-shadow)\s*[:=]\s*["'`]?[^\n;"'`]*\d+(?:\.\d+)?(?:px|rem)[^\n;"'`]*/g,
    suggestion: "Use an elevation token such as --shadow-card.",
  },
  {
    code: "tailwind-arbitrary-visual",
    message: "Tailwind arbitrary visual value outside the token layer.",
    pattern: /\[[^\]]*(?:#[0-9a-fA-F]{3,8}|\d+(?:\.\d+)?px|rgba?\(|hsla?\()[^\]]*\]/g,
    suggestion: "Use a design token, or add a semantic token before using this value.",
  },
];

function stripComments(line: string): string {
  return line.replace(/\/\*.*?\*\//g, "").replace(/\/\/.*$/g, "");
}

function lineAndColumn(content: string, index: number): { line: number; column: number } {
  const lines = content.slice(0, index).split("\n");
  return { line: lines.length, column: lines[lines.length - 1]!.length + 1 };
}

export function auditContent(file: string, content: string): Violation[] {
  const masked = maskComments(content, file);
  const contentLines = content.split("\n");
  const violations: Violation[] = [];
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    for (const match of masked.matchAll(rule.pattern)) {
      const { line, column } = lineAndColumn(masked, match.index ?? 0);
      const sourceLine = contentLines[line - 1] ?? "";
      if (!stripComments(sourceLine).trim()) continue;
      violations.push({
        file, line, column,
        code: rule.code, message: rule.message, suggestion: rule.suggestion,
        sample: sourceLine.trim(),
      });
    }
  }
  return violations;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const flags = new Set(argv);
  const baseArg = argv.find((a) => a.startsWith("--base="))?.slice("--base=".length);
  const json = flags.has("--json");
  const root = process.cwd();
  const log = (s: string) => (json ? console.error(s) : console.log(s));

  try {
    const base = resolveBase(root, baseArg, process.env);
    log(`ratchet: comparing with ${base.sha.slice(0, 10)} (${base.source})`);

    const changed = changedFiles(root, base.sha);
    const files = [...changed.keys()].filter(
      (f) => f.startsWith(`${SCAN_DIR}/`) && hasScannableExtension(f) && !shouldIgnore(f),
    );
    const violations = files.flatMap((file) => {
      const current = auditContent(file, readFileSync(join(root, file), "utf8"));
      const previousPath = changed.get(file);
      if (!previousPath) return current;
      return newViolations(current, auditContent(file, showAtBase(root, base.sha, previousPath)));
    });

    const full = flags.has("--full")
      ? listSourceFiles(root).flatMap((f) => auditContent(f, readFileSync(join(root, f), "utf8")))
      : null;

    if (json) {
      console.log(JSON.stringify({
        base: base.sha, source: base.source, changedFileCount: files.length,
        violationCount: violations.length, fullScanCount: full?.length ?? null, violations,
      }, null, 2));
    } else {
      for (const v of violations) {
        console.log(`${v.file}:${v.line}:${v.column} [${v.code}] ${v.message}`);
        console.log(`  ${v.sample}`);
        console.log(`  Fix: ${v.suggestion}`);
      }
      if (full) console.log(`ratchet: advisory full scan finds ${full.length} raw visual value(s) under src/ (never blocks)`);
      console.log(violations.length === 0
        ? `ratchet: no new raw visual values (${files.length} changed file(s) checked)`
        : `ratchet: ${violations.length} new raw visual value(s) added since the base`);
    }
    process.exit(violations.length > 0 ? 1 : 0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}
