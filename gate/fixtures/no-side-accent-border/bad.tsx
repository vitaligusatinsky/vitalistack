export function Bad() {
  return (
    <div>
      <div className="border-l-4 border-accent p-4">Note</div> {/* @expect no-side-accent-border */}
      <div className="border-s-8 p-4">Note</div> {/* @expect no-side-accent-border */}
      <div className="border-l-[0.25rem] p-4">Note</div> {/* @expect no-side-accent-border */}
      <div className="border-s-[3px] p-4">Note</div> {/* @expect no-side-accent-border */}
      <div className="p-4 hover:border-l-4">Note</div> {/* @expect no-side-accent-border */}
      <div style={{ borderLeft: "4px solid" }}>Note</div> {/* @expect no-side-accent-border */}
      <div style={{ borderLeftWidth: 3 }}>Note</div> {/* @expect no-side-accent-border */}
      <div style={{ borderInlineStart: "0.25rem solid" }}>Note</div> {/* @expect no-side-accent-border */}
      <div style={{ borderWidth: "0 0 0 4px" }}>Note</div> {/* @expect no-side-accent-border */}
      {/* vs-allow no-side-accent-border: quote block reviewed as a deliberate citation mark */}
      <blockquote className="border-l-2 pl-4">Quote</blockquote>
      <blockquote className="border-l-2 pl-4">Quote</blockquote> {/* vs-allow no-side-accent-border: trailing form on the same line */}
      {/* vs-allow no-side-accent-border */}
      <blockquote className="border-l-2 pl-4">Quote</blockquote> {/* @expect no-side-accent-border */}
      {/* vs-allow no-side-accent-border: .......... */}
      <blockquote className="border-l-2 pl-4">Quote</blockquote> {/* @expect no-side-accent-border */}
    </div>
  )
}
