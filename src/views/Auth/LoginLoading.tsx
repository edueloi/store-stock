import { useEffect } from "react";
import { motion } from "motion/react";

interface LoginLoadingProps {
  onDone: () => void;
}

const BOX_PIECES = [
  { points: "367,77 328,57 236,104 234,109 269,127 273,127 366,80", color: "#297ed1", x: -24, y: -34, rotate: -8 },
  { points: "348,105 350,108 385,126 389,126 422,108 420,104 387,87", color: "#297ed1", x: 24, y: -30, rotate: 8 },
  { points: "196,149 198,155 282,198 287,198 319,167 319,163 233,119 228,119", color: "#ed670e", x: -42, y: 3, rotate: -6 },
  { points: "458,149 427,119 422,119 338,162 337,167 369,198 373,198 455,156", color: "#eb5e10", x: 42, y: 3, rotate: 6 },
  { points: "224,183 225,238 308,284 321,289 322,186 292,214 287,215", color: "#e53b2c", x: -18, y: 28, rotate: -3 },
  { points: "430,184 369,216 365,216 334,186 335,288 430,238", color: "#f7920c", x: 18, y: 28, rotate: 3 },
];

function AnimatedStoreBoxMark() {
  return (
    <motion.svg viewBox="180 42 300 260" role="img" aria-label="Store BoxSys" className="h-20 w-20 overflow-visible" initial="hidden" animate="visible">
      {BOX_PIECES.map((piece, index) => (
        <motion.polygon
          key={piece.points}
          points={piece.points}
          fill={piece.color}
          stroke={piece.color}
          strokeWidth="1.2"
          strokeLinejoin="round"
          variants={{
            hidden: { opacity: 0, x: piece.x, y: piece.y, rotate: piece.rotate, scale: 0.82 },
            visible: { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 },
          }}
          transition={{ duration: 0.62, delay: 0.12 + index * 0.075, ease: [0.22, 0.9, 0.34, 1] }}
        />
      ))}
    </motion.svg>
  );
}

export default function LoginLoading({ onDone }: LoginLoadingProps) {
  useEffect(() => {
    const done = setTimeout(() => onDone(), 1500);
    return () => clearTimeout(done);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white"
    >
      <AnimatedStoreBoxMark />
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-5 text-3xl font-black tracking-[-0.04em]"
      >
        <span className="text-[#f58d0a]">Store</span><span className="text-[#297ed1]"> BoxSys</span>
      </motion.p>
      <div className="mt-8 h-[3px] w-28 overflow-hidden rounded-full bg-slate-100">
        <motion.div
          className="h-full w-1/2 rounded-full bg-[#297ed1]"
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
}
