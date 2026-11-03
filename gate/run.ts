#!/usr/bin/env bun
// Runs every hard rule over the files in scope. Exits 1 on any finding.
//   bun gate/run.ts [--rev <sha>]
// With --rev it checks the files of that commit instead of the working tree.
import { checkFile, listFiles, loadRules, packageRoot, readAt, type Exemption } from "./scan";

const argv = process.argv.slice(2);
const revIndex = argv.indexOf("--rev");
const rev = revIndex >= 0 ? argv[revIndex + 1] : argv.find((a) => a.startsWith("--rev="))?.slice(6);
if ((revIndex >= 0 || argv.some((a) => a.startsWith("--rev="))) && !rev) {
  console.error("gate: --rev needs a commit");
  process.exit(2);
}

const root = packageRoot();
const rules = await loadRules();
const byId = new Map(rules.map((r) => [r.id, r]));
const files = listFiles(root, rev);
if (files.length === 0) {
  console.error(`gate: no files in scope under ${root}${rev ? ` at ${rev}` : ""}; refusing to pass an empty scan`);
  process.exit(1);
}

let blocking = 0;
const used: Exemption[] = [];
for (const file of files) {
  const result = checkFile(rules, root, file, rev);
  used.push(...result.used);
  if (result.findings.length === 0) continue;
  const lines = readAt(root, rev, file).split("\n");
  for (const f of result.findings) {
    const rule = byId.get(f.ruleId)!;
    console.log(`${file}:${f.line}:${f.column} [${f.ruleId}] ${rule.title}`);
    console.log(`  ${(lines[f.line - 1] ?? "").trim()}`);
    console.log(`  Fix: ${rule.fix}`);
    blocking++;
  }
}

console.log("");
console.log(`gate: ${rules.length} rules, ${files.length} files scanned${rev ? ` at ${rev.slice(0, 10)}` : ""}, ${blocking} finding(s)`);
console.log(`gate: vs-allow exemptions used: ${used.length}`);
for (const e of used) console.log(`  ${e.file}:${e.line} ${e.ruleId} "${e.reason}"${e.count > 1 ? ` (exempts ${e.count} findings)` : ""}`);
process.exit(blocking > 0 ? 1 : 0);
