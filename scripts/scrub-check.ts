// Fails if any tracked file contains a term from a private denylist.
// The denylist lives outside this repo; point to it with VITALISTACK_DENYLIST.
import { readFileSync } from "node:fs";
import { $ } from "bun";

const listPath = process.env.VITALISTACK_DENYLIST;
if (!listPath) {
  console.log("scrub-check: VITALISTACK_DENYLIST not set, skipping (maintainers must set it before release)");
  process.exit(0);
}
const terms = readFileSync(listPath, "utf8")
  .split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
const files = (await $`git ls-files --cached --others --exclude-standard`.text()).split("\n").filter(Boolean);

const hits: string[] = [];
for (const file of files) {
  let text: string;
  try { text = readFileSync(file, "utf8").toLowerCase(); } catch { continue; }
  for (const term of terms) if (text.includes(term.toLowerCase())) hits.push(`${file}: "${term}"`);
}
if (hits.length) {
  console.error(`scrub-check: ${hits.length} private term(s) found:\n${hits.join("\n")}`);
  process.exit(1);
}
console.log(`scrub-check: ${files.length} files clean against ${terms.length} terms`);
