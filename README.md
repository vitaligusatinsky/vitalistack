# Vitali Stack

An opinionated starter for building web apps with coding agents. It gives you a solid TanStack Start base plus the rules, gates and agent setup that keep Claude Code and Codex consistent from the first commit.

**Status:** pre-alpha, built in public. The app at the root builds and the [gate](gate/README.md) runs, but expect change. The [build log](build-log/) shows where it stands.

## Why

Most starters give you the code you would otherwise write on day one. The expensive part comes later: agents that re-decide the same things every session, design rules written down and enforced nowhere, checks that pass while production breaks. Vitali Stack treats those as the product.

- **Opinions are decided once.** Design, UX, copy and architecture rules live in one catalogue. Wherever a rule can be checked by code, code checks it, and every check has a test.
- **The easy path is the right path.** Generators write routes and server functions in the house shape, with their access rules and tests.
- **Orchestration scales with risk.** Small work happens in the main session. Normal features get one builder and a deterministic gate. Risky work adds independent, adversarial reviewers.
- **Done means deployed.** The template counts as working when a real project runs on it in production, not when its checks pass locally.
- **It learns, with brakes.** Lessons from real projects become rules only after they recur. Rules are capped and pruned.

## Shape

The repository root is the app: a minimal TanStack Start project on Cloudflare Workers.

```
src/            the app: routes, and styles/tokens.css (the only place raw colours and sizes belong)
gate/           the gate: slop rules, fixtures that prove them, and the ratchet
scripts/        repository tooling
build-log/      how it's being built, in order
docs/           decisions, founder-pack.md (a third-party skill pack for testing the business before you build), reference-stripe-style.md (a design language to learn from, not copy), and reference-windframe.md (a taste-for-agents product, read end to end)
.githooks/      pre-push runs the gate
```

Try it with `bun install`, then `bun run dev`. `bun run gate` runs typecheck, oxlint, the tests, seven slop rules that span design, UX and copy, and a ratchet against new hardcoded visual values. It blocks known agent slop; it does not make a design good. See [gate/README.md](gate/README.md) for what each rule blocks and why.

More is planned, not built: shared agent instructions, generators and add-on recipes (databases, auth, deploy targets).

## Defaults

Bun, React 19, Vite, Tailwind 4, TypeScript strict, TanStack Start with exact pinned versions, Cloudflare Workers, oxlint. Data and auth are per-project recipes (Supabase, or better-auth with Drizzle).

## Open core

The starter, the gate and the basic recipes are open source. Premium add-ons (taste packs, larger recipes, the mobile template and upgrade tooling) will be offered separately. They are copied in at development time and never become runtime dependencies.

## License

[MIT](LICENSE)
