import { motion } from "motion/react";

const OVERSHOOT = [0.34, 1.56, 0.64, 1];

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
  const f = { type: "spring", duration: 0.4 }; // @expect no-bounce-motion
  const g = { type: "spring" }; // @expect no-bounce-motion
  const h = { ease: "backOut" }; // @expect no-bounce-motion
  const i = { ease: "anticipate" }; // @expect no-bounce-motion
  const j = { ease: OVERSHOOT, duration: 0.3 }; // @expect no-bounce-motion
  const k = "bounce 1s infinite"; // not a declaration, so not flagged
  // vs-allow no-bounce-motion: celebratory confetti only, shown once after checkout
  const l = { type: "spring", bounce: 0.3 };
  // vs-allow no-bounce-motion
  const m = { type: "spring", bounce: 0.3 }; // @expect no-bounce-motion
  return (
    <div>
      <div className="animate-bounce">Down</div> {/* @expect no-bounce-motion */}
      <div className="ease-[cubic-bezier(0.34,1.56,0.64,1)] transition">Pop</div> {/* @expect no-bounce-motion */}
      <div className="md:animate-bounce">Down</div> {/* @expect no-bounce-motion */}
      <div className="animate-[bounce_1s_infinite]">Down</div> {/* @expect no-bounce-motion */}
      <div style={{ animation: "bounce 1s infinite" }}>Down</div> {/* @expect no-bounce-motion */}
      {a.type}{b.type}{c.bounce}{d.ease}{e}{f.type}{g.type}{h.ease}{i.ease}{j.ease}{k}{l.type}{m.type}{motion.length}
    </div>
  )
}
