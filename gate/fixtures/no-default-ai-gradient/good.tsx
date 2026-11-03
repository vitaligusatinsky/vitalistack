export function Good() {
  return (
    <div>
      <div className="bg-linear-to-r from-accent to-surface-raised">Token gradient</div>
      <div className="bg-linear-to-b from-surface via-surface-raised to-surface">Token gradient</div>
      <div className="from-accent dark:to-surface">Mixed variants with tokens</div>
      <div className="from-[#3b82f6] dark:from-[#8b5cf6]">One stop per variant</div>
      <div className="from-[#3b82f6] to-[#06b6d4]">Blue to cyan</div>
      <div style={{ background: "linear-gradient(90deg, #ef4444, #f59e0b)" }}>Warm</div>
      <div style={{ background: "linear-gradient(90deg, var(--color-surface), var(--color-surface-raised))" }}>Tokens</div>
      <div className="from-[#10b981] to-[#06b6d4]">Green to teal</div>
      <input className="bg-transparent text-transparent" readOnly />
      <div className="bg-clip-padding">Clip padding</div>
      <h1 className="text-title font-semibold">Plain emphasis</h1>
      <h1 style={{ backgroundClip: "padding-box" }}>Padding box</h1>
    </div>
  )
}
