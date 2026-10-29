import { useState, type CSSProperties } from "react";
import { ArrowRight, Bike, MapPin, Minus, Phone, Plus, Store, Users, UtensilsCrossed } from "lucide-react";
import type { MenuConfig, MenuTenant, PastOrder, Route } from "../menuTypes";
import { DAY_LABEL, DAY_ORDER, birthIso, maskDate, maskPhone, money } from "../menuTypes";
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

/** Balcão: só o WhatsApp. Cliente cadastrado entra direto; novo informa nome e nascimento e é cadastrado. */
function CounterGate({ tenant, onEnter, style }: { tenant: MenuTenant; style?: CSSProperties; onEnter: (g: { name: string; phone: string; people: number; birth?: string }) => void }) {
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"phone" | "new">("phone");
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const digitsOnly = phone.replace(/\D/g, "");

  const check = async () => {
    if (digitsOnly.length < 10) return setError("Informe o WhatsApp com DDD.");
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/public/menu-customer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: tenant.id, phone: digitsOnly }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível consultar agora.");
      if (data.found) onEnter({ name: String(data.name || ""), phone, people: 1 });
      else setStep("new");
    } catch (e: any) {
      setError(e?.message || "Não foi possível consultar agora.");
    } finally {
      setBusy(false);
    }
  };
  const register = () => {
    if (name.trim().length < 2) return setError("Informe seu nome.");
    const iso = birthIso(birth);
    if (!iso) return setError("Informe a data de nascimento (dia/mês/ano).");
    onEnter({ name: name.trim(), phone, people: 1, birth: iso });
  };

  return (
    <div className="mnu mnu-gate mnu-balcao mnu-gate-dark" style={style}>
      <form className="mnu-gate-card mnu-gate-compact" onSubmit={(e) => { e.preventDefault(); if (step === "phone") void check(); else register(); }}>
        <div className="mnu-gate-brand"><Logo tenant={tenant} /><strong>{tenant.name}</strong></div>
        {step === "phone" ? (
          <>
            <div><h2>Qual o seu WhatsApp?</h2><p>Se você já é cliente, é só isso. A retirada é no balcão.</p></div>
            <input className="mnu-input mnu-input-lg" autoFocus inputMode="tel" placeholder="(00) 00000-0000" maxLength={15} value={phone} onChange={(e) => { setPhone(maskPhone(e.target.value)); setError(""); }} autoComplete="tel" aria-label="WhatsApp" />
          </>
        ) : (
          <>
            <div><h2>Primeira vez por aqui?</h2><p>Só mais dois dados para cadastrar você.</p></div>
            <label className="mnu-label">Seu nome<input className="mnu-input" autoFocus value={name} onChange={(e) => { setName(e.target.value); setError(""); }} autoComplete="name" /></label>
            <label className="mnu-label">Data de nascimento<input className="mnu-input" inputMode="numeric" placeholder="dd/mm/aaaa" maxLength={10} value={birth} onChange={(e) => { setBirth(maskDate(e.target.value)); setError(""); }} autoComplete="bday" /></label>
          </>
        )}
        {error && <div className="mnu-err" role="alert">{error}</div>}
        <button type="submit" className="mnu-btn" disabled={busy}>{busy ? "Verificando…" : step === "phone" ? "Continuar" : "Começar meu pedido"}<ArrowRight size={17} /></button>
        {step === "new" && <button type="button" className="mnu-btn is-ghost" onClick={() => { setStep("phone"); setError(""); }}>Trocar o número</button>}
      </form>
    </div>
  );
}

/** Tela de boas-vindas de mesa e balcão (nome, telefone e, na mesa, quantas pessoas). */
export function Gate({ tenant, route, mesa, onEnter, style }: {
  style?: CSSProperties;
  tenant: MenuTenant;
  route: Route;
  mesa: string;
  onEnter: (g: { name: string; phone: string; people: number; birth?: string }) => void;
}) {
  if (route === "balcao") return <CounterGate tenant={tenant} style={style} onEnter={onEnter} />;
  const [form, setForm] = useState({ name: "", phone: "", people: 1 });
  const [error, setError] = useState("");
  const enter = () => {
    if (!form.name.trim()) return setError("Informe seu nome para continuar.");
    onEnter({ name: form.name.trim(), phone: form.phone, people: Math.max(1, form.people) });
  };
  return (
    <div className={`mnu mnu-gate mnu-${route}`} style={style}>
      <div className="mnu-gate-layout"><div className="mnu-gate-intro"><div className="mnu-gate-brand"><Logo tenant={tenant} /><strong>{tenant.name}</strong></div><span className="mnu-eyebrow">{route === "mesa" ? "Para aproveitar à mesa" : "Simples, do pedido à retirada"}</span><h1>{route === "mesa" ? <>Sente-se.<br />A escolha é sua.</> : <>Escolha aqui.<br />Retire no balcão.</>}</h1><p>{route === "mesa" ? "Um cardápio para explorar com calma, compartilhar escolhas e aproveitar o encontro." : "Veja os produtos, monte seu pedido e acompanhe a retirada com a nossa equipe."}</p><span className="mnu-gate-channel">{route === "mesa" ? <UtensilsCrossed size={19} /> : <Store size={19} />}{route === "mesa" ? `Você está na mesa ${mesa}` : "Atendimento no estabelecimento"}</span></div>
      <form className="mnu-gate-card" onSubmit={(event) => { event.preventDefault(); enter(); }}>
        <span className="mnu-eyebrow">{route === "mesa" ? `Mesa ${mesa.padStart(2, "0")}` : "Pedido no balcão"}</span>
        <div><h2>Antes de escolher,<br />como podemos chamar você?</h2><p>Seu nome ajuda a equipe a identificar o pedido.</p></div>
        <label className="mnu-label">Seu nome<input className="mnu-input" placeholder="Como você se chama?" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" /></label>
        <label className="mnu-label">WhatsApp <span>Opcional</span><input className="mnu-input" placeholder="(00) 00000-0000" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} maxLength={15} autoComplete="tel" /></label>
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
        {error && <div className="mnu-err" role="alert">{error}</div>}
        <button type="submit" className="mnu-btn">{route === "mesa" ? "Ver cardápio da mesa" : "Começar meu pedido"}<ArrowRight size={17} /></button>
        <small className="mnu-gate-disclaimer">{route === "mesa" ? "O pedido será vinculado à sua mesa." : "A retirada será feita no balcão da loja."}</small>
      </form></div>
    </div>
  );
}
