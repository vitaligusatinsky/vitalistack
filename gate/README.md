# The gate

`bun run gate` blocks known coding-agent slop: seven rules that span design, UX and copy, plus a ratchet that stops new hardcoded visual values. It does not make a design good. It stops a short, specific list of patterns that agents produce by default.

Every rule is plain TypeScript with a fixture that proves it fires. Run the proof yourself:

```sh
bun run gate:prove   # shows each rule firing on its bad fixture
bun test gate        # asserts the fired lines equal the marked lines, exactly
```

## What runs, and on what

`bun run gate` runs these in order and stops at the first failure:

1. `tsc --noEmit` (typecheck)
2. `oxlint` (with the `jsx-a11y` rules listed below)
3. `bun test gate` (rule fixtures, engine and ratchet tests)
4. `bun gate/run.ts` (the seven rules)
5. `bun gate/ratchet.ts` (new hardcoded visual values)

The `.githooks/pre-push` hook runs steps 1 and 2 on your working tree, then runs steps 4 and 5 on **the commits being pushed** (`--rev <sha>`), so a violation cannot be fixed on disk only and still be pushed. Step 3 tests the gate itself and takes about a minute, so the hook leaves it to `bun run gate` and CI, which run all five steps on every pull request and push to main.

`git push --no-verify` skips the hook. CI is the backstop.

## Scope

The rules read every tracked and untracked (not ignored) file ending in `.ts .tsx .js .jsx .mjs .cjs .css .md .mdx`, wherever it sits. These are not read:

- `node_modules/`, `dist/`, `.tanstack/`, `.wrangler/`
- code under `gate/` (the engine and its fixtures), `scripts/`, `.github/`, `public/`
- `*.config.*`, `routeTree.gen.ts`, `*.test.*`, `*.spec.*`, `CHANGELOG*`
- the one path `src/styles/tokens.css`, where raw values belong

Markdown is read by `no-slop-copy` only. Code and CSS are read by the other six rules.

## The seven rules

| Rule | Blocks | Why | Known misses |
|---|---|---|---|
| `no-raw-palette` | Tailwind default palette utilities (`bg-blue-500`, `text-gray-600`, `bg-white`, `border-black/10`, `inset-ring-gray-300`), a trailing or leading `!`, and `var(--color-<palette>-<shade>)` | Agents colour UI with the default palette, which bypasses your tokens. | Classes built from variables or string concatenation. Palette names not in Tailwind 4.3.4. |
| `no-side-accent-border` | `border-l-<n>` and `border-s-<n>` of 2px or more (including `border-l-[0.25rem]`); CSS or inline `border-left`, `border-inline-start` and `border-width: 0 0 0 4px` of 2px or more | The coloured left bar on cards and callouts signals generated design. | Right and end borders are allowed on purpose (split panes, sidebars). Bars made with `box-shadow` or `border-image`. |
| `no-default-ai-gradient` | Purple, violet, indigo, fuchsia, pink or rose gradient stops paired in one variant; any `linear-`, `radial-` or `conic-gradient()` and arbitrary `from-[#..]`/`to-[#..]` stops with two or more colours in the 225 to 335 degree hue band, one of them on the purple side; gradient text (`bg-clip-text` with `text-transparent`, `background-clip: text`) | The default "modern" gradient and gradient headline. | Named colours and `var()` stops in gradients. `oklab`, `lab`, `lch` stops. |
| `no-bounce-motion` | `animate-bounce`, `animation: bounce`, overshooting `cubic-bezier()` and `ease: [..]` curves (also through a same-file `const`), `ease: "backIn" / "backOut" / "backInOut" / "anticipate"`, `bounce:` above 0, and `type: "spring"` whose damping ratio is below 1 | Bouncy motion reads as playful noise in product UI. | Spring options are read only in files that import `motion`, `framer-motion` or `react-spring`, or inside a `transition` object. react-spring `tension`/`friction` configs and `config.wobbly` are not read. A duration-based spring with no `bounce:` is treated as the library default (0.25, bouncy). |
| `no-emoji-icon` | An emoji in JSX text, or in `label`, `title`, `aria-label`, `alt`, `placeholder` strings, inside `nav`, `header`, `button`, `a`, `li`, `h1` to `h4` or a component named `*Button`, `*Link`, `*NavItem`, `*Title`, `*Heading`; and any string in an `icon` field or prop | Agents use emoji where an icon belongs. | Emoji in a plain `<p>` is user text and passes. The context is any ancestor, so `<li><p>text 🚀</p></li>` fires. `©`, `®`, `™`, arrows, digits, `#` and `*` do not count. |
| `no-slop-copy` | Banned phrases (see `gate/rules/copy-phrases.ts`, a plain array you can edit) and every em dash, in JSX text, string literals and all markdown. Code fences and inline code in markdown are skipped | Agents fill copy with stock phrases and em dashes. | Phrases match as whole words, so `seamless` is blocked and `seamlessly` is not. Add both if you want both. Copy built from variables. |
| `require-accessible-name` | `<button>`, `<a>`, `<Button>`, `<IconButton>`, `<Link>` whose children are only self-closing PascalCase components (icons) with no `aria-label`, `aria-labelledby` or `title`; `<img>` without `alt` | Icon-only controls and images that a screen reader announces as nothing. | Elements with a spread (`{...props}`) are skipped. Icons wrapped in other elements. |

