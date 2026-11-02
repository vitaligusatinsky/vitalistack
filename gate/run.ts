#!/usr/bin/env bun
// Runs every hard rule over src/. Exits 1 on any finding.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkFile, listSourceFiles, loadRules } from "./scan";

const root = process.cwd();
const rules = await loadRules();
const byId = new Map(rules.map((r) => [r.id, r]));
const files = listSourceFiles(root);
if (files.length === 0) {
  console.error(`gate: no files found under ${join(root, "src")}; refusing to pass an empty scan`);
  process.exit(1);
}

let blocking = 0;
let exempt = 0;
for (const file of files) {
  const result = checkFile(rules, root, file);
  exempt += result.exempt.length;
  if (result.findings.length === 0) continue;
  const lines = readFileSync(join(root, file), "utf8").split("\n");
  for (const f of result.findings) {
    const rule = byId.get(f.ruleId)!;
    console.log(`${file}:${f.line}:${f.column} [${f.ruleId}] ${rule.title}`);
    console.log(`  ${(lines[f.line - 1] ?? "").trim()}`);
    console.log(`  Fix: ${rule.fix}`);
    blocking++;
  }
}

console.log("");
console.log(`gate: ${rules.length} rules, ${files.length} files scanned, ${blocking} finding(s)`);
console.log(`gate: vs-allow exemptions used: ${exempt}`);
process.exit(blocking > 0 ? 1 : 0);
