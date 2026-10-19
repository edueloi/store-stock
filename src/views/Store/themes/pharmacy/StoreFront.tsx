import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, MessageCircle, PackageCheck, Search, Tag, ClipboardList } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { StoreButton } from "../../../../components/store/StoreButton";
import { pageUrl, useShop, whatsappLink } from "./core";
import { CatIcon, Cross, ProductCard, T } from "./parts";

export default function StoreFront() {
  const { tenant, categories, active, config, path } = useShop();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const featured = active.filter((p) => p.is_featured);
  const shelf = (featured.length ? featured : active).slice(0, 8);
  const offers = active
    .filter((p) => p.discount_price != null && Number(p.discount_price) < Number(p.price))
    .slice(0, 10);
  const counts = new Map<number, number>();
  active.forEach((p) => p.category_id && counts.set(p.category_id, (counts.get(p.category_id) || 0) + 1));
  const cats = categories.filter((c) => counts.get(c.id));
  const title = tenant.hero_tagline || T.hero;

  const defaultHero = (
    <section className="ph-hero">
      <div className="ph-wrap">
        <div className="ph-hero-card">
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
            <Search size={22} aria-hidden="true" />
            <label className="ph-sr" htmlFor="ph-hero-q">Buscar produto</label>
            <input id="ph-hero-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="O que você procura hoje?" />
            <StoreButton type="submit" size="md" className="ph-hero-go">{config.hero_button_label || "Buscar"}</StoreButton>
          </form>
          {cats.length > 0 && (
            <div className="ph-chips" aria-label="Buscas rápidas">
              <span>Buscas rápidas:</span>
              {cats.slice(0, 5).map((c) => (
                <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className="ph-chip">{c.name}</Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );

  return (
    <div className="ph ph-page">
      <StoreSEO title={`${tenant.name} | ${config.segment_label || T.tag}`} description={tenant.about_text || T.sub} image={tenant.banner_url} siteName={tenant.name} url={pageUrl()} />

      <HeroSlider
        slides={config.hero_slides}
        autoplaySeconds={config.hero_autoplay_seconds ?? 6}
        resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
        layout="banner"
        className="ph-slider"
        fallback={defaultHero}
      />

      {config.hero_slides?.some((s) => s.image) && (
        <div className="ph-wrap ph-quick">
          <form
            className="ph-hero-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(path(q.trim() ? `/catalogo?q=${encodeURIComponent(q.trim())}` : "/catalogo"));
            }}
          >
            <Search size={22} aria-hidden="true" />
            <label className="ph-sr" htmlFor="ph-quick-q">Buscar produto</label>
            <input id="ph-quick-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="O que você procura hoje?" />
            <StoreButton type="submit" size="md" className="ph-hero-go">Buscar</StoreButton>
          </form>
        </div>
      )}

      {cats.length > 0 && (
        <section className="ph-section">
          <div className="ph-wrap">
            <h2 className="ph-title">{config.home_categories_title || "Departamentos"}</h2>
            <div className="ph-cats">
              {cats.map((c, i) => (
                <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className="ph-cat">
                  {c.cover_url ? <img className="ph-cat-img" src={c.cover_url} alt="" loading="lazy" /> : <CatIcon index={i} />}
                  <b>{c.name}</b>
                  <small>{counts.get(c.id)} {counts.get(c.id) === 1 ? "produto" : "produtos"}</small>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {offers.length > 0 && (
        <section className="ph-section ph-offers">
          <div className="ph-wrap">
            <div className="ph-head">
              <h2 className="ph-title"><Tag size={22} aria-hidden="true" /> Ofertas da semana</h2>
              <Link to={path("/catalogo")} className="ph-more">Ver todas <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
            <div className="ph-strip" data-no-fx>
              {offers.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      <section className="ph-section">
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
          <StoreButton asChild variant="outline" size="md" className="ph-help-btn">
            <a href={whatsappLink(tenant, "Olá! Preciso de ajuda com um produto.")} target="_blank" rel="noreferrer">
              <MessageCircle size={18} aria-hidden="true" /> Falar com a loja
            </a>
          </StoreButton>
        </section>
      )}
    </div>
  );
}
