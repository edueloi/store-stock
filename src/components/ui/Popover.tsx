import React, { useState, useRef, ReactNode, useEffect, useCallback, useLayoutEffect, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";

const PopoverCloseContext = createContext<(() => void) | null>(null);

type PopoverPlacement = "bottom-start" | "bottom-end" | "top-start" | "top-end" | "bottom" | "top";

interface PopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  placement?: PopoverPlacement;
  className?: string;
  closeOnOutside?: boolean;
}

interface Coords { top: number; left: number }

function computeCoords(
  trigger: HTMLElement,
  panel: HTMLElement | null,
  placement: PopoverPlacement,
): Coords {
  const tr = trigger.getBoundingClientRect();
  const pw = panel?.offsetWidth ?? 160;
  const ph = panel?.offsetHeight ?? 0;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const GAP = 6;

  let top = 0;
  let left = 0;

  switch (placement) {
    case "bottom-start":
      top  = tr.bottom + GAP + window.scrollY;
      left = tr.left   + window.scrollX;
      break;
    case "bottom-end":
      top  = tr.bottom + GAP + window.scrollY;
      left = tr.right  - pw  + window.scrollX;
      break;
    case "top-start":
      top  = tr.top - ph - GAP + window.scrollY;
      left = tr.left + window.scrollX;
      break;
    case "top-end":
      top  = tr.top - ph - GAP + window.scrollY;
      left = tr.right - pw + window.scrollX;
      break;
    case "bottom":
      top  = tr.bottom + GAP + window.scrollY;
      left = tr.left + tr.width / 2 - pw / 2 + window.scrollX;
      break;
    case "top":
      top  = tr.top - ph - GAP + window.scrollY;
      left = tr.left + tr.width / 2 - pw / 2 + window.scrollX;
      break;
  }

  // Keep inside viewport
  if (left + pw > vw - 8) left = vw - pw - 8;
  if (left < 8) left = 8;

  // Flip vertically if out of bounds
  if (placement.startsWith("bottom") && tr.bottom + ph + GAP > vh) {
    top = tr.top - ph - GAP + window.scrollY;
  }
  if (placement.startsWith("top") && tr.top - ph - GAP < 0) {
    top = tr.bottom + GAP + window.scrollY;
  }

  return { top, left };
}

const initialMotion: Record<PopoverPlacement, object> = {
  "bottom-start": { y: -6 },
  "bottom-end":   { y: -6 },
  "top-start":    { y: 6 },
  "top-end":      { y: 6 },
  bottom:         { y: -6 },
  top:            { y: 6 },
};

export default function Popover({
  trigger,
  children,
  placement = "bottom-end",
  className,
  closeOnOutside = true,
}: PopoverProps) {
  const [open, setOpen]       = useState(false);
  const [coords, setCoords]   = useState<Coords>({ top: 0, left: 0 });
  const triggerRef            = useRef<HTMLDivElement>(null);
  const panelRef              = useRef<HTMLDivElement>(null);

  const recompute = useCallback(() => {
    if (triggerRef.current) {
      setCoords(computeCoords(triggerRef.current, panelRef.current, placement));
    }
  }, [placement]);

  // Recompute after panel mounts so we have its real dimensions
  useLayoutEffect(() => {
    if (open) recompute();
  }, [open, recompute]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => recompute();
    const onResize = () => recompute();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, recompute]);

  useEffect(() => {
    if (!closeOnOutside || !open) return;
    const handle = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open, closeOnOutside]);

  const panel = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, ...initialMotion[placement] }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, ...initialMotion[placement] }}
          transition={{ type: "spring", damping: 28, stiffness: 350 }}
          style={{ position: "absolute", top: coords.top, left: coords.left, zIndex: 9999 }}
          className={cn(
            "bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden",
            className
          )}
        >
          <PopoverCloseContext.Provider value={() => setOpen(false)}>
            {children}
          </PopoverCloseContext.Provider>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <div ref={triggerRef} className="inline-flex" onClick={() => setOpen(v => !v)}>
        {trigger}
      </div>
      {createPortal(panel, document.body)}
    </>
  );
}

// ── PopoverItem ────────────────────────────────────────────────────────────

interface PopoverItemProps {
  key?: React.Key;
  icon?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
}

export function PopoverItem({ icon, children, onClick, variant = "default", disabled = false }: PopoverItemProps) {
  const close = useContext(PopoverCloseContext);
  return (
    <button
      onClick={() => { close?.(); onClick?.(); }}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold transition-colors",
        variant === "default" && "text-slate-700 hover:bg-slate-50",
        variant === "danger"  && "text-red-600 hover:bg-red-50",
        disabled && "opacity-40 cursor-not-allowed pointer-events-none"
      )}
    >
      {icon && <span className="opacity-60">{icon}</span>}
      {children}
    </button>
  );
}

export function PopoverDivider() {
  return <hr className="border-slate-100" />;
}
