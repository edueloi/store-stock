import { useEffect, useRef, type ReactNode } from "react";
import { Bike, Clock, Minus, Plus, ShoppingBag, Trash2, UtensilsCrossed, X } from "lucide-react";
import type { MenuTenant, Route } from "../menuTypes";

export function Logo({ tenant, size }: { tenant: MenuTenant; size?: number }) {
  const style = size ? { width: size, height: size, fontSize: Math.round(size * 0.36) } : undefined;
  return tenant.logo_url
    ? <img className="mnu-logo" style={style} src={tenant.logo_url} alt={tenant.name} />
    : <div className="mnu-logo" style={style}>{tenant.name.slice(0, 1)}</div>;
}

/** Chips de status: aberto/fechado, horário de hoje e o tipo de cardápio (delivery, mesa, balcão). */
export function StatusChips({ status, route, mesa }: { status: { open: boolean; text: string } | null; route: Route; mesa: string }) {
  const mode = route === "mesa" ? { icon: <UtensilsCrossed size={13} />, text: `Mesa ${mesa}` }
    : route === "balcao" ? { icon: <ShoppingBag size={13} />, text: "Balcão" }
    : { icon: <Bike size={13} />, text: "Delivery" };
  return (
    <div className="mnu-chips">
      {status && <span className={`mnu-chip ${status.open ? "is-ok" : "is-off"}`}><i />{status.open ? "Aberto agora" : "Fechado"}</span>}
      {status && status.text !== "Fechado hoje" && <span className="mnu-chip"><Clock size={13} />{status.text}</span>}
      <span className="mnu-chip">{mode.icon}{mode.text}</span>
    </div>
  );
}

/** Folha (modal) padrão: sobe do rodapé no celular e centraliza no tablet/computador. */
/** `drawer`: em telas largas vira uma gaveta à direita (a página fica esmaecida atrás); no celular continua folha de baixo. */
export function Sheet({ children, label, onClose, locked, className = "", drawer }: { children: ReactNode; label: string; onClose: () => void; locked?: boolean; className?: string; drawer?: boolean }) {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const busy = useRef(locked);
  close.current = onClose;
  busy.current = locked;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy.current) close.current();
      if (event.key !== "Tab") return;
      const nodes = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled)') || []).filter((node) => node.getClientRects().length > 0);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = bodyOverflow; document.removeEventListener("keydown", key); previous?.focus(); };
  }, []);
  return (
    <div className={`mnu-overlay${drawer ? " is-drawer" : ""}`} onMouseDown={(e) => { if (e.target === e.currentTarget && !locked) onClose(); }}>
      <div ref={dialog} className={`mnu-sheet ${className}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>{children}</div>
    </div>
  );
}

export function SheetHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mnu-bag-head">
      <h3>{title}</h3>
      <button type="button" className="mnu-x is-static" aria-label="Fechar" onClick={onClose}><X size={20} /></button>
    </div>
  );
}

export function Qty({ value, onMinus, onPlus, trash }: { value: number; onMinus: () => void; onPlus: () => void; trash?: boolean }) {
  return (
    <div className="mnu-qty">
      <button type="button" aria-label="Menos" onClick={onMinus}>{trash && value === 1 ? <Trash2 size={15} /> : <Minus size={16} />}</button>
      <b>{value}</b>
      <button type="button" aria-label="Mais" onClick={onPlus}><Plus size={16} /></button>
    </div>
  );
}
