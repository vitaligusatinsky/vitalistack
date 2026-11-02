# Decisions

Newest at the bottom. Each one records what was decided and why.

| Date | Decision | Why |
|---|---|---|
| 2026-11-02 | TanStack Start is the web framework | All recent projects used it; one stack keeps the kernel small. |
| 2026-11-02 | Cloudflare Workers is the default deploy target; Vercel and Netlify are recipes | Official TanStack hosting partner; one runtime makes config and secrets testable. |
| 2026-11-02 | oxlint is the only linter | Fast, and existing custom plugins can be ported. |
| 2026-11-02 | Data and auth are per-project recipes (Supabase, or better-auth with Drizzle) | Projects differ; access rules don't depend on the provider. |
| 2026-11-02 | A stack-agnostic core, with surface templates | Web ships first; Expo joins later on the same core. |
| 2026-11-02 | No shared package and no template-update tool yet | Hooks inside a package fail in fresh worktrees; added only once a second project needs updates. |
| 2026-11-02 | Open core (MIT) with premium add-ons that are copied in at development time | Keeps premium out of runtime dependencies and deploy builds. |
| 2026-11-02 | Built in public, with a build log for every phase | The process is part of the product. |
| 2026-11-02 | vitalistack.com is the project's home | Short, matches the name; the build-log site will live there on Cloudflare. |
