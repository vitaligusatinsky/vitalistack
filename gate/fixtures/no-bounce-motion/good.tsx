import { motion } from "motion/react";

const STANDARD = [0.4, 0, 0.2, 1];

export function Good() {
  const a = { type: "spring", bounce: 0 };
  const b = { type: "spring", duration: 0.3, bounce: 0.0 };
  const c = { type: "tween", ease: "easeOut", duration: 0.2 };
  const d = { ease: [0.4, 0, 0.2, 1] };
  const e = "transform 200ms cubic-bezier(0.4, 0, 0.2, 1)";
  const f = "opacity 150ms cubic-bezier(0.25, 0.1, 0.25, 1)";
  const g = { type: "spring", stiffness: 400, damping: 40 }; // damping ratio 1: no overshoot
  const h = { type: "spring", stiffness: 100, damping: 30, mass: 1 };
  const i = { ease: STANDARD, duration: 0.2 };
  const bounce = 3; // a variable, not a spring option
  return (
    <div>
      <div className="ease-out transition duration-200">Out</div>
      <div className="animate-spin">Spinner</div>
      <div className="animate-pulse">Skeleton</div>
      <div className="ease-[cubic-bezier(0.4,0,0.2,1)] transition">Standard</div>
      {a.type}{b.type}{c.type}{d.ease}{e}{f}{g.type}{h.type}{i.ease}{bounce}{motion.length}
    </div>
  )
}
