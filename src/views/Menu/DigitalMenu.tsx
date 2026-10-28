import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import {
  Bike, Check, Clock, MapPin, Minus, Phone, Plus, Search, ShoppingBag, Store, Trash2, UtensilsCrossed, X, Instagram,
} from "lucide-react";
import "./menu.css";

type Mode = "mesa" | "balcao" | "pickup" | "delivery";
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
interface MenuTenant {
  id: number;
  name: string;
  whatsapp: string;
  logo_url?: string | null;
  banner_url?: string | null;
  instagram_url?: string | null;
  hero_tagline?: string | null;
  about_text?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_district?: string | null;
  address_city?: string | null;
  primary_color?: string | null;
  template_id?: string | null;
  food_enabled?: boolean;
  sell_without_stock_control?: boolean;
  policies?: { menu?: MenuConfig } | null;
}
interface CartLine { key: string; product_id: number; name: string; price: number; qty: number; note: string; image: string | null }

const money = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
const unitPrice = (p: MenuProduct) => Number(p.discount_price ?? p.price);
const imageOf = (p: MenuProduct): string | null => {
  if (p.image_url) return p.image_url;
  const first = Array.isArray(p.images) ? p.images[0] : null;
  return typeof first === "string" ? first : first && typeof first === "object" && "url" in (first as object) ? String((first as { url: unknown }).url) : null;
};
const DARK_THEMES = new Set(["adega", "cyber", "luxury"]);
const safeStore = {
  get: (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* ok */ } },
};

