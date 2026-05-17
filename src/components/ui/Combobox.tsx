import React, { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";
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
  className?: string;
}

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
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = query
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          o.description?.toLowerCase().includes(query.toLowerCase())
      )
    : options;

  const openDropdown = () => {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    setFocusedIndex(0);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const select = (opt: ComboboxOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    close();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
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
      else if (freeInput && query) { onChange(query); close(); }
    } else if (e.key === "Escape") {
      close();
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [close]);

  return (
    <div ref={containerRef} className={cn("space-y-1.5", className)}>
      {label && (
        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider">
          {label}
        </label>
      )}

      {/* Trigger */}
      <div
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={openDropdown}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative flex items-center h-10 px-3 gap-2 rounded-xl border bg-white cursor-pointer transition-all outline-none",
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

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: "spring", damping: 28, stiffness: 380 }}
            className="absolute z-[200] mt-1 w-full bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden"
            style={{ minWidth: containerRef.current?.offsetWidth }}
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
                <button onClick={() => setQuery("")} className="text-slate-300 hover:text-slate-500">
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
                      onClick={() => { onChange(query); close(); }}
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
                    onClick={() => select(opt)}
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
        )}
      </AnimatePresence>

      {error && <p className="text-[10px] text-red-500 font-medium">{error}</p>}
      {hint && !error && <p className="text-[10px] text-slate-400 font-medium">{hint}</p>}
    </div>
  );
}
