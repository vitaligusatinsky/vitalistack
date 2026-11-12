# Reference: the Stripe style, as read by Windframe

A place to learn from, not a theme to copy. [Windframe's "Stripe style"
page](https://windframe.dev/styles/stripe) (read 2026-11-12) describes the design
language behind Stripe's marketing and product pages. Windframe wrote it to steer its
AI generator; it is not published or endorsed by Stripe.

The point for Vitali Stack is the reasoning. The values below are Windframe's,
spot-checked against stripe.com in November 2026. Your project's look belongs in
`src/styles/tokens.css`, and the gate's ratchet blocks raw values anywhere else.

## The ideas worth taking

- **Structure without decoration.** Hierarchy comes from grid rails, dividers, type
  scale and whitespace. A shadow means "this floats" (a form, a comparison, a
  segmented control, an overlapping callout), never a default card style. This is
  the same instinct behind the gate's rules against side accent borders and default
  gradients.
- **Light weights at large sizes.** Display text at weight 300 with slightly negative
  letter spacing reads precise rather than loud. Controls sit at 400.
- **One accent with a job list.** The accent is for actions, links, focus, charts and
  selected state, and nothing else. Text stays navy and slate.
- **Colour roles, not swatches.** Five roles, each with a light and a dark value:
  canvas, primary text, muted text, theme, quiet surface (grouped regions, inputs).
  If your tokens can't fill all five in both modes, the system has a gap.
- **Two spacing regimes on one grid.** An 8px grid, dense product gaps of 64 to 80px,
  roomier marketing gaps of 96 to 128px, cards padded 20 to 32px.
- **Small radii, pills only to convert.** Surfaces at 4 to 8px; the pill shape marks
  the control that converts.
- **Dark mode is pure black,** with the accent lifted a step to keep contrast.

## As published

| Role | Light | Dark |
|---|---|---|
| Canvas | white | black |
| Primary text | `#0a2540` | white |
| Muted text | `#63738d` | `#9aa8bd` |
| Primary theme | `#533afd` | `#7c6aff` |
| Quiet surface | neutral-50 | neutral-900 |

Type: Sohne Var, which is a licensed commercial typeface. On stripe.com today the
headings measure at weight 300, not the 400 Windframe lists, and body navy is
`#061b31`.

## Don't

- Paste these values into `tokens.css` as your brand. Decide your own roles and use
  this as a check.
- Use Sohne without a licence, or Stripe's name, logo or copy in what you ship.
