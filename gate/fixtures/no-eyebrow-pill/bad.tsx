export function Bad() {
  return (
    <section>
      <span className="rounded-full bg-surface-raised px-3 py-1 text-xs uppercase tracking-widest">Now live</span> {/* @expect no-eyebrow-pill */}
      <p className="text-xs uppercase tracking-wider text-ink-muted">Features</p> {/* @expect no-eyebrow-pill */}
      <h2 className="text-title">Everything you need</h2>
      <span className={cn("uppercase", "tracking-widest", "rounded-full")}>Beta</span> {/* @expect no-eyebrow-pill */}
      <span className="md:uppercase md:tracking-wide rounded-full px-2">New</span> {/* @expect no-eyebrow-pill */}
      <div className="uppercase tracking-[0.2em] text-xs">Why us</div> {/* @expect no-eyebrow-pill */}

      <h3 className="text-title">Heading on the same line</h3>
      {/* vs-allow no-eyebrow-pill: status badge with real meaning, reviewed */}
      <span className="rounded-full px-2 uppercase tracking-wide">Paid</span>
      {/* vs-allow no-eyebrow-pill */}
      <span className="rounded-full px-2 uppercase tracking-wide">Paid</span> {/* @expect no-eyebrow-pill */}
      {/* vs-allow no-eyebrow-pill: short */}
      <span className="rounded-full px-2 uppercase tracking-wide">Paid</span> {/* @expect no-eyebrow-pill */}
    </section>
  )
}
