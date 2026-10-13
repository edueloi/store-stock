import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { productImage, useKit, whatsappLink } from "./kit";
import { Balloon, Bow, Cloud, GiftCard, Star, tintOf } from "./parts";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, path, sf } = useKit();
  const featuredAll = active.filter((p) => p.is_featured);
  const featured = (featuredAll.length ? featuredAll : active).slice(0, 8);
  const cats = categories
    .map((c) => ({ c, items: active.filter((p) => p.category_id === c.id) }))
    .filter((x) => x.items.length)
    .slice(0, 8);
  const wa = whatsappLink(tenant.whatsapp);
  const title = tenant.hero_tagline || "Para os primeiros grandes momentos.";

  return (
    <main className="bb-root">
      <StoreSEO
        title={`${tenant.name} — ${sf.segment_label || "bebês e enxoval"}`}
        description={tenant.about_text || "Enxoval, presentes e cuidado em cada detalhe da infância."}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      <section className="bb-hero">
        <Cloud className="bb-deco bb-deco-cloud1" />
        <Cloud className="bb-deco bb-deco-cloud2" />
        <Star className="bb-deco bb-deco-star1" />
        <Star className="bb-deco bb-deco-star2" />
        <Balloon className="bb-deco bb-deco-balloon" color="var(--bb-accent)" />
        <div className="bb-hero-text">
          <p className="bb-kicker">{sf.segment_label || "Bebês & Enxoval"}</p>
          <h1 className="bb-script">{title}</h1>
          <p className="bb-lead">{tenant.about_text ? tenant.about_text.slice(0, 160) : "Enxoval, presentes e cuidado em cada detalhe da infância."}</p>
          <div className="bb-hero-actions">
            <Link to={path("/catalogo")} className="bb-btn bb-btn-main">
              {sf.hero_button_label || "Ver os mimos"} <ArrowRight size={18} />
            </Link>
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" className="bb-btn bb-btn-ghost">
                <MessageCircle size={18} /> Falar com a loja
              </a>
            )}
          </div>
        </div>
        <div className="bb-hero-art">
          <div className="bb-hero-blob">
            {tenant.banner_url ? <img src={tenant.banner_url} alt="" /> : productImage(featured[0]) ? <img src={productImage(featured[0])} alt="" /> : <Cloud className="bb-hero-fallback" />}
          </div>
          <span className="bb-hero-bow" aria-hidden="true">
            <Bow />
          </span>
        </div>
      </section>

      {cats.length > 0 && (
        <section className="bb-section">
          <header className="bb-head">
            <h2 className="bb-script">{sf.home_categories_title || "Cada fase, um carinho"}</h2>
            <p>Escolha uma faixa ou ocasião e passeie pelos mimos.</p>
          </header>
          <div className="bb-bubbles">
            {cats.map(({ c, items }, i) => {
              const img = productImage(items[0]);
              return (
                <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className={`bb-bubble ${tintOf(i)} bb-bubble-${(i % 3) + 1}`}>
                  <span className="bb-bubble-photo">{img ? <img src={img} alt="" loading="lazy" /> : <Star className="bb-bubble-star" />}</span>
                  <span className="bb-bubble-name">{c.name}</span>
                  <span className="bb-bubble-count">
                    {items.length} {items.length === 1 ? "item" : "itens"}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="bb-section bb-section-tint">
        <header className="bb-head">
          <h2 className="bb-script">{sf.home_featured_title || "Detalhes que acolhem"}</h2>
          <p>Mimos escolhidos com carinho para presentear.</p>
        </header>
        {featured.length ? (
          <div className="bb-grid">
            {featured.map((p, i) => (
              <GiftCard key={p.id} product={p} index={i} />
            ))}
          </div>
        ) : (
          <div className="bb-empty">
            <Cloud className="bb-empty-cloud" />
            <p>Ainda estamos arrumando as prateleiras. Volte em breve!</p>
          </div>
        )}
        {active.length > featured.length && (
          <div className="bb-center">
            <Link to={path("/catalogo")} className="bb-btn bb-btn-main">
              Ver todos os produtos <ArrowRight size={18} />
            </Link>
          </div>
        )}
      </section>

      <section className="bb-letter-band">
        <div className="bb-letter">
          <Bow className="bb-letter-bow" />
          <p className="bb-kicker">Uma cartinha da loja</p>
          <h2 className="bb-script">{sf.about_title || `Bem-vindos à ${tenant.name}`}</h2>
          <p>{tenant.about_text || "Cada detalhe é pensado para acolher as famílias nos primeiros e mais especiais momentos."}</p>
          <Link to={path("/sobre")} className="bb-btn bb-btn-soft">
            Conheça nossa história
          </Link>
        </div>
      </section>
    </main>
  );
}
