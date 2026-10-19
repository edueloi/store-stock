import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ListChecks, MessageCircle, Search, ShoppingCart, Tags, Zap } from "lucide-react";
import { gsap } from "gsap";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { StoreButton } from "../../../../components/store/StoreButton";
import { useStore } from "../../StoreLayout";
import { ProductRow } from "./parts";
import { useTheme, waLink } from "./lib";
import "./styles.css";

export default function StoreFront() {
  const { tenant, products, categories } = useStore();
  const { path } = useTheme();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [list, setList] = useState("");
  const root = useRef<HTMLElement>(null);
  const sf = tenant.policies?.storefront || {};

  const active = useMemo(() => products.filter((p) => p.is_active && p.type !== "internal"), [products]);
  const cats = useMemo(
    () =>
      categories
        .map((c) => ({ ...c, count: active.filter((p) => p.category_id === c.id).length }))
        .filter((c) => c.count > 0),
    [categories, active],
  );
  const featured = useMemo(() => {
    const f = active.filter((p) => p.is_featured);
    return (f.length ? f : active).slice(0, 8);
  }, [active]);

  useEffect(() => {
    if (!root.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from(".ep-finder > *", { opacity: 0, y: 24, duration: 0.6, stagger: 0.09, ease: "power3.out" });
      gsap.from(".ep-index li", { opacity: 0, x: 20, duration: 0.5, stagger: 0.06, delay: 0.25, ease: "power2.out" });
    }, root);
    return () => ctx.revert();
  }, []);

  const title = tenant.hero_tagline || "Tudo para sua instalação, no código certo.";
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (cat) params.set("cat", cat);
    const qs = params.toString();
    navigate(path(`/catalogo${qs ? `?${qs}` : ""}`));
  };
  const quoteHref = waLink(tenant, `Olá! Preciso de um orçamento dos materiais:\n${list.trim() || "(vou enviar a lista em seguida)"}`);

  const fallback = (
    <section className="ep-hero">
      <div className="ep-finder">
        <p className="ep-eyebrow">
          <Zap size={14} aria-hidden="true" /> {tenant.name}
        </p>
        <h1>{title}</h1>
        <form onSubmit={submit} className="ep-quick" role="search">
          <label htmlFor="ep-quick-cat">Encontre por tipo e código</label>
          <div className="ep-quick-row">
            <select id="ep-quick-cat" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Tipo de material">
              <option value="">Todos os tipos</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <span className="ep-quick-in">
              <Search size={18} aria-hidden="true" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome ou código do material" aria-label="Nome ou código" />
            </span>
            <StoreButton type="submit" size="md" className="ep-btn ep-btn-dark">
              {sf.hero_button_label || "Buscar"}
            </StoreButton>
          </div>
        </form>
        {cats.length > 0 && (
          <div className="ep-hero-chips">
            {cats.slice(0, 5).map((c) => (
              <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>
                {c.name}
              </Link>
            ))}
          </div>
        )}
      </div>
      <aside className="ep-index" aria-label="Índice de materiais">
        <p className="ep-index-h">Índice de materiais</p>
        <ol>
          {cats.slice(0, 6).map((c, i) => (
            <li key={c.id}>
              <Link to={path(`/catalogo?cat=${c.id}`)}>
                <span className="ep-index-n">{String(i + 1).padStart(2, "0")}</span>
                <span className="ep-index-t">{c.name}</span>
                <span className="ep-index-c">{c.count}</span>
              </Link>
            </li>
          ))}
        </ol>
        <Link to={path("/catalogo")} className="ep-index-all">
          Catálogo completo <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </aside>
    </section>
  );

  return (
    <main className="ep-page" ref={root}>
      <StoreSEO
        title={`${tenant.name} — materiais e catálogo online`}
        description={tenant.about_text || `Catálogo online de ${tenant.name}: busque por nome ou código e monte seu pedido.`}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      <div className="ep-wrap ep-hero-wrap">
        <HeroSlider
          slides={sf.hero_slides}
          autoplaySeconds={sf.hero_autoplay_seconds ?? 6}
          resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
          layout="split"
          className="ep-slider"
          fallback={fallback}
        />
      </div>

      <section className="ep-wrap ep-strip" aria-label="Diferenciais">
        <p>
          <Tags size={20} aria-hidden="true" /> Organizado por tipo de material
        </p>
        <p>
          <Search size={20} aria-hidden="true" /> Busca por nome ou código
        </p>
        <p>
          <MessageCircle size={20} aria-hidden="true" /> {tenant.whatsapp ? "Orçamento pelo WhatsApp" : "Pedido online simples"}
        </p>
      </section>

      {cats.length > 0 && (
        <section className="ep-wrap ep-section">
          <header className="ep-sec-h">
            <h2>{sf.home_categories_title || "Compre por tipo de material"}</h2>
            <Link to={path("/catalogo")}>
              Ver todos <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </header>
          <div className="ep-tiles">
            {cats.slice(0, 8).map((c, i) => (
              <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className="ep-tile">
                <span className="ep-tile-n">{String(i + 1).padStart(2, "0")}</span>
                <span className="ep-tile-t">
                  <b>{c.name}</b>
                  <small>
                    {c.count} {c.count === 1 ? "item" : "itens"}
                  </small>
                </span>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="ep-wrap ep-section">
        <header className="ep-sec-h">
          <h2>{sf.home_featured_title || "Materiais em destaque"}</h2>
          <Link to={path("/catalogo")}>
            Catálogo completo <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </header>
        {featured.length ? (
          <div className="ep-table">
            <div className="ep-table-head" aria-hidden="true">
              <span />
              <span>Código</span>
              <span>Material</span>
              <span>Preço</span>
              <span />
            </div>
            {featured.map((p) => (
              <ProductRow key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <p className="ep-empty">Em breve, novos materiais no catálogo.</p>
        )}
      </section>

      <section className="ep-wrap ep-section">
        <div className="ep-quote-box">
          <div>
            <p className="ep-eyebrow">Orçamento rápido</p>
            <h2>Cole sua lista de materiais</h2>
            <p>Escreva um item por linha, com quantidade. A loja responde com valores e disponibilidade.</p>
          </div>
          <div className="ep-quote-form">
            <label className="ep-sr" htmlFor="ep-list">
              Lista de materiais
            </label>
            <textarea id="ep-list" rows={5} value={list} onChange={(e) => setList(e.target.value)} placeholder={"10 m cabo flexível 2,5 mm\n3 disjuntores 20A\n..."} />
            {tenant.whatsapp ? (
              <StoreButton asChild size="md" className="ep-btn ep-btn-dark">
                <a href={quoteHref} target="_blank" rel="noreferrer">
                  <MessageCircle size={17} aria-hidden="true" /> Enviar pelo WhatsApp
                </a>
              </StoreButton>
            ) : (
              <StoreButton asChild size="md" className="ep-btn ep-btn-dark">
                <Link to={path(`/catalogo${list.trim() ? `?q=${encodeURIComponent(list.trim().split("\n")[0])}` : ""}`)}>Buscar no catálogo</Link>
              </StoreButton>
            )}
          </div>
        </div>
      </section>

      <section className="ep-wrap ep-section">
        <header className="ep-sec-h">
          <h2>Como comprar</h2>
        </header>
        <ol className="ep-steps">
          <li>
            <Search size={22} aria-hidden="true" />
            <b>1. Encontre</b>
            <span>Busque pelo nome, código ou navegue pelo tipo de material.</span>
          </li>
          <li>
            <ListChecks size={22} aria-hidden="true" />
            <b>2. Confira a especificação</b>
            <span>Escolha bitola, voltagem ou outras opções na ficha técnica.</span>
          </li>
          <li>
            <ShoppingCart size={22} aria-hidden="true" />
            <b>3. Monte o pedido</b>
            <span>Adicione ao carrinho e finalize pela loja.</span>
          </li>
        </ol>
      </section>
    </main>
  );
}
