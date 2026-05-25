import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, LayoutDashboard, Sparkles, Store } from "lucide-react";

const STEPS = [
  "Criando sua loja...",
  "Configurando o painel...",
  "Preparando seu acesso...",
  "Tudo pronto!",
];

export default function WelcomeScreen({
  storeName,
  ownerName,
  onDone,
}: {
  storeName: string;
  ownerName: string;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const duration = 3200;
    const interval = 16;
    const increment = 100 / (duration / interval);
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      setProgress(Math.min(current, 100));
      setStep(Math.min(Math.floor((current / 100) * STEPS.length), STEPS.length - 1));

      if (current >= 100) {
        clearInterval(timer);
        setDone(true);
        setTimeout(onDone, 1200);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#0f172a]"
    >
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#C9A227]/8 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-blue-700/10 blur-[100px]" />
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-[#C9A227]/6 blur-[80px]" />
      </div>

      {/* Grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative flex flex-col items-center gap-8 px-6 text-center">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "backOut" }}
          className="relative"
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] bg-white shadow-[0_0_60px_rgba(201,162,39,0.3)]">
            <img src="/system/logo.png" alt="BoxSys" className="h-16 w-16 object-contain" />
          </div>
          <AnimatePresence>
            {done && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 shadow-lg"
              >
                <CheckCircle2 size={16} className="text-white" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Brand */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-1"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#C9A227]">BoxSys Store</p>
          <h1 className="text-4xl font-black tracking-[-0.03em] text-white sm:text-5xl">
            Bem-vindo,<br />
            <span className="text-[#C9A227]">{ownerName.split(" ")[0]}!</span>
          </h1>
        </motion.div>

        {/* Store name badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35 }}
          className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 backdrop-blur-sm"
        >
          <Store size={14} className="text-[#C9A227]" />
          <span className="text-sm font-semibold text-slate-300">{storeName}</span>
          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400">
            <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 opacity-75" />
          </span>
        </motion.div>

        {/* Progress */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-xs space-y-3"
        >
          {/* Step text */}
          <AnimatePresence mode="wait">
            <motion.p
              key={step}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-sm font-medium text-slate-400"
            >
              {STEPS[step]}
            </motion.p>
          </AnimatePresence>

          {/* Bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-slate-700 to-[#C9A227]"
              style={{ width: `${progress}%` }}
              transition={{ ease: "linear" }}
            />
          </div>

          <p className="text-[11px] font-bold text-slate-600">{Math.round(progress)}%</p>
        </motion.div>

        {/* Done message */}
        <AnimatePresence>
          {done && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-5 py-2.5"
            >
              <Sparkles size={14} className="text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-400">Abrindo seu painel...</span>
              <LayoutDashboard size={14} className="text-emerald-400" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
