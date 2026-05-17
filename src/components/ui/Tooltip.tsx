import React, { useState, useRef, ReactNode, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";

type TooltipPlacement = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  placement?: TooltipPlacement;
  delay?: number;
  className?: string;
  disabled?: boolean;
}

const placementClasses: Record<TooltipPlacement, { container: string; initial: object }> = {
  top:    { container: "bottom-full left-1/2 -translate-x-1/2 mb-2", initial: { y: 4 } },
  bottom: { container: "top-full left-1/2 -translate-x-1/2 mt-2",   initial: { y: -4 } },
  left:   { container: "right-full top-1/2 -translate-y-1/2 mr-2",  initial: { x: 4 } },
  right:  { container: "left-full top-1/2 -translate-y-1/2 ml-2",   initial: { x: -4 } },
};

export default function Tooltip({
  content,
  children,
  placement = "top",
  delay = 300,
  className,
  disabled = false,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const show = () => {
    if (disabled) return;
    timerRef.current = setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    clearTimeout(timerRef.current);
    setVisible(false);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const { container, initial } = placementClasses[placement];

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, ...initial }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, ...initial }}
            transition={{ duration: 0.12 }}
            role="tooltip"
            className={cn(
              "absolute z-[300] pointer-events-none whitespace-nowrap",
              "px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider",
              "bg-slate-800 text-white shadow-lg",
              container,
              className
            )}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
