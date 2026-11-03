export function Bad() {
  const features = [
    { icon: "⚡", title: "Fast" }, // @expect no-emoji-icon
    { icon: "🔒", title: "Secure" }, // @expect no-emoji-icon
  ];
  const nav = [{ label: "🏠 Home", href: "/" }]; // @expect no-emoji-icon
  const tabs = [{ title: "📊 Stats" }]; // @expect no-emoji-icon
  const card = { emoji: "🧪", name: "Lab" }; // @expect no-emoji-icon
  toast("🎉 Saved"); // @expect no-emoji-icon
  toast.success("✅ Done"); // @expect no-emoji-icon
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
      <div className="text-4xl">🚀</div> {/* @expect no-emoji-icon */}
      <span>✨ 🎉</span> {/* @expect no-emoji-icon */}
      <button>{"🚀 Launch"}</button> {/* @expect no-emoji-icon */}
      <button>{open ? "🔽 Less" : "More"}</button> {/* @expect no-emoji-icon */}
      <h5>🎯 Goals</h5> {/* @expect no-emoji-icon */}
      <h6>📌 Pinned</h6> {/* @expect no-emoji-icon */}
      {features.length}
    </div>
  )
}
