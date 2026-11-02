export function Good() {
  return (
    <div>
      <div className="border-l p-4">Divider</div>
      <div className="border-l-0">None</div>
      <div className="border-l-1">One</div>
      <div className="border-t-4 border-accent">Top</div>
      <div className="border-b-2">Bottom</div>
      <div className="border-2 border-border">Full</div>
      <div className="border-l-accent">Colour only</div>
      <div style={{ borderLeft: "1px solid" }}>One px</div>
      <div style={{ borderBottom: "4px solid" }}>Bottom</div>
    </div>
  )
}
