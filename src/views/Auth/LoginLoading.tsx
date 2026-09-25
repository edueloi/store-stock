import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface LoginLoadingProps {
  onDone: () => void;
}

const STEPS = [
  "Verificando credenciais...",
  "Carregando permissões...",
  "Preparando o painel...",
];

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
    <motion.svg viewBox="180 42 300 260" role="img" aria-label="Store BoxSys" className="h-24 w-24 overflow-visible" initial="hidden" animate="visible">
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
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Avança os steps de texto
    const stepTimers = [
      setTimeout(() => setStep(1), 600),
      setTimeout(() => setStep(2), 1300),
    ];

    // Barra de progresso suave
    let current = 0;
    const interval = setInterval(() => {
      current += Math.random() * 6 + 2;
      if (current >= 100) {
        current = 100;
        clearInterval(interval);
      }
      setProgress(current);
    }, 60);

    // Navega depois que a animação terminar
    const done = setTimeout(() => onDone(), 2200);

    return () => {
      stepTimers.forEach(clearTimeout);
      clearInterval(interval);
      clearTimeout(done);
    };
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#f4f6f9]"
    >
      {/* Grid pattern de fundo */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.04) 1px,transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Glow suave no topo */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(251,191,36,0.12),transparent)]" />

      <div className="relative flex flex-col items-center gap-6 px-6">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 shadow-sm"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
            Acesso Liberado
          </span>
        </motion.div>

        {/* Ícone com fundo branco */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 20 }}
          className="flex h-32 w-32 items-center justify-center rounded-[2rem] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.10)]"
        >
          <AnimatedStoreBoxMark />
        </motion.div>

        {/* Nome */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.72 }}
          className="text-center"
        >
          <p className="text-4xl font-black tracking-[-0.04em] text-slate-900">
            <span className="text-[#f58d0a]">Store</span><span className="text-[#297ed1]"> BoxSys</span>
          </p>
          <div className="mt-1.5 flex items-center justify-center gap-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-400">
              Sistema de Gestão
            </span>
            <span className="h-3 w-px bg-slate-300" />
            <AnimatePresence mode="wait">
              <motion.span
                key={step}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400"
              >
                {step === 0 ? "Verificando" : step === 1 ? "Carregando" : "Entrando"}
              </motion.span>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Mensagem dinâmica */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.82 }}
          className="text-center"
        >
          <AnimatePresence mode="wait">
            <motion.p
              key={step}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="text-sm text-slate-500"
            >
              {STEPS[step]}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* Barra de progresso */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0.8 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.9 }}
          className="w-60"
        >
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-slate-800 to-amber-400"
              style={{ width: `${progress}%` }}
              transition={{ ease: "easeOut" }}
            />
          </div>

          {/* Dots animados */}
          <div className="mt-3 flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-amber-400"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
