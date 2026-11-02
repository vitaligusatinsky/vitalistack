# 01 · From "make me a boilerplate" to a plan that survived two hostile reviewers

2026-11-02

I've built a lot of projects with TanStack Start and Next: dashboards, prototypes, websites, internal tools. I wanted my own starter, but not one built from memory. So the first step was an audit of my own work.

## What I did

1. **Audited my own projects.** Three agents went through 7 TanStack Start projects, 5 Next projects, and my whole coding-agent setup (rules, hooks, skills) at the same time.
2. **Researched current practice.** A fourth agent covered how Claude Code and Codex handle orchestration, hooks and subagents as of November 2026, plus TanStack Start's current state and how other repos keep templates in sync.
3. **Wrote a plan.**
4. **Had it attacked.** Two reviewers worked separately: a Claude agent with read access to the real projects, and Codex. Their brief was to break the plan, not improve it.
5. **Rewrote the plan** from what survived.

## What the audit found

- **I already had a stack.** All seven TanStack projects ran the same Bun, TanStack Start, Vite and Tailwind versions. The starter mostly picked itself. The value is in everything around it.
- **Every project had one best piece.** One had the best router setup. Another had the cleanest server-function pattern. A third had a design check that only lets violations go down. The starter is mostly those pieces, picked out and combined.
- **I rebuilt the same things every time:** build config, the root route, design tokens, UI primitives, analytics setup, env handling, lint and test config, agent instructions. One analytics setup existed in four incompatible versions.
- **My taste rules weren't enforced.** "No left-border accent stripes" was written down and checked nowhere. Two of my repos shared 35 component names, and 24 of those files had drifted apart.
- **One warning was false by design.** A hook in one repo warns about drift between two instruction files on every session. It assumes the files should match, and they were never meant to.

## What the reviewers found

Both reviewers reached the same verdict independently: **the first plan was three projects pretending to be one** (a starter, a hook framework and an evaluation lab). One person can maintain one of those.

Specific catches:

- **A spending guard that could never trigger.** It blocked agents with no model set, but a default model is always set.
- **A "the verifier is not the builder" check that could never fail,** because every agent gets a new ID.
- **An evaluation runner that skipped the instructions it was meant to test.** The flag it relied on skips the instruction file.
- **Running every check at the end of each agent turn,** a cost one of my own repos had already removed.
- **Checking login and calling it authorization.** Every route now declares who may call it, with tests for the wrong user.

## What changed

The plan got smaller and stricter. One template, checks that run where they're cheap, orchestration that scales with risk, and a learning loop that only promotes a lesson when it recurs. "Done" now means a real project deployed on it, not a green checklist.

## Lesson

An agent grading its own plan is generous. Two independent reviewers with access to the real files changed the plan more than another hour of my own synthesis would have.

## Next

The web template on Cloudflare, and a first real project running on it.