### Who covers what in `require-accessible-name`

oxlint 1.90.0 with the `jsx-a11y` plugin covers three things, enabled in `.oxlintrc.json` and proven on `gate/fixtures/require-accessible-name/oxlint-bad.tsx`:

- `jsx-a11y/alt-text`: `<img>` without `alt`
- `jsx-a11y/anchor-has-content`: an empty `<a>`
- `jsx-a11y/control-has-associated-label`: an empty `<button>` or `<a>`

oxlint does not flag `<button><TrashIcon /></button>`, because a component might render text. The gate rule covers that case: an icon-only control with no accessible name. It also checks `<img>` without `alt` itself, so that check is made twice.

A finding is reported at the line where the element opens. Multi-line JSX works.

## The escape hatch

A finding is exempt when a real comment carries `vs-allow <rule-id>: <reason>`:

- a comment on its own line exempts the next line
- a trailing comment exempts its own line

```tsx
{/* vs-allow no-raw-palette: vendor logo colour must match the logo */}
<div className="bg-sky-500" />
```

The reason needs at least 10 characters and a word of 3 or more letters. A bare `vs-allow`, a short reason or `..........` exempts nothing. Only comment tokens count: a string that contains `// vs-allow ...` does nothing, and neither does `// vs-allow` in a CSS file (CSS has `/* */` comments only). In markdown use `<!-- vs-allow ... -->`.

Every run prints each exemption it used as `file:line rule-id "reason"`. The count is of comments, not findings.

## The ratchet

`gate/ratchet.ts` blocks **new** raw visual values: colours (hex, `rgb`, `hsl`, `oklch`, `oklab`, `lab`, `lch`, `color-mix`, and named colours where a colour is set), raw pixel values, raw shadows, Tailwind arbitrary values with a unit (`w-[13px]`, `w-[2rem]`, `h-[80vh]`), and numeric React style values (`padding: 12`, `fontSize: 14`; zero is fine). Put raw values in `src/styles/tokens.css`.

It does not report hex fragments and URLs (`href="#abc"`, `to="#faq"`, `id="#x"`, `location.hash`, `/docs#abc`), pixel widths inside `@media`, `@container`, `matchMedia(` or `useMediaQuery(`, or `min-[600px]:` variants.

**What counts as new, exactly.** For each changed file the ratchet compares a multiset of (rule, matched token) with the file at the base. A token the file already had is not new, so editing `p-4` to `p-6` on a line that holds an old `w-[13px]` reports nothing. A second `w-[13px]` in the same file is new. A value moved to another file is new. A renamed file keeps its history. Changing an old value to a different raw value is new.

