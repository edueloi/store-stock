import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ListChecks, MessageCircle, Search, ShoppingCart, Tags } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { ProductRow } from "./parts";
import { useTheme, waLink } from "./lib";
import "./styles.css";

export default function StoreFront() {
  const { tenant, products, categories } = useStore();
  const { path } = useTheme();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
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

  const title = tenant.hero_tagline || "Tudo para sua instalação, no código certo.";
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    navigate(path(term ? `/catalogo?q=${encodeURIComponent(term)}` : "/catalogo"));
  };

  return (
    <main className="ep-page">
      <StoreSEO
        title={`${tenant.name} — materiais e catálogo online`}
        description={tenant.about_text || `Catálogo online de ${tenant.name}: busque por nome ou código e monte seu pedido.`}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      <section className="ep-hero">
        <div className="ep-hero-main" style={tenant.banner_url ? { backgroundImage: `linear-gradient(90deg,#111418 35%,rgba(17,20,24,.72)),url(${tenant.banner_url})` } : undefined}>
          <div className="ep-wrap-pad">
            <p className="ep-eyebrow">{tenant.name}</p>
            <h1>{title}</h1>
            <form onSubmit={submit} className="ep-quick" role="search">
              <label htmlFor="ep-quick-q">Pedido rápido</label>
              <div>
                <Search size={18} aria-hidden="true" />
                <input id="ep-quick-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome ou código do material" />
                <button type="submit">{sf.hero_button_label || "Buscar"}</button>
              </div>
            </form>
            {cats.length > 0 && (
              <div className="ep-hero-chips">
                {cats.slice(0, 5).map((c) => (
                  <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link>
                ))}
              </div>
            )}
          </div>
        </div>
        <aside className="ep-index" aria-label="Índice de materiais">
          <p className="ep-index-h">Índice de materiais</p>
          <ol>
            {cats.slice(0, 7).map((c, i) => (
              <li key={c.id}>
                <Link to={path(`/catalogo?cat=${c.id}`)}>
                  <span className="ep-index-n">{String(i + 1).padStart(2, "0")}</span>
                  <span className="ep-index-t">{c.name}</span>
                  <span className="ep-index-c">{c.count}</span>
                </Link>
              </li>
            ))}
          </ol>
          <Link to={path("/catalogo")} className="ep-index-all">Catálogo completo <ArrowRight size={16} aria-hidden="true" /></Link>
        </aside>
      </section>

      <section className="ep-strip">
        <div className="ep-wrap ep-strip-in">
          <p><Tags size={20} aria-hidden="true" /> Catálogo organizado por tipo de material</p>
          <p><Search size={20} aria-hidden="true" /> Busca por nome ou código</p>
          <p><MessageCircle size={20} aria-hidden="true" /> {tenant.whatsapp ? "Orçamento direto pelo WhatsApp" : "Pedido online simples"}</p>
        </div>
      </section>

      {cats.length > 0 && (
        <section className="ep-wrap ep-section">
          <header className="ep-sec-h">
            <h2>{sf.home_categories_title || "Compre por tipo de material"}</h2>
            <Link to={path("/catalogo")}>Ver todos <ArrowRight size={15} aria-hidden="true" /></Link>
          </header>
          <div className="ep-tiles">
            {cats.slice(0, 8).map((c) => (
              <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className="ep-tile">
                <span>{c.name}</span>
                <small>{c.count} {c.count === 1 ? "item" : "itens"}</small>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="ep-wrap ep-section">
        <header className="ep-sec-h">
          <h2>{sf.home_featured_title || "Materiais em destaque"}</h2>
          <Link to={path("/catalogo")}>Catálogo completo <ArrowRight size={15} aria-hidden="true" /></Link>
        </header>
        {featured.length ? (
          <div className="ep-table">
            <div className="ep-table-head" aria-hidden="true">
              <span /><span>Código</span><span>Material</span><span>Preço</span><span />
            </div>
            {featured.map((p) => <ProductRow key={p.id} product={p} />)}
          </div>
        ) : (
          <p className="ep-empty">Em breve, novos materiais no catálogo.</p>
        )}
      </section>

      <section className="ep-wrap ep-section">
        <header className="ep-sec-h"><h2>Como comprar</h2></header>
        <ol className="ep-steps">
          <li><Search size={22} aria-hidden="true" /><b>1. Encontre</b><span>Busque pelo nome, código ou navegue pelo tipo de material.</span></li>
          <li><ListChecks size={22} aria-hidden="true" /><b>2. Confira a especificação</b><span>Escolha bitola, voltagem ou outras opções na ficha técnica.</span></li>
          <li><ShoppingCart size={22} aria-hidden="true" /><b>3. Monte o pedido</b><span>Adicione ao carrinho e finalize pela loja.</span></li>
        </ol>
      </section>

      <section className="ep-cta">
        <div className="ep-hazard" aria-hidden="true" />
        <div className="ep-wrap ep-cta-in">
          <h2>Não achou o material?</h2>
          <p>Fale com a loja e peça um orçamento com a lista do que precisa.</p>
          {tenant.whatsapp ? (
            <a className="ep-btn ep-btn-lg" href={waLink(tenant, "Olá! Preciso de um orçamento de materiais.")} target="_blank" rel="noreferrer">
              <MessageCircle size={18} aria-hidden="true" /> Pedir orçamento
            </a>
          ) : (
            <Link className="ep-btn ep-btn-lg" to={path("/sobre")}>Falar com a loja</Link>
          )}
        </div>
      </section>
    </main>
  );
}
