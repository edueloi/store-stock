import React, { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

// ── Input ──────────────────────────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  accent?: "default" | "orange" | "emerald" | "blue" | "red";
}

const accentInput: Record<NonNullable<InputProps["accent"]>, string> = {
  default: "bg-slate-50 border-slate-200 focus:border-blue-500 focus:ring-blue-500/10",
  orange: "bg-orange-50 border-orange-200 focus:border-orange-400 focus:ring-orange-400/10",
  emerald: "bg-emerald-50 border-emerald-200 focus:border-emerald-400 focus:ring-emerald-400/10",
  blue: "bg-blue-50 border-blue-200 focus:border-blue-500 focus:ring-blue-500/10",
  red: "bg-red-50 border-red-200 focus:border-red-400 focus:ring-red-400/10",
};

const accentLabel: Record<NonNullable<InputProps["accent"]>, string> = {
  default: "text-slate-400",
  orange: "text-orange-500",
  emerald: "text-emerald-500",
  blue: "text-blue-500",
  red: "text-red-500",
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, accent = "default", className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label className={cn("text-[10px] font-bold uppercase tracking-widest px-1", accentLabel[accent])}>
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full border rounded-xl h-11 text-xs font-bold uppercase tracking-wide outline-none transition-all focus:ring-2 placeholder:text-slate-300 placeholder:normal-case",
              leftIcon ? "pl-10 pr-4" : "px-4",
              accentInput[accent],
              error && "border-red-400 bg-red-50 focus:border-red-400 focus:ring-red-400/10",
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-[10px] text-red-500 font-bold px-1">{error}</p>}
        {hint && !error && <p className="text-[10px] text-slate-400 font-medium px-1">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

// ── Textarea ───────────────────────────────────────────────────────────────

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium outline-none transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 resize-none placeholder:text-slate-300",
            error && "border-red-400 bg-red-50",
            className
          )}
          {...props}
        />
        {error && <p className="text-[10px] text-red-500 font-bold px-1">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

// ── Select ─────────────────────────────────────────────────────────────────

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, placeholder, children, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold uppercase outline-none transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 cursor-pointer",
            error && "border-red-400 bg-red-50",
            className
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {children}
        </select>
        {error && <p className="text-[10px] text-red-500 font-bold px-1">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";
