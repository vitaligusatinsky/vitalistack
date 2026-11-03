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
| 2026-11-02 | The project teaches first: own your stack and know the fundamentals of building with AI | Content and learning come before revenue. |
| 2026-11-02 | Copyright holder is DesignAnswers Oy | The company that maintains and sells Vitali Stack. |
| 2026-11-03 | The app lives at the repository root, not under a `templates/` folder | Someone who clones the repo gets a working app; one stack needs no template indirection yet. |
| 2026-11-03 | Gate rules are plain TypeScript files, not oxlint plugins or ast-grep rules | No extra dependency, readable by a learner, and each rule is fixture-tested the same way. |
| 2026-11-03 | The ratchet runs before every push (on the pushed commits) and in CI, against the remote or pull request base; with no base it runs a full blocking scan | It blocks new hardcoded visual values, so a value a file already had does not block adoption, and a missing base never means a free pass. |
| 2026-11-03 | The active rule set is seven rules plus the ratchet: raw palette, side accent border, default gradient, bounce motion, emoji icons, slop copy, accessible names | The set spans design, UX and copy. The eyebrow-pill and decorative-numbering rules were built but need heuristics that fire on legitimate markup, so they are candidates, not active. |
| 2026-11-03 | The escape hatch is `vs-allow <rule-id>: <reason>`, read from real comments only | The guidance catalogue calls it `ds-allow`; this project is not the design system, so it uses its own name. A string that contains the text must not exempt anything. |
| 2026-11-03 | When no base resolves, the ratchet runs a full scan and blocks | A new project starts with no debt. Checking only uncommitted changes would pass everything on a first push or on main. |
| 2026-11-03 | The pre-push hook checks the pushed commits (`--rev`), not the working tree | Fixing a violation on disk must not let the committed one through. |
| 2026-11-03 | `.github/CODEOWNERS` covers the gate, the hooks and CI | A pull request can change the gate that checks it, so that change needs a reviewer. |
| 2026-11-03 | Code is masked with the TypeScript parser, not a hand-written scanner | Regex literals, JSX text and glued keywords broke the hand-written masker in ways that hid violations. |
