import type { ReactNode } from "react";
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
export function Sheet({ children, label, onClose, locked }: { children: ReactNode; label: string; onClose: () => void; locked?: boolean }) {
  return (
    <div className="mnu-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !locked) onClose(); }}>
      <div className="mnu-sheet" role="dialog" aria-label={label}>{children}</div>
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
