#!/usr/bin/env bun
// Shows every rule firing on its bad fixture. For demos and the build log.
// Exits 1 if any rule fails to fire exactly on the lines marked @expect, or if
// oxlint does not flag the lines marked @expect-oxlint.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { expectedLines, fixtureFiles, oxlintFixture, readFixture } from "./fixtures-util";
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

const ox = oxlintFixture();
if (ox) {
  console.log("oxlint (jsx-a11y): the part of require-accessible-name that oxlint covers");
  const r = spawnSync(join(import.meta.dir, "..", "node_modules/.bin/oxlint"), ["-c", ox.config, "-f", "json", ox.file], { encoding: "utf8" });
  const diagnostics = JSON.parse(r.stdout).diagnostics as Array<{ code: string; labels: Array<{ span: { line: number } }> }>;
  const got = new Set(diagnostics.map((d) => `${d.labels[0]!.span.line}:${d.code}`));
  const content = readFixture("require-accessible-name", ox.name);
  content.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(/@expect-oxlint\s+([a-z-]+)/g)) {
      const hit = got.has(`${i + 1}:jsx-a11y(${m[1]})`);
      console.log(`  ${hit ? "FIRES  " : "MISSING"} ${ox.name}:${i + 1} jsx-a11y/${m[1]}  ${line.split("{/*")[0]!.trim()}`);
      if (!hit) failed++;
    }
  });
}
console.log("");
console.log(failed === 0 ? `gate:prove: all ${rules.length} rules fire on their bad fixtures` : `gate:prove: ${failed} fixture(s) did not match`);
process.exit(failed === 0 ? 0 : 1);