// Cardápio digital: tela própria (não é o site/catálogo). Pede por mesa (QR), balcão, retirada ou entrega.
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

  // ---- modo (mesa vem do QR; os demais o cliente escolhe) ----
  const query = new URLSearchParams(location.search);
  const mesaFromUrl = (query.get("mesa") || "").trim().slice(0, 20);
  const mesaStored = tenant ? safeStore.get(`menu_mesa_${tid}`) || "" : "";
  const mesa = mesaFromUrl || mesaStored;
  useEffect(() => { if (tenant && mesaFromUrl) safeStore.set(`menu_mesa_${tenant.id}`, mesaFromUrl); }, [tenant, mesaFromUrl]);

  const availableModes = useMemo(() => {
    const list: Mode[] = [];
    if (accepts.delivery) list.push("delivery");
    if (accepts.pickup) list.push("pickup");
    if (accepts.balcao) list.push("balcao");
    return list;
  }, [accepts.delivery, accepts.pickup, accepts.balcao]);
  const wantsBalcao = query.get("balcao") !== null;
  const [chosenMode, setChosenMode] = useState<Mode | null>(null);
  const mode: Mode | null = mesa && accepts.mesa ? "mesa" : chosenMode ?? (wantsBalcao && accepts.balcao ? "balcao" : availableModes[0] ?? null);

  // ---- carrinho ----
  const [cart, setCart] = useState<CartLine[]>([]);
  useEffect(() => {
    if (!tenant) return;
    try { setCart(JSON.parse(localStorage.getItem(`menu_cart_${tenant.id}`) || "[]")); } catch { setCart([]); }
  }, [tenant]);
  useEffect(() => {
    if (!tenant) return;
    try { localStorage.setItem(`menu_cart_${tenant.id}`, JSON.stringify(cart)); } catch { /* ok */ }
  }, [cart, tenant]);

  const subtotal = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const itemCount = cart.reduce((s, l) => s + l.qty, 0);

  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState<{ product: MenuProduct; qty: number; note: string } | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<string>("");
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
    for (const c of categories) if (by.has(c.id)) out.push({ id: `c${c.id}`, name: c.name, items: by.get(c.id)! });
    if (by.has("none")) out.push({ id: "none", name: "Outros", items: by.get("none")! });
    return out;
  }, [filtered, categories]);
  const featured = useMemo(
    () => [...products].filter((p) => available(p) && ((p.sold_count || 0) > 0 || p.is_featured)).sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0)).slice(0, 8),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products],
  );

  // categoria ativa pela rolagem
  useEffect(() => {
    const onScroll = () => {
      let current = "";
      for (const s of sections) {
        const el = sectionRefs.current[s.id];
        if (el && el.getBoundingClientRect().top < 160) current = s.id;
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
      return [...prev, { key, product_id: product.id, name: product.name, price: unitPrice(product), qty, note: cleanNote, image: imageOf(product) }];
    });
  };
  const changeQty = (key: string, delta: number) =>
    setCart((prev) => prev.flatMap((l) => (l.key !== key ? [l] : l.qty + delta <= 0 ? [] : [{ ...l, qty: Math.min(50, l.qty + delta) }])));

  // ---- entrega ----
  const delivery = cfg.delivery || {};
  const freeAbove = Math.max(0, Number(delivery.free_above) || 0);
  const minOrder = Math.max(0, Number(delivery.min_order) || 0);
  const hoods = (delivery.neighborhoods || []).filter((n) => n.name);
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

  const submit = async () => {
    if (!tenant || !mode) return;
    setError(null);
    if ((mode === "balcao" || mode === "pickup" || mode === "delivery") && !form.name.trim()) return setError("Informe seu nome.");
    if ((mode === "pickup" || mode === "delivery") && form.phone.replace(/\D/g, "").length < 10) return setError("Informe um WhatsApp válido (com DDD).");
    if (mode === "delivery") {
      if (!form.street.trim() || !form.number.trim() || !form.district.trim()) return setError("Informe rua, número e bairro.");
      if (minOrder > 0 && subtotal < minOrder) return setError(`Pedido mínimo para entrega: ${money(minOrder)}.`);
      if (baseFee === null) return setError("Escolha um bairro atendido.");
    }
    setSending(true);
    try {
      const body: Record<string, unknown> = {
        tenantId: tenant.id,
        mode,
        mesa: mode === "mesa" ? mesa : undefined,
        items: cart.map((l) => ({ product_id: l.product_id, quantity: l.qty, note: l.note || undefined })),
        customer: { name: form.name.trim(), phone: form.phone.replace(/\D/g, "") || undefined },
        note: form.note.trim() || undefined,
      };
      if (mode === "delivery") body.address = { street: form.street, number: form.number, district: form.district, complement: form.complement, reference: form.reference };
      if (mode === "delivery" || mode === "pickup") body.payment = { method: pay, change_for: pay === "money" ? Number(changeFor.replace(",", ".")) || undefined : undefined };
      const res = await fetch("/api/public/menu-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível enviar o pedido.");
      setCart([]);
      if (mode === "mesa") setDone({ title: "Pedido enviado!", text: `A equipe já recebeu o pedido da Mesa ${mesa} (comanda #${data.number}). Pode pedir mais quando quiser — vai tudo na mesma conta.` });
      else if (mode === "balcao") setDone({ title: "Pedido enviado!", text: `Seu pedido é o nº ${data.number}. Acompanhe no balcão — avisamos quando estiver pronto.` });
      else {
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
  if (state.loading) return <div className="mnu" data-theme="light"><div className="mnu-off">Carregando cardápio…</div></div>;
  if (state.error || !tenant) return <div className="mnu" data-theme="light"><div className="mnu-off">{state.error || "Cardápio indisponível."}</div></div>;
  if (!tenant.food_enabled) return <div className="mnu" data-theme="light"><div className="mnu-off">O cardápio digital desta loja ainda não está ativo.</div></div>;

  const dark = DARK_THEMES.has(tenant.template_id || "");
  const accent = tenant.template_id === "adega" ? "#d9a62e" : tenant.primary_color && tenant.primary_color !== "#000000" ? tenant.primary_color : "#d9a62e";
  const addr = [tenant.address_street && `${tenant.address_street}${tenant.address_number ? `, ${tenant.address_number}` : ""}`, tenant.address_district, tenant.address_city].filter(Boolean).join(" · ");

  const modeLabel: Record<Mode, { label: string; sub: string; icon: React.ReactNode }> = {
    mesa: { label: `Mesa ${mesa}`, sub: "pedir na mesa", icon: <UtensilsCrossed size={18} /> },
    delivery: { label: "Entrega", sub: delivery.eta || "receba em casa", icon: <Bike size={18} /> },
    pickup: { label: "Retirada", sub: cfg.pickup_eta || "buscar na loja", icon: <Store size={18} /> },
    balcao: { label: "Balcão", sub: "pedir aqui na loja", icon: <ShoppingBag size={18} /> },
  };

  const needsForm = mode !== "mesa";
  const canSubmit = cart.length > 0 && !sending && !!mode;

  return (
    <div className="mnu" data-theme={dark ? "dark" : "light"} style={{ ["--mnu-accent" as string]: accent }}>
      <div className="mnu-cover">{tenant.banner_url && <img src={tenant.banner_url} alt="" />}</div>
      <div className="mnu-wrap">
        <header className="mnu-head">
          {tenant.logo_url ? <img className="mnu-logo" src={tenant.logo_url} alt={tenant.name} /> : <div className="mnu-logo">{tenant.name.slice(0, 1)}</div>}
          <h1 className="mnu-title">{tenant.name}</h1>
          {(tenant.hero_tagline || tenant.about_text) && <p className="mnu-sub">{(tenant.hero_tagline || tenant.about_text || "").slice(0, 140)}</p>}
          <div className="mnu-chips">
            {addr && <span className="mnu-chip"><MapPin size={13} />{addr}</span>}
            {tenant.whatsapp && <a className="mnu-chip" href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><Phone size={13} />WhatsApp</a>}
            {tenant.instagram_url && <a className="mnu-chip" href={tenant.instagram_url} target="_blank" rel="noreferrer"><Instagram size={13} />Instagram</a>}
          </div>

          {mesa && accepts.mesa ? (
            <div className="mnu-info"><b>Mesa {mesa}</b> — faça seu pedido pelo celular. Ele chega direto para a equipe e entra na conta da mesa.</div>
          ) : (
            availableModes.length > 0 && (
              <>
                <div className="mnu-modes">
                  {availableModes.map((m) => (
                    <button key={m} type="button" className={`mnu-mode ${mode === m ? "is-on" : ""}`} onClick={() => setChosenMode(m)}>
                      {modeLabel[m].icon}{modeLabel[m].label}<small>{modeLabel[m].sub}</small>
                    </button>
                  ))}
                </div>
                {mode === "delivery" && (
                  <div className="mnu-info">
                    {delivery.fee_mode === "neighborhood" ? "Taxa de entrega por bairro" : `Taxa de entrega ${money(Math.max(0, Number(delivery.fixed_fee) || 0))}`}
                    {minOrder > 0 && <> · pedido mínimo <b>{money(minOrder)}</b></>}
                    {freeAbove > 0 && <> · <b>frete grátis</b> acima de {money(freeAbove)}</>}
                    {delivery.eta && <> · <Clock size={12} style={{ verticalAlign: "-2px" }} /> {delivery.eta}</>}
                  </div>
                )}
              </>
            )
          )}
        </header>
      </div>

      <div className="mnu-bar">
        <div className="mnu-wrap">
          <div className="mnu-search"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar no cardápio" aria-label="Buscar no cardápio" /></div>
          {sections.length > 1 && !q && (
            <div className="mnu-tabs" role="tablist">
              {sections.map((s) => (
                <button key={s.id} type="button" className={`mnu-tab ${activeCat === s.id ? "is-on" : ""}`} onClick={() => goTo(s.id)}>{s.name}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      <main className="mnu-wrap">
        {!q && featured.length > 0 && (
          <section className="mnu-section">
            <h2>Mais pedidos</h2>
            <div className="mnu-rail">
              {featured.map((p) => (
                <button key={p.id} type="button" className="mnu-feat" onClick={() => setSheet({ product: p, qty: 1, note: "" })}>
                  <div className="mnu-feat-img">{imageOf(p) && <img src={imageOf(p)!} alt="" loading="lazy" />}</div>
                  <div className="mnu-feat-body"><strong>{p.name}</strong><span className="mnu-price">{money(unitPrice(p))}</span></div>
                </button>
              ))}
            </div>
          </section>
        )}

        {sections.length === 0 && <div className="mnu-empty">{q ? "Nada encontrado para a sua busca." : "O cardápio ainda não tem itens."}</div>}

        {sections.map((s) => (
          <section key={s.id} className="mnu-section" ref={(el) => { sectionRefs.current[s.id] = el; }}>
            <h2>{s.name}</h2>
            <div className="mnu-grid">
              {s.items.map((p) => {
                const ok = available(p);
                const promo = p.discount_price != null && Number(p.discount_price) < Number(p.price);
                return (
                  <button key={p.id} type="button" className={`mnu-item ${ok ? "" : "is-out"}`} disabled={!ok} onClick={() => setSheet({ product: p, qty: 1, note: "" })}>
                    <div className="mnu-item-txt">
                      <strong>{p.name}</strong>
                      {p.description && <p>{p.description}</p>}
                      <span className={`mnu-price ${promo ? "is-promo" : ""}`}>{money(unitPrice(p))}{promo && <s>{money(Number(p.price))}</s>}</span>
                      {!ok && <span className="mnu-badge">Esgotado</span>}
                    </div>
                    <div className="mnu-item-img">
                      {imageOf(p) ? <img src={imageOf(p)!} alt="" loading="lazy" /> : <div className="mnu-ph"><UtensilsCrossed size={26} /></div>}
                      {ok && <span className="mnu-add"><Plus size={18} /></span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      {itemCount > 0 && !bagOpen && !sheet && (
        <div className="mnu-bagbar">
          <button type="button" className="mnu-bagbtn" onClick={() => setBagOpen(true)}>
            <span><ShoppingBag size={20} />Ver sacola ({itemCount})</span><span>{money(subtotal)}</span>
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
            <div className="mnu-sheet-body">
              <h3>{sheet.product.name}</h3>
              {sheet.product.description && <p>{sheet.product.description}</p>}
              <span className="mnu-price" style={{ fontSize: 20 }}>{money(unitPrice(sheet.product))}</span>
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

      {bagOpen && (
        <div className="mnu-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !sending) { setBagOpen(false); setDone(null); } }}>
          <div className="mnu-sheet" role="dialog" aria-label="Sacola">
            {done ? (
              <div className="mnu-done">
                <div className="ok"><Check size={34} /></div>
                <h3>{done.title}</h3>
                <p>{done.text}</p>
                {done.wa && <a className="mnu-btn" href={done.wa} target="_blank" rel="noreferrer"><Phone size={16} />Falar com a loja</a>}
                <button type="button" className="mnu-btn is-ghost" onClick={() => { setBagOpen(false); setDone(null); }}>Voltar ao cardápio</button>
              </div>
            ) : (
              <>
                <div className="mnu-bag-head"><h3>Sua sacola</h3><button type="button" className="mnu-x" style={{ position: "static" }} aria-label="Fechar" onClick={() => setBagOpen(false)}><X size={20} /></button></div>
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

                  {needsForm && (
                    <>
                      <label className="mnu-label">Seu nome<input className="mnu-input" value={form.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" /></label>
                      {(mode === "delivery" || mode === "pickup") && (
                        <label className="mnu-label">WhatsApp<input className="mnu-input" inputMode="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="(00) 90000-0000" autoComplete="tel" /></label>
                      )}
                    </>
                  )}
                  {mode === "mesa" && (
                    <label className="mnu-label">Seu nome <span>(opcional)</span><input className="mnu-input" value={form.name} onChange={(e) => set({ name: e.target.value })} /></label>
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
