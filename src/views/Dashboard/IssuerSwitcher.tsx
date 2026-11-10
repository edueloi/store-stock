import { useEffect, useRef, useState } from "react";
import { Building2, Check, ChevronDown, Loader2 } from "lucide-react";

interface Item { id: number; label: string; isActive: boolean }

const authHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` });

/** Troca de empresa (CNPJ emissor) no topo do painel. Só aparece para o administrador e só quando a loja tem mais de um CNPJ. */
export default function IssuerSwitcher() {
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/tenant/issuers/summary", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d && Array.isArray(d.issuers)) setItems(d.issuers); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) { setOpen(false); setTarget(null); } };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setTarget(null); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (items.length < 2) return null;
  const active = items.find((i) => i.isActive);

  const activate = async (i: Item) => {
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/tenant/issuers/${i.id}/activate`, { method: "POST", headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "Não foi possível trocar de empresa.");
      window.location.reload();
    } catch (e) { setError((e as Error).message); setBusy(false); }
  };

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => { setOpen((v) => !v); setTarget(null); setError(""); }} aria-haspopup="listbox" aria-expanded={open}
        className="inline-flex h-8 max-w-[220px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50">
        <Building2 size={14} className="shrink-0 text-blue-600" />
        <span className="hidden truncate sm:inline">{active?.label ?? "Empresa"}</span>
        <ChevronDown size={13} className="shrink-0 text-slate-400" />
      </button>
      {open && (
        <div role="listbox" aria-label="Trocar de empresa" className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Empresa que emite as notas</p>
          {items.map((i) => (
            <button key={i.id} type="button" role="option" aria-selected={i.isActive} disabled={busy}
              onClick={() => (i.isActive ? setOpen(false) : setTarget(i))}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${i.isActive ? "bg-emerald-50 text-emerald-800" : "text-slate-700 hover:bg-slate-50"}`}>
              <span className="truncate font-medium">{i.label}</span>
              {i.isActive && <Check size={14} className="shrink-0" />}
            </button>
          ))}
          {target && (
            <div className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900">
              <p>Trocar para <b>{target.label}</b>? As próximas notas saem por ela, com o certificado, a série e a numeração dela. A tela recarrega.</p>
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={busy} onClick={() => void activate(target)} className="inline-flex h-7 items-center gap-1 rounded-md bg-blue-600 px-3 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                  {busy && <Loader2 size={12} className="animate-spin" />}Confirmar
                </button>
                <button type="button" disabled={busy} onClick={() => setTarget(null)} className="h-7 rounded-md px-2 text-[11px] font-medium text-slate-600 hover:bg-white">Cancelar</button>
              </div>
            </div>
          )}
          {error && <p role="alert" className="mt-1.5 rounded-lg bg-red-50 px-2.5 py-2 text-[11px] text-red-700">{error}</p>}
        </div>
      )}
    </div>
  );
}
