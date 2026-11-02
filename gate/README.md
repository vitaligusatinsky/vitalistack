# The gate

`bun run gate` blocks known coding-agent slop. It does not make a design good. It stops a short, specific list of patterns that agents produce by default, and it stops new hardcoded colours, pixel sizes and shadows from creeping in.

Every rule is plain TypeScript. Every rule has a fixture that proves it fires. Run the proof yourself:

```sh
bun run gate:prove   # shows each rule firing on its bad fixture
bun test gate        # asserts the fired lines equal the marked lines, exactly
```

## What `bun run gate` runs

In order, stopping at the first failure:

1. `tsc --noEmit` (typecheck)
2. `oxlint`
3. `bun test gate` (the rule fixtures and the ratchet tests)
4. `bun gate/run.ts` (the six hard rules over `src/`)
5. `bun gate/ratchet.ts` (new hardcoded visual values)

It runs before every `git push` (`.githooks/pre-push`, installed by `bun install`) and in CI on every pull request.

## The six hard rules

| Rule | Blocks | Why |
|---|---|---|
| `no-eyebrow-pill` | A small uppercase, letter-spaced label used as a kicker: `uppercase` + `tracking-wide/wider/widest` + `rounded-full`, or `uppercase` + wide tracking with an `<h1>`-`<h3>` opening within 3 lines after it | Agents add one above every heading by default. |
| `no-decorative-numbering` | `"01"`, `"02."`, `"/ 03"` as string or JSX text, and `padStart(2, "0")` in `.tsx` | Zero-padded section numbers carry no information. |
| `no-side-accent-border` | `border-l/r/s/e-<n>` with n of 2 or more, and CSS or inline `border-left/right/inline-start/inline-end` of 2px or more | The coloured left bar on a card or callout. |
| `no-default-ai-gradient` | Tailwind gradient stops pairing purple/violet/indigo/fuchsia with indigo/blue/purple/violet/fuchsia, and gradient text (`bg-clip-text` + `text-transparent`, or `background-clip: text`) | The default "modern" gradient. |
| `no-bounce-motion` | `animate-bounce`, `cubic-bezier()` or `ease: [...]` curves that overshoot (y1 or y2 outside 0..1), `bounce:` above 0, and `type: "spring"` without `bounce: 0` | Bouncy motion in product UI. |
| `no-raw-palette` | Tailwind default palette utilities such as `bg-blue-500`, `text-gray-600`, `bg-white`, `border-black/10` | They bypass your tokens. Use `bg-surface`, `text-ink` and friends. |

The report line for a finding is `file:line:col [rule-id] title`, the source line, and a one-line fix.

### What the rules do not see

They read source text, not a running page. Known limits: classes built from variables or string concatenation, regex literals, and values set in a `style` object through a helper. A thin heuristic treats a quote glued to the end of a word (`don't`) as an apostrophe. The rules catch the common agent shapes, not every possible spelling.

## The escape hatch

A finding is exempt only when the line directly above it holds a comment with the rule id and a reason of at least 10 characters:

```tsx
{/* vs-allow no-raw-palette: vendor logo colour must match the logo */}
<div className="bg-sky-500" />
```

```ts
// vs-allow no-decorative-numbering: clock display needs two digits
const pad = (n: number) => String(n).padStart(2, "0");
```

A bare `vs-allow no-raw-palette`, or a reason that is too short, exempts nothing. Every run prints how many exemptions it used, so they stay visible.

## The ratchet

`gate/ratchet.ts` blocks **new** raw colours, raw pixel values, raw shadows and Tailwind arbitrary visual values (`bg-[#fff]`, `w-[13px]`) under `src/`. Values that already exist never block, so you can adopt it on day one and only tighten. Put raw values in `src/styles/tokens.css`, which the ratchet ignores.

It compares the working tree (staged, unstaged and untracked files included) with a base commit, counting identical lines as a multiset: a second copy of an existing violation is new. A renamed file keeps its debt.

The base is the first of these that resolves, and the run prints which one it used:

1. `--base=<ref>`
2. the `GATE_BASE` environment variable
3. `git merge-base HEAD @{upstream}`
4. `git merge-base HEAD origin/main`
5. `HEAD` (uncommitted changes only)

A `--base` or `GATE_BASE` that does not resolve is an error, not a fallback. `--full` also prints the count of all raw values in `src/` as information. It never blocks.

The git commands run from the package directory, so the same code works when this project is the repository root and when it sits in a subdirectory of a larger repository. Both layouts are tested.

## Add a rule

1. Create `gate/rules/<rule-id>.ts` that default-exports `{ id, title, why, fix, check(file, maskedContent) }`. The id must match the file name. `maskedContent` is the file with comments blanked out and every line and column preserved; `gate/scan.ts` has helpers for class tokens and string literals.
2. Create `gate/fixtures/<rule-id>/bad.tsx` (or `.css`). Put `// @expect <rule-id>` (or `{/* @expect <rule-id> */}`, or `/* ... */` in CSS) at the end of every line that must fire. Include one `vs-allow` with a reason and one bare `vs-allow` that still fires.
3. Create `gate/fixtures/<rule-id>/good.tsx` with the nearest legitimate look-alikes. It must produce zero findings from every rule.

The test in `gate/rules.test.ts` is generated from the rules folder. It fails if the lines the rule fires on differ from the marked lines in either direction, so a rule that silently stops matching cannot pass.
