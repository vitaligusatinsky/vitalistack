// Runs as the `prepare` script. Points git at .githooks, but only when this
// package directory is the root of its git repository. Inside a larger
// repository (a monorepo) it does nothing, so it cannot take over that repo's hooks.
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";

const git = (args: string[]) => spawnSync("git", args, { encoding: "utf8" });

const top = git(["rev-parse", "--show-toplevel"]);
if (top.status !== 0) {
  console.log("install-hooks: not a git repository, hooks not installed");
  process.exit(0);
}
const here = realpathSync(process.cwd());
const root = realpathSync(top.stdout.trim());
if (here !== root) {
  console.log(`install-hooks: ${here} is inside the repository at ${root}, hooks not installed`);
  process.exit(0);
}
const set = git(["config", "core.hooksPath", ".githooks"]);
if (set.status !== 0) {
  console.log(`install-hooks: could not set core.hooksPath (${set.stderr.trim()})`);
  process.exit(0);
}
console.log("install-hooks: installed, git will run .githooks/pre-push (bun run gate)");
