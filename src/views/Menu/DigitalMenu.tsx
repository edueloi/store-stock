import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import {
  Bike, Check, Clock, Flame, History, Info, MapPin, Minus, Phone, Plus, Search, ShoppingBag, Store, Trash2, User, UtensilsCrossed, Users, X,
} from "lucide-react";
import "./menu.css";

type Route = "delivery" | "mesa" | "balcao";
type Receive = "delivery" | "pickup";
type PayMethod = "pix" | "money" | "card";

interface MenuProduct {
  id: number;
  name: string;
  description?: string | null;
  price: number | string;
  discount_price?: number | string | null;
  image_url?: string | null;
  images?: unknown;
  category_id?: number | null;
  stock_quantity: number;
  track_stock?: boolean;
  is_featured?: boolean;
  sold_count?: number;
}
interface MenuCategory { id: number; name: string }
interface MenuConfig {
  accepts?: { mesa?: boolean; balcao?: boolean; delivery?: boolean; pickup?: boolean };
  delivery?: {
    fee_mode?: "fixed" | "neighborhood";
    fixed_fee?: number;
    free_above?: number;
    min_order?: number;
    neighborhoods?: Array<{ name?: string; fee?: number }>;
    eta?: string;
  };
  pickup_eta?: string;
  payments?: { pix?: boolean; money?: boolean; card?: boolean };
}
type Hours = Record<string, { open: string; close: string; closed: boolean }>;
interface MenuTenant {
  id: number;
  name: string;
  whatsapp: string;
  logo_url?: string | null;
  banner_url?: string | null;
  hero_tagline?: string | null;
  about_text?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_district?: string | null;
  address_city?: string | null;
  primary_color?: string | null;
  template_id?: string | null;
  business_hours?: Hours | null;
  food_enabled?: boolean;
  sell_without_stock_control?: boolean;
  policies?: { menu?: MenuConfig } | null;
}
interface CartLine { key: string; product_id: number; name: string; price: number; qty: number; note: string }
interface PastOrder { id: string; label: string; total: number; at: number }

const money = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
const unitPrice = (p: MenuProduct) => Number(p.discount_price ?? p.price);
const imageOf = (p: MenuProduct): string | null => {
  if (p.image_url) return p.image_url;
  const first = Array.isArray(p.images) ? p.images[0] : null;
  return typeof first === "string" ? first : first && typeof first === "object" && "url" in (first as object) ? String((first as { url: unknown }).url) : null;
};

const DAY_KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
const DAY_LABEL: Record<string, string> = { seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta", sex: "Sexta", sab: "Sábado", dom: "Domingo" };
const toMin = (t: string) => { const [h, m] = String(t).split(":").map(Number); return (h || 0) * 60 + (m || 0); };
function openStatus(hours?: Hours | null): { open: boolean; text: string } | null {
  if (!hours) return null;
  const today = hours[DAY_KEYS[new Date().getDay()]];
  if (!today) return null;
  if (today.closed) return { open: false, text: "Fechado hoje" };
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  const o = toMin(today.open), c = toMin(today.close);
  const open = c > o ? now >= o && now < c : now >= o || now < c;
  return { open, text: `${today.open}–${today.close}` };
}

const store = {
  get: (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* ok */ } },
};
const lstore = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ok */ } },
};

