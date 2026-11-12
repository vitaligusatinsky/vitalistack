# Founder Pack

Before you build an app on Vitali Stack, find out whether the business behind it
works. The [Founder Pack](https://github.com/Jakeschincariol/founder-skill) by Jake
Schincariol is a free, MIT-licensed set of eleven Claude skills for that: a board
that scores the idea through three published frameworks, a competitor scout, a
simulated buyer panel, pricing, the offer, a CFO for unit economics, marketing,
brand, operations, a launch plan and a business plan with a verdict computed from
the numbers.

It is a third-party resource, not part of the template. Vitali Stack does not ship
or maintain it.

## Install it in your project

Pin it to a commit so the instructions your agents follow cannot change under you.
This guide was checked against commit `fd9385b` (2026-10-06).

```bash
git clone https://github.com/Jakeschincariol/founder-skill.git /tmp/founder-skill
git -C /tmp/founder-skill checkout fd9385b0cfe1b96bebce3898fbd506d73eff5a9d
cp -r /tmp/founder-skill/skills/founder-* .claude/skills/
```

Or as a Claude Code plugin: `/plugin marketplace add Jakeschincariol/founder-skill`,
then `/plugin install founder-skill@founder-skill`.

Read the skills before you install them. They are instructions your agent will
follow. At the pinned commit, the four Python tools use only the standard library
and make no network calls.

## Use it well

- Run them in order: board, competitors, consumer, pricing, offer, cfo, marketing,
  brand, ops, launch, plan. Each one reads what the others wrote in `founder/`.
  Add `founder/` to `.gitignore` if your app repo should not carry it.
- The consumer panel runs one sub-agent per buyer, 100 by default. Start with
  `--quick` (20 buyers).
- Simulated buyers are not customers. Treat the buy rate as an upper bound and
  never use panel answers as testimonials. Confirm the big calls with a real test,
  which `founder-launch` starts with.
- The numbers are only as good as the inputs. Check costs with suppliers and tax
  with an accountant.
