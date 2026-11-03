export function Bad() {
  return (
    <div>
      <div className="bg-linear-to-r from-purple-500 to-indigo-500">Hero</div> {/* @expect no-default-ai-gradient */}
      <div className="bg-linear-to-br from-indigo-600 via-purple-600 to-blue-500">Hero</div> {/* @expect no-default-ai-gradient */}
      <div className="bg-linear-to-r from-violet-500 to-fuchsia-500">Hero</div> {/* @expect no-default-ai-gradient */}
      <div className="bg-linear-to-r from-purple-500 to-pink-500">Hero</div> {/* @expect no-default-ai-gradient */}
      <div className="bg-linear-to-r dark:from-violet-500 dark:to-rose-500">Hero</div> {/* @expect no-default-ai-gradient */}
      <div className="bg-linear-to-r from-[#7c3aed] to-[#4f46e5]">Hero</div> {/* @expect no-default-ai-gradient */}
      <div style={{ background: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)" }}>Hero</div> {/* @expect no-default-ai-gradient */}
      <div style={{ backgroundImage: "linear-gradient(to right, rgb(124 58 237), hsl(330 80% 60%))" }}>Hero</div> {/* @expect no-default-ai-gradient */}
      <div className="bg-[linear-gradient(135deg,#667eea,#764ba2)]">Hero</div> {/* @expect no-default-ai-gradient */}
      <h1 className="bg-linear-to-r from-accent to-ink bg-clip-text text-transparent">Title</h1> {/* @expect no-default-ai-gradient */}
      <h1 className={cn("bg-clip-text", "text-transparent")}>Title</h1> {/* @expect no-default-ai-gradient */}
      <h1 style={{ WebkitBackgroundClip: "text" }}>Title</h1> {/* @expect no-default-ai-gradient */}
      {/* vs-allow no-default-ai-gradient: brand illustration approved in review, not UI chrome */}
      <div className="from-purple-500 to-indigo-500">Art</div>
      {/* vs-allow no-default-ai-gradient */}
      <div className="from-purple-500 to-indigo-500">Art</div> {/* @expect no-default-ai-gradient */}
    </div>
  )
}
