import { useState, type CSSProperties } from "react";
import { Bike, MapPin, Minus, Phone, Plus, Store, Users } from "lucide-react";
import type { MenuConfig, MenuTenant, PastOrder, Route } from "../menuTypes";
import { DAY_LABEL, DAY_ORDER, money } from "../menuTypes";
import { Logo, Sheet, SheetHead } from "./parts";

export function InfoPanel({ tenant, cfg, route, accepts, onClose }: {
  tenant: MenuTenant;
  cfg: MenuConfig;
  route: Route;
  accepts: { delivery: boolean; pickup: boolean };
  onClose: () => void;
}) {
  const addr = [tenant.address_street && `${tenant.address_street}${tenant.address_number ? `, ${tenant.address_number}` : ""}`, tenant.address_district, tenant.address_city].filter(Boolean).join(" · ");
  const delivery = cfg.delivery || {};
  const minOrder = Math.max(0, Number(delivery.min_order) || 0);
  const freeAbove = Math.max(0, Number(delivery.free_above) || 0);
  const ic = { style: { verticalAlign: "-2px" } as const };
  return (
    <Sheet label="Info da loja" onClose={onClose}>
      <SheetHead title="Info da loja" onClose={onClose} />
      <div className="mnu-sheet-body" style={{ paddingTop: 4 }}>
        <div className="mnu-info-list">
          {addr && <div><span><MapPin size={14} {...ic} /> Endereço</span><b style={{ textAlign: "right" }}>{addr}</b></div>}
          {tenant.whatsapp && <div><span><Phone size={14} {...ic} /> WhatsApp</span><a href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>{tenant.whatsapp}</a></div>}
          {route === "delivery" && accepts.delivery && <div><span><Bike size={14} {...ic} /> Entrega</span><b style={{ textAlign: "right" }}>{delivery.fee_mode === "neighborhood" ? "taxa por bairro" : money(Math.max(0, Number(delivery.fixed_fee) || 0))}{delivery.eta ? ` · ${delivery.eta}` : ""}</b></div>}
          {route === "delivery" && accepts.delivery && minOrder > 0 && <div><span>Pedido mínimo</span><b>{money(minOrder)}</b></div>}
          {route === "delivery" && accepts.delivery && freeAbove > 0 && <div><span>Frete grátis acima de</span><b>{money(freeAbove)}</b></div>}
          {route === "delivery" && accepts.pickup && <div><span><Store size={14} {...ic} /> Retirada</span><b>{cfg.pickup_eta || "na loja"}</b></div>}
        </div>
        {tenant.business_hours && (
          <div className="mnu-info-list">
            {DAY_ORDER.filter((k) => tenant.business_hours![k]).map((k) => {
              const h = tenant.business_hours![k];
              return <div key={k}><span>{DAY_LABEL[k]}</span><b>{h.closed ? "Fechado" : `${h.open} às ${h.close}`}</b></div>;
            })}
          </div>
        )}
      </div>
    </Sheet>
  );
}

export function OrdersPanel({ orders, onClose }: { orders: PastOrder[]; onClose: () => void }) {
  return (
    <Sheet label="Meus pedidos" onClose={onClose}>
      <SheetHead title="Meus pedidos" onClose={onClose} />
      <div className="mnu-sheet-body" style={{ paddingTop: 4 }}>
        {orders.length === 0 ? <p>Você ainda não fez pedidos neste aparelho.</p> : (
          <div className="mnu-hist">
            {orders.map((o) => (
              <div key={o.id}>
                <span><b>{o.label}</b><br /><small>{new Date(o.at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</small></span>
                <b>{money(o.total)}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** Tela de boas-vindas de mesa e balcão (nome, telefone e, na mesa, quantas pessoas). */
export function Gate({ tenant, route, mesa, onEnter, style }: {
  style?: CSSProperties;
  tenant: MenuTenant;
  route: Route;
  mesa: string;
  onEnter: (g: { name: string; phone: string; people: number }) => void;
}) {
  const [form, setForm] = useState({ name: "", phone: "", people: 1 });
  const [error, setError] = useState("");
  const enter = () => {
    if (!form.name.trim()) return setError("Informe seu nome para continuar.");
    onEnter({ name: form.name.trim(), phone: form.phone, people: Math.max(1, form.people) });
  };
  return (
    <div className="mnu mnu-gate" style={style}>
      {tenant.banner_url && <div className="mnu-hero-bg" style={{ backgroundImage: `url(${tenant.banner_url})` }} />}
      <div className="mnu-gate-card">
        <Logo tenant={tenant} />
        <div>
          <h1>Bem-vindo ao {tenant.name}</h1>
          <div className="where" style={{ marginTop: 6 }}>{route === "mesa" ? `Mesa ${mesa}` : "Pedido no balcão"}</div>
        </div>
        {route === "balcao" && <p>Informe seu nome para ver o cardápio e fazer seu pedido.</p>}
        <input className="mnu-input" placeholder="Seu nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
        <input className="mnu-input" placeholder="(00) 00000-0000" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" />
        {route === "mesa" && (
          <div className="mnu-gate-people">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Users size={16} />Pessoas na mesa</span>
            <div className="mnu-qty">
              <button type="button" aria-label="Menos" onClick={() => setForm((f) => ({ ...f, people: Math.max(1, f.people - 1) }))}><Minus size={16} /></button>
              <b>{form.people}</b>
              <button type="button" aria-label="Mais" onClick={() => setForm((f) => ({ ...f, people: Math.min(30, f.people + 1) }))}><Plus size={16} /></button>
            </div>
          </div>
        )}
        {error && <div className="mnu-err">{error}</div>}
        <button type="button" className="mnu-btn" onClick={enter}>{route === "mesa" ? "Entrar no restaurante" : "Continuar"}</button>
      </div>
    </div>
  );
}
