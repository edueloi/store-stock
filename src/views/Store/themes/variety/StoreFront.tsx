import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle, PackageCheck, Sparkles, Store } from "lucide-react";
import HeroSlider from "../../../../components/store/HeroSlider";
import StoreSEO from "../../../../components/store/StoreSEO";
import { StoreButton } from "../../../../components/store/StoreButton";
import { productRouteSegment } from "../../store-routing";
import { HeroCascade, Marquee, SnapStrip } from "./Motion";
import { VarietyProductCard, varietyImage, useVariety } from "./ThemeParts";
import "./styles.css";

const BENEFITS = [
  { icon: PackageCheck, title: "Pedido online", text: "Monte o pedido e a loja confirma com você." },
  { icon: Store, title: "Catálogo atualizado", text: "Produtos e estoque sempre em dia." },
  { icon: MessageCircle, title: "Atendimento rápido", text: "Tire dúvidas direto pelo WhatsApp." },
];

export default function StoreFront() {
  const { tenant, active, usedCategories, path, sf, whatsapp } = useVariety();
  const featuredAll = active.filter((p) => p.is_featured);
  const featured = (featuredAll.length ? featuredAll : active).slice(0, tenant.featured_limit || 8);
  const showcase = featured.slice(0, 2);
  const sections = usedCategories.slice(0, 3).map((c) => ({ c, items: active.filter((p) => p.category_id === c.id) }));
  const heroImage = tenant.banner_url || varietyImage(featured[0]);

  return (
    <main className="variety-page">
      <StoreSEO
        title={`${tenant.name} | Variedades`}
        description={tenant.about_text || `Tudo o que você procura, em um só lugar: ${tenant.name}.`}
        image={heroImage || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
        keywords={`${tenant.name}, variedades, utilidades, presentes, ofertas`}
      />

      <div className="variety-wrap variety-hero-wrap">
        <HeroSlider
          slides={sf.hero_slides}
          autoplaySeconds={sf.hero_autoplay_seconds ?? 6}
          resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
          layout="banner"
          className="variety-slider"
          fallback={
            <HeroCascade className="variety-hero">
              <div className="variety-hero-main">
                <span className="variety-kicker"><Sparkles size={14} /> {sf.segment_label || tenant.name}</span>
                <h1>{tenant.hero_tagline || "Tudo o que você precisa, perto de você."}</h1>
                <p>{tenant.about_text || "Utilidades, presentes e achados para facilitar sua rotina."}</p>
                <div className="variety-hero-actions">
                  <StoreButton asChild className="variety-btn-yellow">
                    <Link to={path("/catalogo")}>{sf.hero_button_label || "Ver produtos"} <ArrowRight size={16} /></Link>
                  </StoreButton>
                  {whatsapp && (
                    <StoreButton asChild variant="ghost" className="variety-btn-ghost">
                      <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Atendimento</a>
                    </StoreButton>
                  )}
                </div>
              </div>
              {showcase.map((p, i) => (
                <Link key={p.id} to={path(`/produto/${productRouteSegment(p)}`)} className={`variety-hero-tile variety-hero-tile-${i}`}>
                  <span className="variety-hero-tile-img">
                    {varietyImage(p) ? <img src={varietyImage(p)!} alt="" loading="lazy" /> : <Store size={36} aria-hidden="true" />}
                  </span>
                  <strong>{p.name}</strong>
                </Link>
              ))}
            </HeroCascade>
          }
        />
      </div>

      <div className="variety-wrap">
        <Marquee items={["Compra simples e segura", "Pedido direto com a loja", "Ofertas toda semana", "Atendimento pelo WhatsApp"]} />
      </div>

      <div className="variety-wrap variety-benefits">
        {BENEFITS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="variety-benefit">
            <span><Icon size={20} aria-hidden="true" /></span>
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </div>

      {usedCategories.length > 0 && (
        <section className="variety-wrap variety-block" aria-labelledby="variety-cats">
          <div className="variety-panel">
            <header className="variety-head">
              <div>
                <span className="variety-eyebrow">Compre por seção</span>
                <h2 id="variety-cats">{sf.home_categories_title || "Tudo organizado para você"}</h2>
              </div>
              <Link to={path("/catalogo")} className="variety-link">Ver catálogo <ArrowRight size={15} /></Link>
            </header>
            <SnapStrip label="Seções">
              {usedCategories.map((c, i) => {
                const sample = active.find((p) => p.category_id === c.id);
                const img = c.cover_url || varietyImage(sample);
                return (
                  <Link key={c.id} role="listitem" to={path(`/catalogo?cat=${c.id}`)} className={`variety-cat variety-c${i % 6}`}>
                    <span className="variety-cat-img">{img ? <img src={img} alt="" loading="lazy" /> : <Store size={30} aria-hidden="true" />}</span>
                    <strong>{c.name}</strong>
                  </Link>
                );
              })}
            </SnapStrip>
          </div>
        </section>
      )}

      <section className="variety-wrap variety-block" aria-labelledby="variety-feat">
        <header className="variety-head">
          <div>
            <span className="variety-eyebrow variety-eyebrow-red">Destaques</span>
            <h2 id="variety-feat">{sf.home_featured_title || "Achados da loja"}</h2>
          </div>
          <Link to={path("/catalogo")} className="variety-link">Ver todos <ArrowRight size={15} /></Link>
        </header>
        {featured.length ? (
          <div className="variety-grid">
            {featured.map((p) => <VarietyProductCard key={p.id} product={p} />)}
          </div>
        ) : (
          <p className="variety-note">Os produtos estão sendo cadastrados. Volte em breve!</p>
        )}
      </section>

      {sections.map(({ c, items }, i) => (
        <section key={c.id} className="variety-wrap variety-block">
          <div className={`variety-panel variety-shelf variety-c${(i + 1) % 6}`}>
            <header className="variety-head">
              <h2>{c.name}</h2>
              <Link to={path(`/catalogo?cat=${c.id}`)} className="variety-link">Ver tudo <ArrowRight size={15} /></Link>
            </header>
            <div className="variety-grid variety-grid-4">
              {items.slice(0, 4).map((p) => <VarietyProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      ))}
    </main>
  );
}
