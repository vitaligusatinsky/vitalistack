// Runs as the `prepare` script. Points git at .githooks, but only when this
// package directory is the root of its git repository, and never over a
// hooks path you already set. Inside a larger repository (a monorepo) it does
// nothing, so it cannot take over that repository's hooks.
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
const existing = git(["config", "--get", "core.hooksPath"]).stdout.trim();
if (existing === ".githooks") {
  console.log("install-hooks: already installed, git runs .githooks/pre-push (the gate)");
  process.exit(0);
}
if (existing) {
  console.log(`install-hooks: core.hooksPath is already set to "${existing}", left unchanged`);
  console.log(`install-hooks: to run the gate from your hook, add this line to ${existing}/pre-push:`);
  console.log('  sh "$(git rev-parse --show-toplevel)/.githooks/pre-push" "$@"');
  process.exit(0);
}
const set = git(["config", "core.hooksPath", ".githooks"]);
if (set.status !== 0) {
  console.log(`install-hooks: could not set core.hooksPath (${set.stderr.trim()})`);
  process.exit(0);
}
console.log("install-hooks: installed, git will run .githooks/pre-push (the gate)");