// Cardápio digital: tela própria (não é o site/catálogo), com três entradas:
//  /cardapio              → delivery (entrega ou retirada)
//  /cardapio/mesa/:n      → pedido na mesa (QR)
//  /cardapio/balcao       → pedido no balcão (QR)
export default function DigitalMenu() {
  const { slug: routeSlug } = useParams();
  const location = useLocation();
  const [state, setState] = useState<{ loading: boolean; error: string | null; tenant: MenuTenant | null; categories: MenuCategory[]; products: MenuProduct[] }>({ loading: true, error: null, tenant: null, categories: [], products: [] });

  useEffect(() => {
    let alive = true;
    fetch(routeSlug ? `/api/public/store/${routeSlug}` : "/api/public/store")
      .then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (!alive) return;
        if (!ok) return setState((s) => ({ ...s, loading: false, error: data?.error || "Cardápio indisponível." }));
        setState({ loading: false, error: null, tenant: data.tenant, categories: data.categories || [], products: data.products || [] });
      })
      .catch(() => alive && setState((s) => ({ ...s, loading: false, error: "Não foi possível carregar o cardápio." })));
    return () => { alive = false; };
  }, [routeSlug]);

  const { tenant, categories, products } = state;
  const cfg: MenuConfig = tenant?.policies?.menu || {};
  const accepts = { mesa: true, balcao: true, pickup: true, delivery: false, ...(cfg.accepts || {}) };
  const tid = tenant?.id ?? 0;

  // ---- qual cardápio (pelo endereço) ----
  const parts = location.pathname.split("/").filter(Boolean);
  const rest = parts.indexOf("cardapio") >= 0 ? parts.slice(parts.indexOf("cardapio") + 1) : [];
  const query = new URLSearchParams(location.search);
  let route: Route = "delivery";
  let mesa = "";
  if (rest[0] === "mesa") { route = "mesa"; mesa = decodeURIComponent(rest[1] || "").trim().slice(0, 20); }
  else if (rest[0] === "balcao" || query.get("balcao") !== null) route = "balcao";
  else if ((query.get("mesa") || "").trim()) { route = "mesa"; mesa = (query.get("mesa") || "").trim().slice(0, 20); }

  // ---- entrada (boas-vindas de mesa/balcão) ----
  const gateKey = `menu_gate_${tid}_${route}_${mesa}`;
  const [gate, setGate] = useState<{ name: string; phone: string; people: number } | null>(null);
  const [gateForm, setGateForm] = useState({ name: "", phone: "", people: 1 });
  const [gateError, setGateError] = useState("");
  useEffect(() => {
    if (!tenant || route === "delivery") return;
    try { const saved = store.get(gateKey); setGate(saved ? JSON.parse(saved) : null); } catch { setGate(null); }
  }, [tenant, route, gateKey]);

  // ---- carrinho ----
  const [cart, setCart] = useState<CartLine[]>([]);
  useEffect(() => {
    if (!tenant) return;
    try { setCart(JSON.parse(lstore.get(`menu_cart_${tenant.id}`) || "[]")); } catch { setCart([]); }
  }, [tenant]);
  useEffect(() => { if (tenant) lstore.set(`menu_cart_${tenant.id}`, JSON.stringify(cart)); }, [cart, tenant]);
  const subtotal = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const itemCount = cart.reduce((s, l) => s + l.qty, 0);

  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState<{ product: MenuProduct; qty: number; note: string } | null>(null);
  const [panel, setPanel] = useState<null | "bag" | "info" | "orders">(null);
  const [activeCat, setActiveCat] = useState("");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const available = (p: MenuProduct) => p.track_stock === false || !!tenant?.sell_without_stock_control || p.stock_quantity > 0;
  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => products.filter((p) => !q || p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q)), [products, q]);
  const sections = useMemo(() => {
    const by = new Map<number | "none", MenuProduct[]>();
    for (const p of filtered) {
      const key = p.category_id && categories.some((c) => c.id === p.category_id) ? p.category_id : "none";
      by.set(key, [...(by.get(key) || []), p]);
    }
    const out: { id: string; name: string; items: MenuProduct[] }[] = [];
    for (const c of [...categories].sort((a, b) => a.id - b.id)) if (by.has(c.id)) out.push({ id: `c${c.id}`, name: c.name, items: by.get(c.id)! });
    if (by.has("none")) out.push({ id: "none", name: "Outros", items: by.get("none")! });
    return out;
  }, [filtered, categories]);
  const featured = useMemo(
    () => [...products].filter((p) => available(p) && ((p.sold_count || 0) > 0 || p.is_featured)).sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0)).slice(0, 8),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products],
  );

  useEffect(() => {
    const onScroll = () => {
      let current = "";
      for (const s of sections) {
        const el = sectionRefs.current[s.id];
        if (el && el.getBoundingClientRect().top < 140) current = s.id;
      }
      setActiveCat(current);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [sections]);
  const goTo = (id: string) => sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });

  const addToCart = (product: MenuProduct, qty: number, note: string) => {
    const cleanNote = note.trim().slice(0, 140);
    const key = `${product.id}|${cleanNote}`;
    setCart((prev) => {
      const found = prev.find((l) => l.key === key);
      if (found) return prev.map((l) => (l.key === key ? { ...l, qty: Math.min(50, l.qty + qty) } : l));
      return [...prev, { key, product_id: product.id, name: product.name, price: unitPrice(product), qty, note: cleanNote }];
    });
  };
  const changeQty = (key: string, delta: number) =>
    setCart((prev) => prev.flatMap((l) => (l.key !== key ? [l] : l.qty + delta <= 0 ? [] : [{ ...l, qty: Math.min(50, l.qty + delta) }])));

  // ---- delivery ----
  const delivery = cfg.delivery || {};
  const freeAbove = Math.max(0, Number(delivery.free_above) || 0);
  const minOrder = Math.max(0, Number(delivery.min_order) || 0);
  const hoods = (delivery.neighborhoods || []).filter((n) => n.name);
  const [receive, setReceive] = useState<Receive | null>(null);
  const receiveNow: Receive = receive ?? (accepts.delivery ? "delivery" : "pickup");
  const mode: "delivery" | "pickup" | "mesa" | "balcao" = route === "delivery" ? receiveNow : route;
  const [form, setForm] = useState({ name: "", phone: "", street: "", number: "", district: "", complement: "", reference: "", note: "" });
  const [pay, setPay] = useState<PayMethod>("pix");
  const [changeFor, setChangeFor] = useState("");
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const hoodFee = delivery.fee_mode === "neighborhood" ? hoods.find((n) => String(n.name).toLowerCase() === form.district.trim().toLowerCase())?.fee : undefined;
  const baseFee = delivery.fee_mode === "neighborhood" ? (hoodFee === undefined ? null : Math.max(0, Number(hoodFee) || 0)) : Math.max(0, Number(delivery.fixed_fee) || 0);
  const fee = mode === "delivery" && baseFee !== null ? (freeAbove > 0 && subtotal >= freeAbove ? 0 : baseFee) : 0;
  const total = subtotal + fee;
  const payAllowed = { pix: true, money: true, card: true, ...(cfg.payments || {}) };

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { title: string; text: string; wa?: string }>(null);
  const [orders, setOrders] = useState<PastOrder[]>([]);
  useEffect(() => { if (tenant) { try { setOrders(JSON.parse(lstore.get(`menu_orders_${tenant.id}`) || "[]")); } catch { setOrders([]); } } }, [tenant]);
  const rememberOrder = (o: PastOrder) => {
    if (!tenant) return;
    const next = [o, ...orders].slice(0, 20);
    setOrders(next);
    lstore.set(`menu_orders_${tenant.id}`, JSON.stringify(next));
  };

  const submit = async () => {
    if (!tenant) return;
    setError(null);
    if (mode === "delivery" || mode === "pickup") {
      if (!form.name.trim()) return setError("Informe seu nome.");
      if (form.phone.replace(/\D/g, "").length < 10) return setError("Informe um WhatsApp válido (com DDD).");
    }
    if (mode === "delivery") {
      if (!form.street.trim() || !form.number.trim() || !form.district.trim()) return setError("Informe rua, número e bairro.");
      if (minOrder > 0 && subtotal < minOrder) return setError(`Pedido mínimo para entrega: ${money(minOrder)}.`);
      if (baseFee === null) return setError("Escolha um bairro atendido.");
    }
    setSending(true);
    try {
      const guest = route === "delivery" ? { name: form.name.trim(), phone: form.phone.replace(/\D/g, "") } : { name: gate?.name || "", phone: (gate?.phone || "").replace(/\D/g, "") };
      const body: Record<string, unknown> = {
        tenantId: tenant.id,
        mode,
        mesa: mode === "mesa" ? mesa : undefined,
        people: mode === "mesa" ? gate?.people : undefined,
        items: cart.map((l) => ({ product_id: l.product_id, quantity: l.qty, note: l.note || undefined })),
        customer: { name: guest.name, phone: guest.phone || undefined },
        note: form.note.trim() || undefined,
      };
      if (mode === "delivery") body.address = { street: form.street, number: form.number, district: form.district, complement: form.complement, reference: form.reference };
      if (mode === "delivery" || mode === "pickup") body.payment = { method: pay, change_for: pay === "money" ? Number(changeFor.replace(",", ".")) || undefined : undefined };
      const res = await fetch("/api/public/menu-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível enviar o pedido.");
      setCart([]);
      if (mode === "mesa") {
        rememberOrder({ id: `m${data.number}-${Date.now()}`, label: `Mesa ${mesa} · comanda #${data.number}`, total: subtotal, at: Date.now() });
        setDone({ title: "Pedido enviado!", text: `A equipe já recebeu o pedido da Mesa ${mesa} (comanda #${data.number}). Pode pedir mais quando quiser — vai tudo na mesma conta.` });
      } else if (mode === "balcao") {
        rememberOrder({ id: `b${data.number}-${Date.now()}`, label: `Balcão · pedido nº ${data.number}`, total: subtotal, at: Date.now() });
        setDone({ title: "Pedido enviado!", text: `Seu pedido é o nº ${data.number}. Acompanhe no balcão — avisamos quando estiver pronto.` });
      } else {
        rememberOrder({ id: `d${data.order_id}`, label: `${mode === "delivery" ? "Entrega" : "Retirada"} · pedido #${data.order_id}`, total: Number(data.total), at: Date.now() });
        const wa = `https://wa.me/${String(tenant.whatsapp || "").replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Fiz o pedido #${data.order_id} pelo cardápio (${mode === "delivery" ? "entrega" : "retirada"}), total ${money(Number(data.total))}.`)}`;
        setDone({
          title: "Pedido recebido!",
          text: `Pedido #${data.order_id} · total ${money(Number(data.total))}${data.fee ? ` (entrega ${money(Number(data.fee))})` : ""}.${data.eta ? ` Tempo estimado: ${data.eta}.` : ""} A loja vai confirmar com você.`,
          wa,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar o pedido.");
    } finally {
      setSending(false);
    }
  };

  // ---- render ----
  const accent = tenant?.primary_color && tenant.primary_color !== "#000000" ? tenant.primary_color : "#c9a227";
  const styleVars = { ["--mnu-accent" as string]: tenant?.template_id === "adega" ? "#d9a62e" : accent } as React.CSSProperties;
  if (state.loading) return <div className="mnu"><div className="mnu-off">Carregando cardápio…</div></div>;
  if (state.error || !tenant) return <div className="mnu"><div className="mnu-off">{state.error || "Cardápio indisponível."}</div></div>;
  if (!tenant.food_enabled) return <div className="mnu"><div className="mnu-off">O cardápio digital desta loja ainda não está ativo.</div></div>;
  if (route === "mesa" && (!accepts.mesa || !mesa)) return <div className="mnu"><div className="mnu-off">{accepts.mesa ? "Mesa não informada. Leia o QR Code da sua mesa." : "O pedido pela mesa não está ativo nesta loja."}</div></div>;
  if (route === "balcao" && !accepts.balcao) return <div className="mnu"><div className="mnu-off">O pedido pelo balcão não está ativo nesta loja.</div></div>;
  if (route === "delivery" && !accepts.delivery && !accepts.pickup) return <div className="mnu"><div className="mnu-off">Esta loja não está recebendo pedidos de entrega ou retirada pelo cardápio.</div></div>;

  const status = openStatus(tenant.business_hours);
  const addr = [tenant.address_street && `${tenant.address_street}${tenant.address_number ? `, ${tenant.address_number}` : ""}`, tenant.address_district, tenant.address_city].filter(Boolean).join(" · ");
  const logo = tenant.logo_url ? <img className="mnu-logo" src={tenant.logo_url} alt={tenant.name} /> : <div className="mnu-logo">{tenant.name.slice(0, 1)}</div>;

  // Boas-vindas de mesa/balcão
  if (route !== "delivery" && !gate) {
    const enter = () => {
      if (!gateForm.name.trim()) return setGateError("Informe seu nome para continuar.");
      const g = { name: gateForm.name.trim(), phone: gateForm.phone, people: Math.max(1, gateForm.people) };
      store.set(gateKey, JSON.stringify(g));
      setGate(g);
    };
    return (
      <div className="mnu mnu-gate" style={styleVars}>
        {tenant.banner_url && <div className="mnu-hero-bg" style={{ backgroundImage: `url(${tenant.banner_url})` }} />}
        <div className="mnu-gate-card">
          {logo}
          <div>
            <h1>Bem-vindo ao {tenant.name}</h1>
            <div className="where" style={{ marginTop: 6 }}>{route === "mesa" ? `Mesa ${mesa}` : "Pedido no balcão"}</div>
          </div>
          {route === "balcao" && <p>Informe seu nome para ver o cardápio e fazer seu pedido.</p>}
          <input className="mnu-input" placeholder="Seu nome" value={gateForm.name} onChange={(e) => setGateForm({ ...gateForm, name: e.target.value })} autoComplete="name" />
          <input className="mnu-input" placeholder="(00) 00000-0000" inputMode="tel" value={gateForm.phone} onChange={(e) => setGateForm({ ...gateForm, phone: e.target.value })} autoComplete="tel" />
          {route === "mesa" && (
            <div className="mnu-gate-people">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Users size={16} />Pessoas na mesa</span>
              <div className="mnu-qty">
                <button type="button" aria-label="Menos" onClick={() => setGateForm((f) => ({ ...f, people: Math.max(1, f.people - 1) }))}><Minus size={16} /></button>
                <b>{gateForm.people}</b>
                <button type="button" aria-label="Mais" onClick={() => setGateForm((f) => ({ ...f, people: Math.min(30, f.people + 1) }))}><Plus size={16} /></button>
              </div>
            </div>
          )}
          {gateError && <div className="mnu-err">{gateError}</div>}
          <button type="button" className="mnu-btn" onClick={enter}>{route === "mesa" ? "Entrar no restaurante" : "Continuar"}</button>
        </div>
      </div>
    );
  }

  const modeChip =
    route === "mesa" ? { icon: <UtensilsCrossed size={13} />, text: `Mesa ${mesa}` }
    : route === "balcao" ? { icon: <ShoppingBag size={13} />, text: "Balcão" }
    : { icon: <Bike size={13} />, text: "Delivery" };
  const canSubmit = cart.length > 0 && !sending;

  return (
    <div className="mnu" style={styleVars}>
      <section className="mnu-hero">
        {tenant.banner_url && <div className="mnu-hero-bg" style={{ backgroundImage: `url(${tenant.banner_url})` }} />}
        <div className="mnu-wrap">
          {logo}
          <h1 className="mnu-title">{tenant.name}</h1>
          {(tenant.hero_tagline || tenant.about_text) && <p className="mnu-sub">{(tenant.hero_tagline || tenant.about_text || "").slice(0, 120)}</p>}
          <div className="mnu-chips">
            {status && <span className={`mnu-chip ${status.open ? "is-ok" : "is-off"}`}><i />{status.open ? "Aberto agora" : "Fechado"}</span>}
            {status && status.text !== "Fechado hoje" && <span className="mnu-chip"><Clock size={13} />{status.text}</span>}
            <span className="mnu-chip">{modeChip.icon}{modeChip.text}</span>
          </div>
          <div className="mnu-actions">
            <button type="button" className="mnu-action" onClick={() => setPanel("orders")}><span className="ic"><History size={16} /></span>Meus Pedidos</button>
            <button type="button" className="mnu-action" onClick={() => setPanel("info")}><span className="ic"><Info size={16} /></span>Info da Loja</button>
          </div>
          <div className="mnu-search"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar no cardápio..." aria-label="Buscar no cardápio" /></div>
        </div>
      </section>

      <div className="mnu-main">
        {sections.length > 1 && !q && (
          <div className="mnu-bar"><div className="mnu-wrap"><div className="mnu-tabs" role="tablist">
            {sections.map((s) => <button key={s.id} type="button" className={`mnu-tab ${activeCat === s.id ? "is-on" : ""}`} onClick={() => goTo(s.id)}>{s.name}</button>)}
          </div></div></div>
        )}
        <main className="mnu-wrap">
          {!q && featured.length > 0 && (
            <section className="mnu-section">
              <div className="mnu-sec-head"><h2><span className="mnu-fire"><Flame size={16} /></span>Destaques</h2><hr /></div>
              <div className="mnu-rail">
                {featured.map((p) => (
                  <button key={p.id} type="button" className="mnu-feat" onClick={() => setSheet({ product: p, qty: 1, note: "" })}>
                    <div className="mnu-feat-img">{imageOf(p) && <img src={imageOf(p)!} alt="" loading="lazy" />}<span className="mnu-feat-price">{money(unitPrice(p))}</span></div>
                    <div className="mnu-feat-name">{p.name}</div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {sections.length === 0 && <div className="mnu-empty">{q ? "Nada encontrado para a sua busca." : "O cardápio ainda não tem itens."}</div>}

          {sections.map((s) => (
            <section key={s.id} className="mnu-section" ref={(el) => { sectionRefs.current[s.id] = el; }}>
              <div className="mnu-sec-head"><h2>{s.name}</h2><hr /><span className="cnt">{s.items.length}</span></div>
              <div className="mnu-grid">
                {s.items.map((p) => {
                  const ok = available(p);
                  const promo = p.discount_price != null && Number(p.discount_price) < Number(p.price);
                  return (
                    <button key={p.id} type="button" className={`mnu-item ${ok ? "" : "is-out"}`} disabled={!ok} onClick={() => setSheet({ product: p, qty: 1, note: "" })}>
                      <div className="mnu-item-img">
                        {imageOf(p) ? <img src={imageOf(p)!} alt="" loading="lazy" /> : <div className="mnu-ph"><UtensilsCrossed size={34} /></div>}
                        {ok && <span className="mnu-add"><Plus size={20} /></span>}
                      </div>
                      <div className="mnu-item-body">
                        <strong>{p.name}</strong>
                        <p>{p.description || ""}</p>
                        <span className="mnu-price">{money(unitPrice(p))}{promo && <s>{money(Number(p.price))}</s>}</span>
                        {!ok && <span className="mnu-badge">Esgotado</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </main>
      </div>

      {itemCount > 0 && !panel && !sheet && (
        <div className="mnu-bagbar">
          <button type="button" className="mnu-bagbtn" onClick={() => setPanel("bag")}>
            <span><ShoppingBag size={20} />Ver sacola <em>{itemCount}</em></span><span>{money(subtotal)}</span>
          </button>
        </div>
      )}

      {sheet && (
        <div className="mnu-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setSheet(null); }}>
          <div className="mnu-sheet" role="dialog" aria-label={sheet.product.name}>
            <div className="mnu-sheet-top">
              <button type="button" className="mnu-x" aria-label="Fechar" onClick={() => setSheet(null)}><X size={20} /></button>
              {imageOf(sheet.product) && <div className="mnu-sheet-img"><img src={imageOf(sheet.product)!} alt="" /></div>}
            </div>
            <div className="mnu-sheet-body" style={!imageOf(sheet.product) ? { paddingTop: 60 } : undefined}>
              <h3>{sheet.product.name}</h3>
              {sheet.product.description && <p>{sheet.product.description}</p>}
              <span className="mnu-price" style={{ fontSize: 22 }}>{money(unitPrice(sheet.product))}</span>
              <label className="mnu-label">Alguma observação?
                <textarea className="mnu-textarea" maxLength={140} value={sheet.note} onChange={(e) => setSheet({ ...sheet, note: e.target.value })} placeholder="Ex.: sem gelo, bem gelada…" />
              </label>
            </div>
            <div className="mnu-foot" style={{ marginTop: 16 }}>
              <div className="mnu-qty">
                <button type="button" aria-label="Menos" onClick={() => setSheet({ ...sheet, qty: Math.max(1, sheet.qty - 1) })}><Minus size={16} /></button>
                <b>{sheet.qty}</b>
                <button type="button" aria-label="Mais" onClick={() => setSheet({ ...sheet, qty: Math.min(50, sheet.qty + 1) })}><Plus size={16} /></button>
              </div>
              <button type="button" className="mnu-cta" onClick={() => { addToCart(sheet.product, sheet.qty, sheet.note); setSheet(null); }}>
                <span>Adicionar</span><span>{money(unitPrice(sheet.product) * sheet.qty)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {panel === "info" && (
        <div className="mnu-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setPanel(null); }}>
          <div className="mnu-sheet" role="dialog" aria-label="Info da loja">
            <div className="mnu-bag-head"><h3>Info da loja</h3><button type="button" className="mnu-x" style={{ position: "static" }} aria-label="Fechar" onClick={() => setPanel(null)}><X size={20} /></button></div>
            <div className="mnu-sheet-body" style={{ paddingTop: 4 }}>
              <div className="mnu-info-list">
                {addr && <div><span><MapPin size={14} style={{ verticalAlign: "-2px" }} /> Endereço</span><b style={{ textAlign: "right" }}>{addr}</b></div>}
                {tenant.whatsapp && <div><span><Phone size={14} style={{ verticalAlign: "-2px" }} /> WhatsApp</span><a href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>{tenant.whatsapp}</a></div>}
                {route === "delivery" && accepts.delivery && <div><span><Bike size={14} style={{ verticalAlign: "-2px" }} /> Entrega</span><b style={{ textAlign: "right" }}>{delivery.fee_mode === "neighborhood" ? "taxa por bairro" : money(Math.max(0, Number(delivery.fixed_fee) || 0))}{delivery.eta ? ` · ${delivery.eta}` : ""}</b></div>}
                {route === "delivery" && accepts.delivery && minOrder > 0 && <div><span>Pedido mínimo</span><b>{money(minOrder)}</b></div>}
                {route === "delivery" && accepts.delivery && freeAbove > 0 && <div><span>Frete grátis acima de</span><b>{money(freeAbove)}</b></div>}
                {route === "delivery" && accepts.pickup && <div><span><Store size={14} style={{ verticalAlign: "-2px" }} /> Retirada</span><b>{cfg.pickup_eta || "na loja"}</b></div>}
              </div>
              {tenant.business_hours && (
                <div className="mnu-info-list">
                  {["seg", "ter", "qua", "qui", "sex", "sab", "dom"].filter((k) => tenant.business_hours![k]).map((k) => {
                    const h = tenant.business_hours![k];
                    return <div key={k}><span>{DAY_LABEL[k]}</span><b>{h.closed ? "Fechado" : `${h.open} às ${h.close}`}</b></div>;
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {panel === "orders" && (
        <div className="mnu-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setPanel(null); }}>
          <div className="mnu-sheet" role="dialog" aria-label="Meus pedidos">
            <div className="mnu-bag-head"><h3>Meus pedidos</h3><button type="button" className="mnu-x" style={{ position: "static" }} aria-label="Fechar" onClick={() => setPanel(null)}><X size={20} /></button></div>
            <div className="mnu-sheet-body" style={{ paddingTop: 4 }}>
              {orders.length === 0 ? <p>Você ainda não fez pedidos neste aparelho.</p> : (
                <div className="mnu-hist">
                  {orders.map((o) => (
                    <div key={o.id}><span><b>{o.label}</b><br /><small style={{ color: "#8a8aa3" }}>{new Date(o.at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</small></span><b>{money(o.total)}</b></div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {panel === "bag" && (
        <div className="mnu-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !sending) { setPanel(null); setDone(null); } }}>
          <div className="mnu-sheet" role="dialog" aria-label="Sacola">
            {done ? (
              <div className="mnu-done">
                <div className="ok"><Check size={34} /></div>
                <h3>{done.title}</h3>
                <p>{done.text}</p>
                {done.wa && <a className="mnu-btn" href={done.wa} target="_blank" rel="noreferrer"><Phone size={16} />Falar com a loja</a>}
                <button type="button" className="mnu-btn is-ghost" onClick={() => { setPanel(null); setDone(null); }}>Voltar ao cardápio</button>
              </div>
            ) : (
              <>
                <div className="mnu-bag-head"><h3>Sua sacola</h3><button type="button" className="mnu-x" style={{ position: "static" }} aria-label="Fechar" onClick={() => setPanel(null)}><X size={20} /></button></div>
                <div className="mnu-sheet-body" style={{ paddingTop: 0 }}>
                  <div>
                    {cart.map((l) => (
                      <div key={l.key} className="mnu-line">
                        <div><strong>{l.name}</strong>{l.note && <small>Obs.: {l.note}</small>}<small>{money(l.price * l.qty)}</small></div>
                        <div className="mnu-qty">
                          <button type="button" aria-label="Menos" onClick={() => changeQty(l.key, -1)}>{l.qty === 1 ? <Trash2 size={15} /> : <Minus size={15} />}</button>
                          <b>{l.qty}</b>
                          <button type="button" aria-label="Mais" onClick={() => changeQty(l.key, 1)}><Plus size={15} /></button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {route !== "delivery" && gate && (
                    <div className="mnu-note"><User size={13} style={{ verticalAlign: "-2px" }} /> {gate.name}{route === "mesa" ? ` · Mesa ${mesa} · ${gate.people} ${gate.people === 1 ? "pessoa" : "pessoas"}` : " · balcão"}</div>
                  )}

                  {route === "delivery" && (
                    <>
                      {accepts.delivery && accepts.pickup && (
                        <div className="mnu-seg">
                          <button type="button" className={receiveNow === "delivery" ? "is-on" : ""} onClick={() => setReceive("delivery")}>Entrega</button>
                          <button type="button" className={receiveNow === "pickup" ? "is-on" : ""} onClick={() => setReceive("pickup")}>Retirar na loja</button>
                        </div>
                      )}
                      {receiveNow === "delivery" && (
                        <div className="mnu-note">
                          {delivery.fee_mode === "neighborhood" ? "Taxa de entrega por bairro" : `Taxa de entrega ${money(Math.max(0, Number(delivery.fixed_fee) || 0))}`}
                          {minOrder > 0 && <> · pedido mínimo <b>{money(minOrder)}</b></>}
                          {freeAbove > 0 && <> · <b>frete grátis</b> acima de {money(freeAbove)}</>}
                          {delivery.eta && <> · tempo estimado <b>{delivery.eta}</b></>}
                        </div>
                      )}
                      <label className="mnu-label">Seu nome<input className="mnu-input" value={form.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" /></label>
                      <label className="mnu-label">WhatsApp<input className="mnu-input" inputMode="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="(00) 90000-0000" autoComplete="tel" /></label>
                    </>
                  )}

                  {mode === "delivery" && (
                    <>
                      <div className="mnu-row">
                        <label className="mnu-label">Rua<input className="mnu-input" value={form.street} onChange={(e) => set({ street: e.target.value })} autoComplete="address-line1" /></label>
                        <label className="mnu-label">Número<input className="mnu-input" value={form.number} onChange={(e) => set({ number: e.target.value })} /></label>
                      </div>
                      <div className="mnu-row">
                        <label className="mnu-label">Bairro
                          {delivery.fee_mode === "neighborhood" && hoods.length > 0 ? (
                            <select className="mnu-select" value={form.district} onChange={(e) => set({ district: e.target.value })}>
                              <option value="">Escolha…</option>
                              {hoods.map((n) => <option key={n.name} value={n.name}>{n.name} — {money(Math.max(0, Number(n.fee) || 0))}</option>)}
                            </select>
                          ) : (
                            <input className="mnu-input" value={form.district} onChange={(e) => set({ district: e.target.value })} />
                          )}
                        </label>
                        <label className="mnu-label">Complemento<input className="mnu-input" value={form.complement} onChange={(e) => set({ complement: e.target.value })} /></label>
                      </div>
                      <label className="mnu-label">Ponto de referência <span>(opcional)</span><input className="mnu-input" value={form.reference} onChange={(e) => set({ reference: e.target.value })} /></label>
                    </>
                  )}

                  {(mode === "delivery" || mode === "pickup") && (
                    <div className="mnu-label">Pagamento <span>na {mode === "delivery" ? "entrega" : "retirada"}</span>
                      <div className="mnu-pay">
                        {payAllowed.pix && <button type="button" className={pay === "pix" ? "is-on" : ""} onClick={() => setPay("pix")}>PIX</button>}
                        {payAllowed.money && <button type="button" className={pay === "money" ? "is-on" : ""} onClick={() => setPay("money")}>Dinheiro</button>}
                        {payAllowed.card && <button type="button" className={pay === "card" ? "is-on" : ""} onClick={() => setPay("card")}>Cartão</button>}
                      </div>
                      {pay === "money" && <input className="mnu-input" inputMode="decimal" value={changeFor} onChange={(e) => setChangeFor(e.target.value)} placeholder="Troco para quanto? (opcional)" style={{ marginTop: 8 }} />}
                      {pay === "pix" && <span style={{ marginTop: 6 }}>A loja envia a chave PIX ao confirmar o pedido.</span>}
                    </div>
                  )}

                  <label className="mnu-label">Observações do pedido <span>(opcional)</span><textarea className="mnu-textarea" maxLength={200} value={form.note} onChange={(e) => set({ note: e.target.value })} /></label>

                  <div className="mnu-sum">
                    <div><span>Subtotal</span><span>{money(subtotal)}</span></div>
                    {mode === "delivery" && <div><span>Entrega</span><span>{baseFee === null ? "escolha o bairro" : fee === 0 ? "Grátis" : money(fee)}</span></div>}
                    <div className="is-total"><span>Total</span><span>{money(total)}</span></div>
                  </div>
                  {mode === "delivery" && minOrder > 0 && subtotal < minOrder && <div className="mnu-err">Faltam {money(minOrder - subtotal)} para o pedido mínimo de entrega.</div>}
                  {error && <div className="mnu-err">{error}</div>}
                </div>
                <div className="mnu-foot" style={{ marginTop: 14 }}>
                  <button type="button" className="mnu-cta" disabled={!canSubmit} onClick={submit}>
                    <span>{sending ? "Enviando…" : mode === "mesa" ? `Enviar pedido da mesa ${mesa}` : "Enviar pedido"}</span><span>{money(total)}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
