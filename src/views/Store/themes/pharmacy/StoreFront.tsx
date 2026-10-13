import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, ClipboardList, MessageCircle, PackageCheck, Search } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { pageUrl, productImage, useShop, whatsappLink } from "./core";
import { CatIcon, Cross, ProductCard, T } from "./parts";

export default function StoreFront() {
  const { tenant, categories, active, config, path } = useShop();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const featured = active.filter((p) => p.is_featured);
  const shelf = (featured.length ? featured : active).slice(0, 8);
  const counts = new Map<number, number>();
  active.forEach((p) => p.category_id && counts.set(p.category_id, (counts.get(p.category_id) || 0) + 1));
  const cats = categories.filter((c) => counts.get(c.id));
  const hero = productImage(shelf[0]);
  const title = tenant.hero_tagline || T.hero;

  return (
    <div className="ph ph-page">
      <StoreSEO title={`${tenant.name} | ${config.segment_label || T.tag}`} description={tenant.about_text || T.sub} image={tenant.banner_url} siteName={tenant.name} url={pageUrl()} />

      <section className="ph-hero">
        <div className="ph-wrap ph-hero-grid">
          <div className="ph-hero-copy">
            <span className="ph-kicker"><Cross size={14} /> {config.segment_label || T.tag}</span>
            <h1>{title}</h1>
            <p>{T.sub}</p>
            <form
              className="ph-hero-search"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(path(q.trim() ? `/catalogo?q=${encodeURIComponent(q.trim())}` : "/catalogo"));
              }}
            >
              <label className="ph-sr" htmlFor="ph-hero-q">Buscar produto</label>
              <input id="ph-hero-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="O que você procura hoje?" />
              <button type="submit" className="ph-btn"><Search size={18} aria-hidden="true" /> {config.hero_button_label || "Buscar"}</button>
            </form>
            {cats.length > 0 && (
              <div className="ph-chips" aria-label="Atalhos">
                {cats.slice(0, 5).map((c) => (
                  <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className="ph-chip">{c.name}</Link>
                ))}
              </div>
            )}
          </div>
          <aside className="ph-hero-panel" aria-label="Como funciona">
            <div className="ph-hero-art" aria-hidden="true">
              {tenant.banner_url || hero ? <img src={tenant.banner_url || hero} alt="" /> : <Cross size={120} />}
            </div>
            <ul>
              <li><Check size={18} aria-hidden="true" /> Escolha no catálogo, sem sair de casa</li>
              <li><Check size={18} aria-hidden="true" /> Retire seu pedido na loja</li>
              {tenant.whatsapp && <li><Check size={18} aria-hidden="true" /> Dúvidas? Fale com a equipe</li>}
            </ul>
          </aside>
        </div>
      </section>

      {cats.length > 0 && (
        <section className="ph-section">
          <div className="ph-wrap">
            <h2 className="ph-title">{config.home_categories_title || T.categories}</h2>
            <div className="ph-cats">
              {cats.map((c, i) => (
                <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className="ph-cat">
                  <CatIcon index={i} />
                  <b>{c.name}</b>
                  <small>{counts.get(c.id)} {counts.get(c.id) === 1 ? "produto" : "produtos"}</small>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="ph-section ph-section-tint">
        <div className="ph-wrap">
          <div className="ph-head">
            <h2 className="ph-title">{config.home_featured_title || T.featured}</h2>
            <Link to={path("/catalogo")} className="ph-more">Ver tudo <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
          {shelf.length ? (
            <div className="ph-grid">{shelf.map((p) => <ProductCard key={p.id} product={p} />)}</div>
          ) : (
            <p className="ph-empty">Em breve, novos produtos por aqui.</p>
          )}
        </div>
      </section>

      <section className="ph-section">
        <div className="ph-wrap">
          <h2 className="ph-title">Como comprar</h2>
          <ol className="ph-steps">
            <li><span><Search size={22} aria-hidden="true" /></span><b>1. Encontre</b><p>Busque pelo nome ou navegue pelos departamentos.</p></li>
            <li><span><ClipboardList size={22} aria-hidden="true" /></span><b>2. Monte seu pedido</b><p>Escolha as opções e adicione ao carrinho.</p></li>
            <li><span><PackageCheck size={22} aria-hidden="true" /></span><b>3. Retire na loja</b><p>Combine a retirada e finalize o atendimento.</p></li>
          </ol>
        </div>
      </section>

      {tenant.whatsapp && (
        <section className="ph-wrap ph-help">
          <div>
            <h2>Precisa de ajuda para escolher?</h2>
            <p>Nossa equipe responde pelo WhatsApp.</p>
          </div>
          <a className="ph-btn ph-btn-light" href={whatsappLink(tenant, "Olá! Preciso de ajuda com um produto.")} target="_blank" rel="noreferrer">
            <MessageCircle size={18} aria-hidden="true" /> Falar com a loja
          </a>
        </section>
      )}
    </div>
  );
}
