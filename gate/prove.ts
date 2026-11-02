#!/usr/bin/env bun
// Shows every rule firing on its bad fixture. For demos and the build log.
// Exits 1 if any rule fails to fire exactly on the lines marked @expect.
import { expectedLines, fixtureFiles, readFixture } from "./fixtures-util";
import { checkContent, loadRules } from "./scan";

const rules = await loadRules();
let failed = 0;
for (const rule of rules) {
  console.log(`${rule.id}: ${rule.title}`);
  for (const name of fixtureFiles(rule.id, "bad")) {
    const content = readFixture(rule.id, name);
    const { findings, exempt } = checkContent(rules, name, content);
    const fired = [...new Set(findings.filter((f) => f.ruleId === rule.id).map((f) => f.line))].sort((a, b) => a - b);
    const expected = expectedLines(content, rule.id);
    const lines = content.split("\n");
    for (const n of fired) console.log(`  FIRES  gate/fixtures/${rule.id}/${name}:${n}  ${lines[n - 1]!.trim()}`);
    const exemptCount = exempt.filter((f) => f.ruleId === rule.id).length;
    const ok = fired.join() === expected.join() && fired.length > 0;
    console.log(`  ${ok ? "ok" : "MISMATCH"}: fired ${fired.length}, expected ${expected.length}, exempted by vs-allow ${exemptCount}`);
    if (!ok) failed++;
  }
}
console.log("");
console.log(failed === 0 ? `gate:prove: all ${rules.length} rules fire on their bad fixtures` : `gate:prove: ${failed} fixture(s) did not match`);
process.exit(failed === 0 ? 0 : 1);
