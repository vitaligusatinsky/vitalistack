import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const base = join(import.meta.dir, "fixtures");

export function fixtureFiles(ruleId: string, kind: "bad" | "good"): string[] {
  const dir = join(base, ruleId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.startsWith(`${kind}.`)).sort();
}

export function readFixture(ruleId: string, name: string): string {
  return readFileSync(join(base, ruleId, name), "utf8");
}

/** 1-based lines carrying an `@expect <rule-id>` marker. */
export function expectedLines(content: string, ruleId: string): number[] {
  const out: number[] = [];
  content.split("\n").forEach((line, i) => {
    const re = /@expect\s+([a-z][a-z0-9-]*)/g;
    for (const m of line.matchAll(re)) if (m[1] === ruleId) out.push(i + 1);
  });
  return out;
}

/** The oxlint fixture of require-accessible-name, with its config. */
export function oxlintFixture(): { name: string; file: string; config: string } | null {
  const dir = join(base, "require-accessible-name");
  const file = join(dir, "oxlint-bad.tsx");
  return existsSync(file) ? { name: "oxlint-bad.tsx", file, config: join(dir, "oxlintrc.json") } : null;
}
