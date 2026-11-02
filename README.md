# Vitali Stack

An opinionated starter for building web apps with coding agents. It gives you a solid TanStack Start base plus the rules, gates and agent setup that keep Claude Code and Codex consistent from the first commit.

**Status:** pre-alpha, built in public. Nothing here is ready to use yet. The [build log](build-log/) shows where it stands.

## Why

Most starters give you the code you would otherwise write on day one. The expensive part comes later: agents that re-decide the same things every session, design rules written down and enforced nowhere, checks that pass while production breaks. Vitali Stack treats those as the product.

- **Opinions are decided once.** Design, UX, copy and architecture rules live in one catalogue. Wherever a rule can be checked by code, code checks it, and every check has a test.
- **The easy path is the right path.** Generators write routes and server functions in the house shape, with their access rules and tests.
- **Orchestration scales with risk.** Small work happens in the main session. Normal features get one builder and a deterministic gate. Risky work adds independent, adversarial reviewers.
- **Done means deployed.** The template counts as working when a real project runs on it in production, not when its checks pass locally.
- **It learns, with brakes.** Lessons from real projects become rules only after they recur. Rules are capped and pruned.

## Shape

```
core/             shared by every project: gate runner, rules + tests, agent instructions,
                  brief template, lessons loop, sync
templates/web/    TanStack Start on Cloudflare, with presets for sites and dashboards
recipes/          documented, tested add-ons: databases, auth, deploy targets, observability
build-log/        how it's being built, in order
```

A mobile template (Expo) will share the same core once a real mobile project needs it.

## Defaults

Bun, React 19, Vite, Tailwind 4, TypeScript strict, TanStack Start with exact pinned versions, Cloudflare Workers, oxlint. Data and auth are per-project recipes (Supabase, or better-auth with Drizzle).

## Open core

The core, the web template and the basic recipes are open source. Premium add-ons (taste packs, larger recipes, the mobile template and upgrade tooling) will be offered separately. They are copied in at development time and never become runtime dependencies.

## License

[MIT](LICENSE)
