import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, CreditCard, Headphones, ShieldCheck, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import Card from "./Card";
import { categoryImage, discountPct, hasDiscount, money, priceOf, productImage, shorten, useBestsellers, useHero, useKit, useUsedCategories } from "./kit";
import "./styles.css";

export default function StoreFront() {
  const { tenant, active, path, sf, hidden, productPath } = useKit();
  const cats = useUsedCategories();
  const hero = useHero();
  const best = useBestsellers();

  const featured = active.filter((p) => p.is_featured);
  const showcase = (featured.length ? featured : active).slice(0, tenant.featured_limit || 8);
  const offers = active.filter((p) => hasDiscount(p)).sort((a, b) => discountPct(b) - discountPct(a)).slice(0, 4);
  const fresh = [...active].sort((a, b) => b.id - a.id).slice(0, 4);

  const pool = (featured.length ? featured : active).filter((p) => productImage(p));
  const lead = pool[0];
  const side = pool.slice(1, 3);
  const heroImage = tenant.banner_url || (lead ? productImage(lead) : "");
  const tagline = (tenant.hero_tagline || "").trim();
  const shortTag = tagline && tagline.length <= 64;
  const title = shortTag ? tagline : tenant.name;
  const text = shorten(shortTag ? tenant.about_text || "" : tagline || tenant.about_text || "", 200) || "Tecnologia selecionada, com atendimento próximo e compra simples.";

  const fallback = (
    <section className="gd-hero">
      <div className="gd-hero-main">
        <div className="gd-hero-copy">
          <span className="gd-kicker">{shortTag ? tenant.name : "Tecnologia & eletrônicos"}</span>
          <h1>{title}</h1>
          <p>{text}</p>
          <div className="gd-hero-actions">
            <Link className="gd-btn gd-btn-accent" to={path("/catalogo")}>
              {sf.hero_button_label || "Ver catálogo"} <ArrowRight size={15} />
            </Link>
            {offers.length > 0 && (
              <Link className="gd-btn gd-btn-ghost" to={path("/catalogo?sort=menor")}>
                Ver ofertas
              </Link>
            )}
          </div>
        </div>
        {heroImage && (
          <div className="gd-hero-art">
            <img src={heroImage} alt={lead?.name || tenant.name} />
          </div>
        )}
      </div>
      {side.length > 0 && (
        <div className="gd-hero-side">
          {side.map((p) => (
            <Link key={p.id} to={productPath(p)} className="gd-hero-tile">
              <span className="gd-kicker">{p.is_featured ? "Destaque" : "Novidade"}</span>
              <strong>{p.name}</strong>
              {!hidden && <em>{money(priceOf(p))}</em>}
              <img src={productImage(p)} alt="" loading="lazy" />
              <ArrowUpRight size={16} className="gd-tile-go" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <main className="gd-page">
      <StoreSEO
        title={tenant.name}
        description={tenant.hero_tagline || tenant.about_text || `Catálogo de ${tenant.name}`}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      <div className="gd-wrap gd-hero-wrap" data-no-fx>
        <HeroSlider slides={hero.slides} autoplaySeconds={hero.autoplay} resolveUrl={hero.resolveUrl} layout="banner" className="gd-slider" fallback={fallback} />
      </div>

      <div className="gd-wrap">
        <div className="gd-perks">
          <div><Truck size={18} strokeWidth={1.5} /><span>Entrega combinada<small>Receba em casa ou retire na loja</small></span></div>
          <div><CreditCard size={18} strokeWidth={1.5} /><span>Pagamento facilitado<small>Escolha a forma que preferir</small></span></div>
          <div><ShieldCheck size={18} strokeWidth={1.5} /><span>Compra segura<small>Produtos conferidos pela loja</small></span></div>
          <div><Headphones size={18} strokeWidth={1.5} /><span>Suporte humano<small>Dúvidas resolvidas no WhatsApp</small></span></div>
        </div>
      </div>

      {cats.length > 0 && (
        <section className="gd-wrap gd-section" aria-labelledby="gd-cats-title">
          <header className="gd-sec-head">
            <div>
              <span className="gd-kicker">Explore</span>
              <h2 id="gd-cats-title">{sf.home_categories_title || "Compre por categoria"}</h2>
            </div>
            <Link to={path("/catalogo")}>Ver tudo <ArrowRight size={14} /></Link>
          </header>
          <ul className="gd-cats">
            {cats.slice(0, 8).map((c) => {
              const img = categoryImage(c, active);
              return (
                <li key={c.id}>
                  <Link to={path(`/catalogo?categoria=${c.id}`)}>
                    <span className="gd-cat-thumb">{img ? <img src={img} alt="" loading="lazy" /> : null}</span>
                    <span className="gd-cat-name">{c.name}</span>
                    <small>{c.count} {c.count === 1 ? "item" : "itens"}</small>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="gd-wrap gd-section">
        <header className="gd-sec-head">
          <div>
            <span className="gd-kicker">Seleção da loja</span>
            <h2>{sf.home_featured_title || "Em destaque"}</h2>
          </div>
          <Link to={path("/catalogo")}>Ver todos <ArrowRight size={14} /></Link>
        </header>
        {showcase.length ? (
          <div className="gd-grid">
            {showcase.map((p) => (
              <Card key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <p className="gd-muted gd-empty">Nenhum produto disponível no momento.</p>
        )}
      </section>

      {best.items.length > 0 && (
        <section className="gd-wrap gd-section" aria-labelledby="gd-best-title">
          <header className="gd-sec-head">
            <div>
              <span className="gd-kicker">Preferidos dos clientes</span>
              <h2 id="gd-best-title">Mais vendidos</h2>
            </div>
            <Link to={path("/catalogo")}>Ver todos <ArrowRight size={14} /></Link>
          </header>
          <div className="gd-rail">
            {best.items.map((p, i) => (
              <div key={p.id} className="gd-rail-item">
                <Card product={p} rank={i + 1} />
              </div>
            ))}
          </div>
        </section>
      )}

      {offers.length > 0 && (
        <section className="gd-wrap gd-section">
          <div className="gd-promo">
            <div className="gd-promo-copy">
              <span className="gd-kicker">Ofertas</span>
              <h2>Preços que valem a pena</h2>
              <p>Até {discountPct(offers[0])}% de desconto em itens selecionados. Por tempo limitado, enquanto durar o estoque.</p>
              <Link className="gd-btn gd-btn-accent" to={path("/catalogo")}>
                Aproveitar <ArrowRight size={15} />
              </Link>
            </div>
            <div className="gd-promo-grid">
              {offers.map((p) => (
                <Card key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {fresh.length > 0 && active.length > 4 && (
        <section className="gd-wrap gd-section">
          <header className="gd-sec-head">
            <div>
              <span className="gd-kicker">Acabou de chegar</span>
              <h2>Novidades</h2>
            </div>
            <Link to={path("/catalogo")}>Ver catálogo <ArrowRight size={14} /></Link>
          </header>
          <div className="gd-grid">
            {fresh.map((p) => (
              <Card key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {tenant.whatsapp && (
        <section className="gd-wrap gd-section">
          <div className="gd-cta">
            <div>
              <h2>Não sabe qual escolher?</h2>
              <p>Fale com a gente. Ajudamos a comparar modelos e a encontrar o que combina com o seu uso.</p>
            </div>
            <Link className="gd-btn gd-btn-light" to={path("/sobre")}>
              Falar com a loja <ArrowRight size={15} />
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
