// Covered by oxlint's jsx-a11y plugin, not by the gate rule. Each marker names the oxlint rule.
export function OxlintBad() {
  return (
    <div>
      <img src="/hero.png" /> {/* @expect-oxlint alt-text */}
      <a href="/x"></a> {/* @expect-oxlint anchor-has-content @expect-oxlint control-has-associated-label */}
      <button></button> {/* @expect-oxlint control-has-associated-label */}
    </div>
  )
}
