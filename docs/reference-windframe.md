# Reference: Windframe, design taste sold to AI agents

[Windframe](https://windframe.dev) is an AI Tailwind UI builder that now sells "design
taste for AI agents": style presets (Linear, Stripe, Vercel, Apple and others) served to
coding agents through an MCP server. It is the closest existing product to Vitali Stack's
planned taste packs, so we read it end to end on 2026-11-12, from public pages only, and
ran our own gate rules against its site. Facts below are what we saw on that date.

## How it works

- **A style is data.** Each preset holds a philosophy, a font, 4 to 6 colour roles (each
  with a light and a dark value and a one-line job, such as "actions, links, focus,
  charts and selected states"), a radius rule, spacing as Tailwind classes plus prose,
  one shadow rule and five traits. [Stripe, read in detail](reference-stripe-style.md).
- **The MCP serves context, not code.** Two tools, one for new UI and one for restyling
  existing UI. Each takes a prompt, a style and a primary colour, asks the user when
  style or colour is missing, and returns a link to a style-context resource. The user's
  own agent reads it and writes the code. Because the user's agent does the generating,
  calls can be sold as unlimited for a flat monthly price.
- **A public skill** teaches the agent to call the server and never pick a style or
  colour on the user's behalf.
- **Each new preset ships to the editor, the templates and the MCP on the same day.**

## What we take for taste packs

- **The shape.** Philosophy, font, a fixed set of colour roles with a job line and a
  required light/dark pair, radius, two spacing regimes, one shadow rule, traits. Ship it
  as a `tokens.css` fragment plus a rules file, copied in at development time. No live
  service, no sign-in, nothing at runtime.
- **Prove every pack with the gate.** Fixtures and a contrast test for each pack, the same
  as each rule. Windframe's presets ship accent pairs that fail WCAG AA (3.2 to 3.9:1)
  and input borders under 2:1; a gate would have caught them.
- **Fixed role names, fail closed.** Windframe's role names vary per style and an unknown
  style silently falls back to a default. A pack with a missing role should fail the gate.
- **Name packs by posture, not brand,** and ship open-licence fonts. Brand readings stay
  learning documents like `reference-stripe-style.md`.
- **Restyle is a job.** "Make this existing screen follow the pack" deserves its own
  recipe next to "build a new screen".
- **Ask, don't assume.** Pack instructions should tell the agent to ask the user when a
  choice is the user's, as Windframe's skill does.

## What our gate found on their site

We applied the seven gate rules to the rendered pages of `/`, `/ai`, `/pricing`,
`/blocks` and `/styles/stripe`.

| Rule | Result |
|---|---|
| no-default-ai-gradient | fires (`from-indigo-200 via-lime-200 to-purple-300` glow) |
| no-raw-palette | fires (1,586 default-palette class uses on the homepage) |
| no-emoji-icon | fires (an emoji-only icon in the sitewide banner) |
| no-slop-copy | fires (em dashes on every page, and five phrases from our banned list) |
| require-accessible-name | fires (icon links and buttons without names, images without alt) |
| no-side-accent-border | clean |
| no-bounce-motion | clean |

Their homepage says AI-made UI shouldn't look like slop. Five of seven rules firing on
that page is the case for enforcement over presets: a preset says what good looks like,
and only a gate stops what bad looks like.

**A gap in our gate.** The most visible pattern on their homepage, a multi-hue glow
border (`from-yellow-400 via-pink-500 to-blue-400`), passes `no-default-ai-gradient`,
because no stop sits on the purple side the rule keys on. Candidate rules from the same
pages: rainbow glow borders, content hidden at opacity 0 until scrolled, and headings
written as styled `<p>`.

## Other things worth knowing

- **Discovery.** Server-rendered pages, JSON-LD on every page type, an `llms.txt`, and a
  `robots.txt` that welcomes the major AI crawlers. Hundreds of programmatic Tailwind
  reference pages, each with a live playground.
- **Keep machine-readable facts in step with visible ones.** Their `llms.txt`, structured
  data and pricing page disagreed with each other on user counts and plans. One source
  that generates all of them avoids that.
