import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

/** Botão no padrão shadcn/ui para as vitrines (variants via cva, suporta asChild). */
const storeButton = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[.97]",
  {
    variants: {
      variant: {
        default: "bg-[var(--theme-accent,#2455d6)] text-white shadow-md hover:brightness-110",
        secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
        outline: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
        ghost: "hover:bg-slate-100",
      },
      size: { sm: "h-9 px-4 text-sm", md: "h-11 px-6 text-sm", lg: "h-14 px-8 text-base", icon: "h-11 w-11" },
      shape: { pill: "rounded-full", soft: "rounded-2xl" },
    },
    defaultVariants: { variant: "default", size: "md", shape: "pill" },
  },
);

export interface StoreButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof storeButton> {
  asChild?: boolean;
}

export const StoreButton = React.forwardRef<HTMLButtonElement, StoreButtonProps>(({ className, variant, size, shape, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(storeButton({ variant, size, shape }), className)} {...props} />;
});
StoreButton.displayName = "StoreButton";
