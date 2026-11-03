export function Bad() {
  const tagline = "Elevate your workflow"; // @expect no-slop-copy
  return (
    <div>
      <h1>Unlock the potential of your workflow</h1> {/* @expect no-slop-copy */}
      <p>We build fast — then verify</p> {/* @expect no-slop-copy */}
      <p>A seamless experience</p> {/* @expect no-slop-copy */}
      <p>Great question! Let&apos;s go</p> {/* @expect no-slop-copy */}
      <p>Let's dive in</p> {/* @expect no-slop-copy */}
      <p>Cutting-edge tools for modern teams</p> {/* @expect no-slop-copy */}
      <p>A game changer for everyone</p> {/* @expect no-slop-copy */}
      <p>Speed &mdash; with checks</p> {/* @expect no-slop-copy */}
      <p title="Supercharge your day">x</p> {/* @expect no-slop-copy */}
      <p>{`In today's world ${tagline}`}</p> {/* @expect no-slop-copy */}
      {/* vs-allow no-slop-copy: quoting a competitor's slogan in a comparison table */}
      <p>Revolutionize everything</p>
      {/* vs-allow no-slop-copy */}
      <p>Next-level results</p> {/* @expect no-slop-copy */}
    </div>
  )
}