### How the base is chosen

The first of these that resolves, and the run prints which one:

1. `--base=<ref>`
2. the `GATE_BASE` environment variable (empty or all zeros counts as unset)
3. `git merge-base <rev> @{upstream}`
4. `git merge-base <rev> origin/main`

A `--base` or `GATE_BASE` that does not resolve is an error, not a fallback.

**If none resolves, the ratchet runs a full scan and blocks on every raw value it finds**, and prints `ratchet: no base found, running the full scan (blocking)`. A new project starts with no debt, so this is the safe default. On CI, a merge-base equal to the commit being checked also means nothing to compare, so it takes the same path.

- **The hook** passes the remote's sha as the base. For a new branch it uses the merge-base with the remote's default branch. If the remote sha is not in your clone, or there is no default branch, the full scan runs.
- **CI** uses the pull request base for pull requests and `github.event.before` for pushes. A first push or force push has no usable base, so it runs the full scan.

`--full` also prints the count of all raw values in scope as information. It never blocks. `--rev <sha>` checks that commit instead of the working tree.

The git commands run from the package directory, so the same code works when this project is the repository root and when it sits in a subdirectory of a larger repository. Both layouts are tested.

## Parsing

Code files are tokenised with the TypeScript parser, so comments are found exactly: a regex literal holding a quote, `//` in JSX text, `return"..."` and multi-line `className` strings are all handled. CSS has its own small masker that knows strings and `url(...)`. Markdown masks fenced code, inline code and HTML comments.

## Known misses

These are limits, stated plainly:

- The rules read source text, not a rendered page. A class built at runtime (`"bg-" + colour`) is invisible.
- Files outside the scan (see Scope) are not checked. `public/` assets and `scripts/` can hold anything.
- The hook checks the tip of each pushed ref. Earlier commits in the push are not checked one by one.
- A pull request can change the gate. `.github/CODEOWNERS` makes that a reviewed change, and CI prints a warning that lists changed files under `gate/` and `.githooks/`.
- The ratchet's `raw-style-number` rule also sees objects that are not styles (`{ top: 5 }`).
- Emoji detection uses `\p{Extended_Pictographic}` minus `©`, `®`, `™` and the arrow block.
- Markdown indented code blocks and front matter are scanned like prose.
- `ease: SOME_CONST` is followed only for a four-number array declared in the same file.

## Candidates, not active

Two rules were built, tested and then removed from the active set. They stay in git history.

- **Eyebrow pill** (uppercase, letter-spaced label above a heading). It needs a "heading within 3 lines" guess, so it fires on table headers and real status badges. The false-positive rate was too high for a hard block.
- **Decorative numbering** (`01`, `02`, `03`). A legitimate ordered sequence, a clock `padStart(2, "0")` or a zero-padded month looks the same as decoration.

## Add a rule

1. Create `gate/rules/<rule-id>.ts` that default-exports `{ id, title, why, fix, check(file, masked, info) }`. The id must match the file name. Set `extensions` if it reads more than code and CSS. `info` carries the parsed file, string literals, JSX text and class groups; `gate/scan.ts` has the helpers.
2. Create `gate/fixtures/<rule-id>/bad.tsx` (or `.css`, `.md`). Put `// @expect <rule-id>` (or `{/* @expect <rule-id> */}`, `/* ... */` in CSS, `<!-- ... -->` in markdown) at the end of every line that must fire. Include one `vs-allow` with a reason and one bare `vs-allow` that still fires.
3. Create `gate/fixtures/<rule-id>/good.tsx` with the nearest legitimate look-alikes. It must produce zero findings from every rule.

`gate/rules.test.ts` is generated from the rules folder. It fails if the lines a rule fires on differ from the marked lines in either direction, so a rule that silently stops matching cannot pass.
