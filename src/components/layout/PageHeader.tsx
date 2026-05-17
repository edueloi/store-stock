import { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export default function PageHeader({ title, subtitle, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none truncate">
          {title}
        </h2>
        {subtitle && (
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1 leading-none">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
