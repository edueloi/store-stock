import React, { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";
import Popover, { PopoverItem, PopoverDivider } from "./Popover";
import Button from "./Button";

// ── DropdownMenu ───────────────────────────────────────────────────────────
// Convenience wrapper over Popover for action menus / kebab menus

export interface DropdownMenuItem {
  type?: "item" | "divider";
  label?: string;
  icon?: ReactNode;
  onClick?: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
  hidden?: boolean;
}

interface DropdownMenuProps {
  items: DropdownMenuItem[];
  /** Custom trigger element — defaults to a "⋯" button */
  trigger?: ReactNode;
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end";
  className?: string;
}

export function DropdownMenu({ items, trigger, placement = "bottom-end", className }: DropdownMenuProps) {
  const defaultTrigger = (
    <button className="w-8 h-8 flex items-center justify-center rounded-xl border border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-100 hover:border-slate-200 transition-all">
      <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
        <circle cx="7.5" cy="2.5" r="1.5" /><circle cx="7.5" cy="7.5" r="1.5" /><circle cx="7.5" cy="12.5" r="1.5" />
      </svg>
    </button>
  );

  const visible = items.filter((i) => !i.hidden);

  return (
    <Popover
      trigger={trigger ?? defaultTrigger}
      placement={placement}
      className={cn("min-w-[160px] py-1", className)}
    >
      {visible.map((item, idx) =>
        item.type === "divider" ? (
          <PopoverDivider key={idx} />
        ) : (
          <PopoverItem
            key={idx}
            icon={item.icon}
            onClick={item.onClick}
            variant={item.variant}
            disabled={item.disabled}
          >
            {item.label}
          </PopoverItem>
        )
      )}
    </Popover>
  );
}

// ── DropdownButton ─────────────────────────────────────────────────────────
// A button with a chevron that opens a menu

interface DropdownButtonProps {
  label: string;
  items: DropdownMenuItem[];
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  placement?: "bottom-start" | "bottom-end";
  disabled?: boolean;
}

export function DropdownButton({
  label,
  items,
  icon,
  variant = "secondary",
  size = "md",
  placement = "bottom-start",
  disabled = false,
}: DropdownButtonProps) {
  const trigger = (
    <Button variant={variant} size={size} icon={icon} iconRight={<ChevronDown size={13} />} disabled={disabled}>
      {label}
    </Button>
  );

  return (
    <DropdownMenu
      items={items}
      trigger={<div className="pointer-events-auto">{trigger}</div>}
      placement={placement}
    />
  );
}
