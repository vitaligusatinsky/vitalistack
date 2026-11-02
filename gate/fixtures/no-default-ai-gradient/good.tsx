export function Good() {
  return (
    <div>
      <div className="bg-linear-to-r from-accent to-surface-raised">Token gradient</div>
      <div className="bg-linear-to-b from-surface via-surface-raised to-surface">Token gradient</div>
      <input className="bg-transparent text-transparent" readOnly />
      <div className="bg-clip-padding">Clip padding</div>
      <h1 className="text-title font-semibold">Plain emphasis</h1>
      <h1 style={{ backgroundClip: "padding-box" }}>Padding box</h1>
    </div>
  )
}
