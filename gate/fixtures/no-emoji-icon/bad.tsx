export function Bad() {
  const features = [
    { icon: "⚡", title: "Fast" }, // @expect no-emoji-icon
    { icon: "🔒", title: "Secure" }, // @expect no-emoji-icon
  ];
  return (
    <div>
      <ul>
        <li>🚀 Lightning fast</li> {/* @expect no-emoji-icon */}
      </ul>
      <nav>
        <a href="/docs">📚 Docs</a> {/* @expect no-emoji-icon */}
      </nav>
      <button type="button">✨ Generate</button> {/* @expect no-emoji-icon */}
      <button aria-label="🗑 Remove" type="button">x</button> {/* @expect no-emoji-icon */}
      <h2>🎉 Welcome</h2> {/* @expect no-emoji-icon */}
      <PrimaryButton label="🔥 Go" /> {/* @expect no-emoji-icon */}
      <Card icon="🧠" /> {/* @expect no-emoji-icon */}
      <header>
        <span>💡 Tips</span> {/* @expect no-emoji-icon */}
      </header>
      <ul>
        {/* vs-allow no-emoji-icon: user-chosen reaction shown in a list, reviewed */}
        <li>👍 Liked</li>
        {/* vs-allow no-emoji-icon */}
        <li>👎 Disliked</li> {/* @expect no-emoji-icon */}
      </ul>
      {features.length}
    </div>
  )
}
