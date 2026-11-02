export function Bad() {
  const a = { type: "spring", bounce: 0.4 }; // @expect no-bounce-motion
  const b = {
    type: "spring", // @expect no-bounce-motion
    stiffness: 300,
    damping: 10,
  };
  const c = { duration: 0.3, bounce: 0.25 }; // @expect no-bounce-motion
  const d = { ease: [0.34, 1.56, 0.64, 1] }; // @expect no-bounce-motion
  const e = "transform 300ms cubic-bezier(0.68, -0.55, 0.27, 1.55)"; // @expect no-bounce-motion
  // vs-allow no-bounce-motion: celebratory confetti only, shown once after checkout
  const f = { type: "spring", bounce: 0.3 };
  // vs-allow no-bounce-motion
  const g = { type: "spring", bounce: 0.3 }; // @expect no-bounce-motion
  return (
    <div>
      <div className="animate-bounce">Down</div> {/* @expect no-bounce-motion */}
      <div className="ease-[cubic-bezier(0.34,1.56,0.64,1)] transition">Pop</div> {/* @expect no-bounce-motion */}
      <div className="md:animate-bounce">Down</div> {/* @expect no-bounce-motion */}
      {a.type}{b.type}{c.bounce}{d.ease}{e}{f.type}{g.type}
    </div>
  )
}
