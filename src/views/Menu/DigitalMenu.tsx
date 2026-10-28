import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Search, ShoppingBag } from "lucide-react";
import "./menu.css";
import type {
  CartLine, MenuCategory, MenuConfig, MenuProduct, MenuSection, MenuTenant, OrderMode, PastOrder, PayMethod, Receive, Route,
} from "./menuTypes";
import { catStyle, lstore, money, openStatus, sstore, unitPrice } from "./menuTypes";
import { Bag, type BagContext, type BagForm } from "./components/Bag";
import { CategoryTabs, Hero, Sidebar } from "./components/Navigation";
import { Gate, InfoPanel, OrdersPanel } from "./components/Panels";
import { FeaturedRail, ProductCard, ProductSheet } from "./components/Products";
import { Sheet } from "./components/parts";

const useMedia = (query: string) => {
  const [match, setMatch] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return match;
};

// Cardápio digital: tela própria (não é o site/catálogo), com três entradas:
//  /cardapio              → delivery (entrega ou retirada)
//  /cardapio/mesa/:n      → pedido na mesa (QR)
//  /cardapio/balcao       → pedido no balcão (QR)
// Celular: topo + abas. Tablet/computador: menu de categorias fixo na lateral; no computador a sacola fica sempre à direita.
export default function DigitalMenu() {
  const { slug: routeSlug } = useParams();
  const location = useLocation();
  const wide = useMedia("(min-width: 1200px)");
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
  useEffect(() => {
    if (!tenant || route === "delivery") return;
    try { const saved = sstore.get(gateKey); setGate(saved ? JSON.parse(saved) : null); } catch { setGate(null); }
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
  const [sheet, setSheet] = useState<MenuProduct | null>(null);
  const [panel, setPanel] = useState<null | "bag" | "info" | "orders">(null);
  const [activeCat, setActiveCat] = useState("");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const available = (p: MenuProduct) => p.track_stock === false || !!tenant?.sell_without_stock_control || p.stock_quantity > 0;
  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => products.filter((p) => !q || p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q)), [products, q]);
  const sections = useMemo<MenuSection[]>(() => {
    const by = new Map<number | "none", MenuProduct[]>();
    for (const p of filtered) {
      const key = p.category_id && categories.some((c) => c.id === p.category_id) ? p.category_id : "none";
      by.set(key, [...(by.get(key) || []), p]);
    }
    const out: MenuSection[] = [];
    for (const c of [...categories].sort((a, b) => a.id - b.id)) if (by.has(c.id)) out.push({ id: `c${c.id}`, name: c.name, items: by.get(c.id)! });
    if (by.has("none")) out.push({ id: "none", name: "Outros", items: by.get("none")! });
    return out;
  }, [filtered, categories]);
  const featured = useMemo(
    () => [...products].filter((p) => available(p) && ((p.sold_count || 0) > 0 || p.is_featured)).sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0)).slice(0, 8),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products],
  );
  const showFeatured = !q && featured.length > 0;

  useEffect(() => {
    const onScroll = () => {
      let current = "";
      const feat = document.getElementById("mnu-featured");
      if (feat && feat.getBoundingClientRect().top < 140) current = "featured";
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
  const goTo = (id: string) => (id === "featured" ? document.getElementById("mnu-featured") : sectionRefs.current[id])?.scrollIntoView({ behavior: "smooth", block: "start" });

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

  // ---- delivery / fechamento ----
  const delivery = cfg.delivery || {};
  const freeAbove = Math.max(0, Number(delivery.free_above) || 0);
  const minOrder = Math.max(0, Number(delivery.min_order) || 0);
  const hoods = (delivery.neighborhoods || []).filter((n) => n.name);
  const [receive, setReceive] = useState<Receive | null>(null);
  const receiveNow: Receive = receive ?? (accepts.delivery ? "delivery" : "pickup");
  const mode: OrderMode = route === "delivery" ? receiveNow : route;
  const [form, setFormState] = useState<BagForm>({ name: "", phone: "", street: "", number: "", district: "", complement: "", reference: "", note: "" });
  const [pay, setPay] = useState<PayMethod>("pix");
  const [changeFor, setChangeFor] = useState("");
  const setForm = (patch: Partial<BagForm>) => setFormState((f) => ({ ...f, ...patch }));
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

  if (route !== "delivery" && !gate) {
    return (
      <Gate
        tenant={tenant}
        route={route}
        mesa={mesa}
        style={styleVars}
        onEnter={(g) => { sstore.set(gateKey, JSON.stringify(g)); setGate(g); }}
      />
    );
  }

  const status = openStatus(tenant.business_hours);
  const bagCtx: BagContext = {
    route, mode, mesa, gate, cfg, accepts, cart, subtotal, fee, total, baseFee, minOrder, freeAbove, hoods, payAllowed,
    receiveNow, setReceive, form, setForm, pay, setPay, changeFor, setChangeFor, error, sending,
    canSubmit: cart.length > 0 && !sending,
    submit, done, resetDone: () => setDone(null), changeQty,
  };

  return (
    <div className={`mnu mnu-app ${wide ? "has-cart" : ""}`} style={styleVars}>
      <Hero tenant={tenant} status={status} route={route} mesa={mesa} search={search} onSearch={setSearch} onOrders={() => setPanel("orders")} onInfo={() => setPanel("info")} />
      <Sidebar
        tenant={tenant} status={status} route={route} mesa={mesa} sections={sections} hasFeatured={showFeatured}
        active={activeCat} onGo={goTo} onOrders={() => setPanel("orders")} onInfo={() => setPanel("info")}
      />

      <div className="mnu-content">
        <div className="mnu-top">
          <div className="mnu-top-search"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar no cardápio..." aria-label="Buscar no cardápio" /></div>
          {!wide && itemCount > 0 && (
            <button type="button" className="mnu-top-bag" onClick={() => setPanel("bag")}><ShoppingBag size={18} />Sacola <em>{itemCount}</em><b>{money(subtotal)}</b></button>
          )}
        </div>

        <div className="mnu-main">
          {sections.length > 1 && !q && <CategoryTabs sections={sections} active={activeCat} onGo={goTo} />}
          <main className="mnu-wrap">
            {showFeatured && <FeaturedRail products={featured} categories={categories} onOpen={setSheet} />}
            {sections.length === 0 && <div className="mnu-empty">{q ? "Nada encontrado para a sua busca." : "O cardápio ainda não tem itens."}</div>}
            {sections.map((s) => {
              const st = catStyle(s.name);
              const SI = st.icon;
              return (
                <section key={s.id} className="mnu-section" ref={(el) => { sectionRefs.current[s.id] = el; }}>
                  <div className="mnu-sec-head"><span className="ic" style={{ background: st.tint, color: st.fg }}><SI size={16} /></span><h2>{s.name}</h2><hr /><span className="cnt">{s.items.length}</span></div>
                  <div className="mnu-grid">
                    {s.items.map((p) => <ProductCard key={p.id} product={p} available={available(p)} style={st} onOpen={() => setSheet(p)} />)}
                  </div>
                </section>
              );
            })}
          </main>
        </div>
      </div>

      {wide && <aside className="mnu-cart"><Bag ctx={bagCtx} inline /></aside>}

      {!wide && itemCount > 0 && !panel && !sheet && (
        <div className="mnu-bagbar">
          <button type="button" className="mnu-bagbtn" onClick={() => setPanel("bag")}>
            <span><ShoppingBag size={20} />Ver sacola <em>{itemCount}</em></span><span>{money(subtotal)}</span>
          </button>
        </div>
      )}

      {sheet && <ProductSheet key={sheet.id} product={sheet} categories={categories} onClose={() => setSheet(null)} onAdd={(qty, note) => { addToCart(sheet, qty, note); setSheet(null); }} />}
      {panel === "info" && <InfoPanel tenant={tenant} cfg={cfg} route={route} accepts={accepts} onClose={() => setPanel(null)} />}
      {panel === "orders" && <OrdersPanel orders={orders} onClose={() => setPanel(null)} />}
      {panel === "bag" && !wide && (
        <Sheet label="Sacola" locked={sending} onClose={() => { setPanel(null); setDone(null); }}>
          <Bag ctx={bagCtx} onClose={() => setPanel(null)} />
        </Sheet>
      )}
    </div>
  );
}
