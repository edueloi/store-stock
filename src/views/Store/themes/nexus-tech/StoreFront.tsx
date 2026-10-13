import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, MessageCircle, Package } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { productRouteSegment } from "../../store-routing";
import { Card, PERKS, Price } from "./parts";
import { imageOf, useTheme, waLink } from "./lib";
import "./styles.css";

export default function StoreFront() {
  const { tenant, products, categories } = useStore();
  const { path } = useTheme();
  const sf = tenant.policies?.storefront || {};

  const active = useMemo(() => products.filter((p) => p.is_active && p.type !== "internal"), [products]);
  const featured = useMemo(() => {
    const f = active.filter((p) => p.is_featured);
    return f.length ? f : active;
  }, [active]);
  const hero = featured.find((p) => imageOf(p)) || featured[0];
  const showcase = featured.filter((p) => p.id !== hero?.id).slice(0, 6);
  const cats = useMemo(
    () =>
      categories
        .map((c) => ({ ...c, items: active.filter((p) => p.category_id === c.id) }))
        .filter((c) => c.items.length > 0),
    [categories, active],
  );
  const rows = cats.slice(0, 2);
  const title = tenant.hero_tagline || "Tecnologia que combina com o seu ritmo.";

  return (
    <main className="nx-page">
      <StoreSEO
        title={`${tenant.name} — tecnologia e catálogo online`}
        description={tenant.about_text || `Conheça o catálogo de ${tenant.name}: produtos selecionados, atendimento próximo e compra segura.`}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      <section className="nx-hero">
        <div className="nx-hero-glow" aria-hidden="true" />
        <div className="nx-wrap nx-hero-in">
          <div className="nx-hero-copy">
            <p className="nx-kicker">{tenant.name}</p>
            <h1>{title}</h1>
            <p className="nx-hero-sub">{tenant.about_text ? tenant.about_text.slice(0, 160) : "Uma seleção cuidadosa de produtos, com atendimento próximo do primeiro clique à entrega."}</p>
            <div className="nx-hero-cta">
              <Link to={path("/catalogo")} className="nx-btn nx-btn-gold nx-btn-lg">
                {sf.hero_button_label || "Ver catálogo"} <ArrowRight size={18} aria-hidden="true" />
              </Link>
              {tenant.whatsapp && (
                <a href={waLink(tenant, "Olá! Gostaria de atendimento.")} target="_blank" rel="noreferrer" className="nx-btn nx-btn-outline nx-btn-lg">
                  <MessageCircle size={18} aria-hidden="true" /> Falar com a loja
                </a>
              )}
            </div>
          </div>
          <div className="nx-hero-stage">
            {hero ? (
              <Link to={path(`/produto/${productRouteSegment(hero)}`)} className="nx-feature">
                <span className="nx-feature-tag">Em destaque</span>
                <div className="nx-feature-img">
                  {imageOf(hero) ? <img src={imageOf(hero)} alt={hero.name} /> : <Package size={64} aria-hidden="true" />}
                </div>
                <div className="nx-feature-info">
                  <b>{hero.name}</b>
                  <Price product={hero} />
                  <span className="nx-feature-go">Ver detalhes <ArrowUpRight size={16} aria-hidden="true" /></span>
                </div>
              </Link>
            ) : tenant.banner_url ? (
              <img className="nx-hero-banner" src={tenant.banner_url} alt="" />
            ) : null}
          </div>
        </div>
      </section>

      <section className="nx-wrap nx-perks" aria-label="Diferenciais">
        {PERKS.map(({ icon: Icon, title: t, text }) => (
          <div key={t} className="nx-perk">
            <span className="nx-perk-ico"><Icon size={22} aria-hidden="true" /></span>
            <div>
              <h3>{t}</h3>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </section>

      {cats.length > 0 && (
        <section className="nx-wrap nx-sec">
          <header className="nx-sec-h">
            <p className="nx-kicker nx-kicker-dark">Departamentos</p>
            <h2>{sf.home_categories_title || "Explore por categoria"}</h2>
          </header>
          <div className="nx-chips">
            {cats.slice(0, 8).map((c) => (
              <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>
                {c.name} <small>{c.items.length}</small>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="nx-wrap nx-sec">
        <header className="nx-sec-h nx-sec-h-row">
          <div>
            <p className="nx-kicker nx-kicker-dark">Vitrine</p>
            <h2>{sf.home_featured_title || "Seleção em destaque"}</h2>
          </div>
          <Link to={path("/catalogo")} className="nx-link">Ver tudo <ArrowRight size={16} aria-hidden="true" /></Link>
        </header>
        {showcase.length || hero ? (
          <div className="nx-grid">
            {(showcase.length ? showcase : hero ? [hero] : []).map((p) => <Card key={p.id} product={p} />)}
          </div>
        ) : (
          <p className="nx-empty">Em breve, novos produtos na vitrine.</p>
        )}
      </section>

      {rows.map((c) => (
        <section key={c.id} className="nx-wrap nx-sec nx-row-sec">
          <header className="nx-sec-h nx-sec-h-row">
            <div>
              <p className="nx-kicker nx-kicker-dark">Categoria</p>
              <h2>{c.name}</h2>
            </div>
            <Link to={path(`/catalogo?cat=${c.id}`)} className="nx-link">Ver categoria <ArrowRight size={16} aria-hidden="true" /></Link>
          </header>
          <div className="nx-grid">
            {c.items.slice(0, 3).map((p) => <Card key={p.id} product={p} />)}
          </div>
        </section>
      ))}

      <section className="nx-wrap nx-banner">
        <div>
          <p className="nx-kicker">Atendimento</p>
          <h2>Precisa de ajuda para escolher?</h2>
          <p>Nossa equipe orienta você a encontrar o produto certo.</p>
        </div>
        {tenant.whatsapp ? (
          <a className="nx-btn nx-btn-gold nx-btn-lg" href={waLink(tenant, "Olá! Preciso de ajuda para escolher um produto.")} target="_blank" rel="noreferrer">
            <MessageCircle size={18} aria-hidden="true" /> Chamar no WhatsApp
          </a>
        ) : (
          <Link className="nx-btn nx-btn-gold nx-btn-lg" to={path("/sobre")}>Conheça a loja</Link>
        )}
      </section>
    </main>
  );
}
