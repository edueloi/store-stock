import React, { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  clearable?: boolean;
  /** Allow typing a value not in the options list */
  freeInput?: boolean;
  /** Called when user clicks "Adicionar X" — receives the typed query. If provided, overrides the default freeInput behaviour. */
  onAddNew?: (query: string) => void;
  className?: string;
}

type DropdownPos = { top: number; left: number; width: number; openUp: boolean };

// ── Component ──────────────────────────────────────────────────────────────

export default function Combobox({
  options,
  value,
  onChange,
  label,
  placeholder = "Selecionar...",
  searchPlaceholder = "Buscar...",
  error,
  hint,
  disabled = false,
  clearable = false,
  freeInput = false,
  onAddNew,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [pos, setPos] = useState<DropdownPos>({ top: 0, left: 0, width: 0, openUp: false });

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = query
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          o.description?.toLowerCase().includes(query.toLowerCase())
      )
    : options;

  const getPos = (): DropdownPos => {
    if (!triggerRef.current) return { top: 0, left: 0, width: 0, openUp: false };
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 260 && rect.top > spaceBelow;
    return {
      top: openUp ? rect.top - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      openUp,
    };
  };

  const openDropdown = () => {
    if (disabled) return;
    setPos(getPos());
    setOpen(true);
    setQuery("");
    setFocusedIndex(0);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const toggle = () => (open ? close() : openDropdown());

  const select = (opt: ComboboxOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    close();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") openDropdown();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[focusedIndex]) select(filtered[focusedIndex]);
      else if (freeInput && query) {
        if (onAddNew) { onAddNew(query); close(); }
        else { onChange(query); close(); }
      }
    } else if (e.key === "Escape") {
      close();
    }
  };

  // Close on outside click — check both trigger and portal dropdown
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        close();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    const handler = () => setPos(getPos());
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dropdown = open ? (
    <AnimatePresence>
      <motion.div
        ref={dropdownRef}
        key="combobox-dropdown"
        initial={{ opacity: 0, y: pos.openUp ? 4 : -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: pos.openUp ? 4 : -4 }}
        transition={{ type: "spring", damping: 28, stiffness: 380 }}
        style={{
          position: "fixed",
          top: pos.openUp ? undefined : pos.top,
          bottom: pos.openUp ? window.innerHeight - pos.top : undefined,
          left: pos.left,
          width: pos.width,
          minWidth: 200,
          zIndex: 99999,
        }}
        className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden"
      >
        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
          <Search size={13} className="text-slate-400 shrink-0" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setFocusedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder={searchPlaceholder}
            className="flex-1 text-xs outline-none placeholder:text-slate-400 bg-transparent"
          />
          {query && (
            <button onMouseDown={(e) => { e.preventDefault(); setQuery(""); }} className="text-slate-300 hover:text-slate-500">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Options */}
        <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-[11px] text-slate-400 text-center font-medium">
              {freeInput && query ? (
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (onAddNew) { onAddNew(query); close(); }
                    else { onChange(query); close(); }
                  }}
                  className="text-blue-600 font-bold hover:underline"
                >
                  Adicionar "{query}"
                </button>
              ) : (
                "Nenhuma opção encontrada"
              )}
            </li>
          ) : (
            filtered.map((opt, idx) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={value === opt.value}
                onMouseEnter={() => setFocusedIndex(idx)}
                onMouseDown={(e) => { e.preventDefault(); select(opt); }}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors",
                  focusedIndex === idx && "bg-blue-50",
                  opt.disabled && "opacity-40 cursor-not-allowed",
                  value === opt.value && "bg-blue-50"
                )}
              >
                {opt.icon && <span className="text-slate-500 shrink-0">{opt.icon}</span>}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{opt.label}</p>
                  {opt.description && (
                    <p className="text-[10px] text-slate-400 truncate">{opt.description}</p>
                  )}
                </div>
                {value === opt.value && (
                  <Check size={13} className="text-blue-600 shrink-0" />
                )}
              </li>
            ))
          )}
        </ul>
      </motion.div>
    </AnimatePresence>
  ) : null;

  return (
    <div ref={containerRef} className={cn("space-y-1.5", className)}>
      {label && (
        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider">
          {label}
        </label>
      )}

      {/* Trigger */}
      <div
        ref={triggerRef}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex items-center h-10 px-3 gap-2 rounded-xl border bg-white cursor-pointer transition-all outline-none",
          open ? "border-blue-500 ring-2 ring-blue-100 shadow-sm" : "border-slate-200 hover:border-slate-300",
          error && "border-red-400 ring-2 ring-red-100",
          disabled && "opacity-50 cursor-not-allowed bg-slate-50",
        )}
      >
        {selected?.icon && <span className="shrink-0 text-slate-500">{selected.icon}</span>}
        <span className={cn("flex-1 text-xs font-medium truncate", !selected && "text-slate-400")}>
          {selected ? selected.label : placeholder}
        </span>

        {clearable && selected && !disabled && (
          <button
            onMouseDown={(e) => { e.stopPropagation(); onChange(""); }}
            className="shrink-0 text-slate-300 hover:text-slate-600 transition-colors"
          >
            <X size={13} />
          </button>
        )}
        <ChevronDown size={14} className={cn("shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </div>

      {/* Portal dropdown — renders into document.body to escape all overflow containers */}
      {typeof document !== "undefined" && createPortal(dropdown, document.body)}

      {error && <p className="text-[10px] text-red-500 font-medium">{error}</p>}
      {hint && !error && <p className="text-[10px] text-slate-400 font-medium">{hint}</p>}
    </div>
  );
}
