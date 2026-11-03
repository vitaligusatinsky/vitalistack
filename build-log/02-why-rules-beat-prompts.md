# 02 · Why rules beat prompts

2026-11-03

You can ask a coding agent for "clean, minimal design" in every prompt. It will agree, and then hand you a purple-to-indigo gradient headline, emoji bullets and a thick coloured bar down the left side of a card. A prompt is a request. The agent weighs it against everything it has seen, and the defaults usually win.

A rule is different. It runs every time, on every change, and it doesn't care how the code was written. This week I built the first set of rules into the starter, and then had two reviewers try to break them.

## The fundamental

**Write the decision down once, as a check that fails.** If you only say it in a prompt, you will say it again tomorrow, and the agent will forget it again tomorrow. If you write it as a check, the agent finds out on its own and fixes it before you ever see the code.

That only works if the check is honest. A check that passes when it should fail is worse than no check, because it tells you things are fine.

## What I built

A stock TanStack Start app on Cloudflare, taken from TanStack's official example at a pinned commit, with every dependency pinned to an exact version. On top of it, `bun run gate`:

1. A typecheck and `oxlint`, including three accessibility rules.
2. The gate's own tests: every rule against its fixtures, plus the engine and ratchet tests.
3. Seven rules that block known agent slop:

| Rule | Blocks |
|---|---|
| `no-raw-palette` | Tailwind's default colours (`bg-white`, `text-gray-600`) instead of the project's tokens |
| `no-side-accent-border` | A thick border on the left edge used as an accent bar |
| `no-default-ai-gradient` | Purple-to-indigo or purple-to-pink gradients, and gradient text |
| `no-bounce-motion` | Bouncy springs, overshooting easing curves, `animate-bounce` |
| `no-emoji-icon` | Emoji used as icons or bullets in lists, buttons, links and headings |
| `no-slop-copy` | Stock phrases (`unlock the potential`) and em dashes, in code and in markdown |
| `require-accessible-name` | Icon-only buttons and links without a label, and images without `alt` |

4. The **ratchet**: it blocks any *new* hardcoded colour, pixel value, shadow or arbitrary Tailwind value, compared with the branch you started from. Old values don't block; new ones do. So a project that adopts the rules late can still stop the debt from growing.

The same checks run in a pre-push hook and in CI. The hook checks the commits you are pushing, not the files on your disk.

The full list, with what each rule misses, is in [`gate/README.md`](../gate/README.md).

## What it looks like

I wrote the kind of hero section an agent hands you on a first try and ran the gate on it:

```tsx
<section className="bg-white py-24">
  <h1 className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
    Unlock the potential of your workflow
  </h1>
  <p className="text-gray-600">Ship faster — with confidence.</p>
  <ul>
    <li>🚀 Lightning fast</li>
    <li>🔒 Secure by default</li>
  </ul>
  <div className="border-l-4 border-indigo-500 pl-4">Trusted by 10,000 teams</div>
  <motion.div animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 10 }} />
  <button onClick={() => {}}>
    <TrashIcon />
  </button>
  <p style={{ color: '#6366f1', padding: 13 }}>New</p>
</section>
```

Every rule fired. Trimmed output:

```
[no-bounce-motion]         transition={{ type: 'spring', stiffness: 300, damping: 10 }}
[no-default-ai-gradient]   from-purple-600 to-indigo-600 bg-clip-text text-transparent
[no-emoji-icon]            <li>🚀 Lightning fast</li>
[no-emoji-icon]            <li>🔒 Secure by default</li>
[no-raw-palette]           bg-white, from-purple-600, to-indigo-600, text-gray-600, border-indigo-500
[no-side-accent-border]    border-l-4
[no-slop-copy]             Unlock the potential of your workflow
[no-slop-copy]             Ship faster — with confidence.
[require-accessible-name]  <button> with only <TrashIcon />
gate: 7 rules, 11 files scanned, 14 finding(s)

ratchet: [raw-color]        color: '#6366f1'
ratchet: [raw-style-number] padding: 13
ratchet: 2 new raw visual value(s) added since the base
```

Each finding prints the fix next to it, so the agent reading the output knows what to do next.

## How I know the rules work

Each rule has a `bad` fixture and a `good` fixture. In the bad one, every line that must fire carries a marker comment, and the test checks that **the lines that fired are exactly the marked lines**: nothing missed, nothing extra. The good fixture holds the nearest legitimate look-alikes (a 1px divider, a token gradient, a critically damped spring, a `©` in a footer) and must stay silent.

Then a mutation test: paste one bad line per rule into the real app's home page and confirm the gate fails and names that rule. All seven did, and so did the ratchet with a new hex colour.

The suite is 159 tests. `bun run gate:prove` prints every rule firing on its fixture, for anyone who wants to see it without reading the tests.

## What broke

The first version passed all of its own tests. Then an independent reviewer agent was told to break it, and did:

- **Whole files were never checked.** Only `.ts`, `.tsx` and `.css` under `src/` were scanned, so a `.jsx` file passed untouched. Any file named `styles/tokens.css`, at any depth, was skipped as if it were the token file.
- **The pre-push hook checked the wrong thing.** It looked at the files on disk, so you could commit a violation, fix it locally without committing, and push the bad commit.
- **CI checked nothing on a push to main.** With no base to compare against, the ratchet compared main with itself and passed.
- **The most common AI gradient got through.** Purple to *pink* wasn't on the list, and neither were gradients written as hex colours.
- **A regex or a `//` in JSX text hid the rest of the line.** My hand-written comment stripper thought it had found a comment. I replaced it with the TypeScript scanner.
- **The escape hatch could be faked.** A string containing `// vs-allow` exempted the next line.
- **And the opposite problem:** it blocked legitimate code, like formatting a month as `"01"` or giving a sidebar a right border. False positives teach people to switch the gate off.

I fixed the holes, and every fix is now a test that failed before and passes after. For the false positives, I narrowed the rules that could be narrowed. Two rules, one for small uppercase "eyebrow" labels above headings and one for decorative `01 / 02 / 03` numbering, couldn't tell slop from legitimate use reliably enough, so they left the active set until they can. The ones I chose not to fix are written down as known misses in [`gate/README.md`](../gate/README.md). The biggest: rules read source text, so a class name built at runtime from a variable is invisible to them.

The copy rule also scans markdown, so it read this post before you did. The first draft quoted a banned phrase in a table, and the gate failed on it.

The lesson is the same as in [01](01-audit-and-two-reviewers.md): **a check graded by the person who wrote it is generous.** The tests proved the rules did what I meant. Only the hostile review showed what I hadn't meant to allow.

## What this doesn't do

These rules block known slop. They don't make a design good. A page can pass every rule and still be bland or badly spaced. That takes judgement and a designer's eye; the rules just clear the floor, so the judgement goes to what matters.

## Try it

```sh
bun install
bun run gate        # everything, about a minute and a half
bun run gate:prove  # watch each rule fire on its fixture
```

To add your own rule: a file in `gate/rules/`, a `bad` and a `good` fixture, and the test is generated for you.

## Next

A one-page site for the project, built on this starter, with a live demo: a prepared slop change, the gate fires, the fix, and green.
