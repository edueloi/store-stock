import { Search, X } from "lucide-react";
import { cn } from "../../lib/utils";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchBar({ value, onChange, placeholder = "Buscar...", className }: SearchBarProps) {
  return (
    <div className={cn("relative group", className)}>
      <Search
        size={15}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-11 pr-10 h-11 bg-white border border-slate-200 rounded-xl outline-none text-[10px] font-bold uppercase tracking-widest placeholder:text-slate-300 placeholder:normal-case focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
