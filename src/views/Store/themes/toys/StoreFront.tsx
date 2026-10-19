import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Gift, MessageCircle, Puzzle, ShoppingBag, Sparkles, Star } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStoreFx } from "../../../../components/store/fx";
import { productRouteSegment } from "../../store-routing";
import { productImage, useKit, whatsappLink } from "./kit";
import { ProductCard, Shapes } from "./parts";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, path, sf } = useKit();
  const featured = [...active.filter((p) => p.is_featured), ...active.filter((p) => !p.is_featured)].slice(0, tenant.featured_limit || 8);
  const hero = active.find((p) => p.is_featured) || active[0];
  const heroImage = tenant.banner_url || productImage(hero);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 8);
  const title = tenant.hero_tagline || "Brincar é a coisa mais séria do mundo!";
  const about = tenant.about_text || "Brinquedos escolhidos com carinho para imaginar, montar, descobrir e se divertir.";
  const pageRef = useRef<HTMLDivElement>(null);
  useStoreFx(pageRef, { style: "pop", intro: [".toys-hero-copy > *", ".toys-polaroid"], reveal: [".toys-tile", ".toys-card", ".toys-step", ".toys-head"] });
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const steps = [
    { icon: Puzzle, title: "Escolha", text: "Passeie pelas categorias e encontre o brinquedo ideal." },
    { icon: ShoppingBag, title: "Monte o pedido", text: "Selecione as opções, adicione à sacola e revise tudo." },
    { icon: Gift, title: "Combine a entrega", text: "Finalize e acerte entrega e pagamento com a loja." },
  ];

  return (
    <div ref={pageRef} className="toys-page toys-home">
      <StoreSEO
        title={`${tenant.name} | Brinquedos`}
        description={about}
        image={heroImage || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      <section className="toys-hero">
        <Shapes />
        <div className="toys-hero-copy">
          <span className="toys-pill">
            <Sparkles size={15} /> {sf.segment_label || "Mundo dos brinquedos"}
          </span>
          <h1>{title}</h1>
          <p>{about}</p>
          <div className="toys-actions">
            <Link className="toys-btn toys-btn-yellow toys-btn-lg" to={path("/catalogo")}>
              {sf.hero_button_label || "Ver os brinquedos"} <ArrowRight size={19} />
            </Link>
            {wa && (
              <a className="toys-btn toys-btn-white toys-btn-lg" href={wa} target="_blank" rel="noreferrer">
                <MessageCircle size={19} /> Falar com a loja
              </a>
            )}
          </div>
        </div>
        <div className="toys-hero-art">
          <div className="toys-polaroid">
            <div className="toys-polaroid-img">{heroImage ? <img src={heroImage} alt={hero?.name || tenant.name} /> : <Puzzle size={84} aria-label="Sem imagem" />}</div>
            {hero && (
              <Link className="toys-polaroid-cap" to={path(`/produto/${productRouteSegment(hero)}`)}>
                {hero.name}
              </Link>
            )}
          </div>
          <span className="toys-burst" aria-hidden="true">
            <Star size={26} fill="currentColor" />
          </span>
        </div>
      </section>

      {cats.length > 0 && (
        <section className="toys-section">
          <header className="toys-head">
            <span className="toys-pill toys-pill-pink">Categorias</span>
            <h2>{sf.home_categories_title || "Qual é a brincadeira de hoje?"}</h2>
          </header>
          <div className="toys-tiles">
            {cats.map((c, i) => {
              const sample = active.find((p) => p.category_id === c.id);
              const img = c.cover_url || productImage(sample);
              return (
                <Link key={c.id} className={`toys-tile toys-tint-${i % 4}`} to={path(`/catalogo?categoria=${c.id}`)}>
                  <span className="toys-tile-img">{img ? <img src={img} alt="" loading="lazy" /> : <Puzzle size={36} aria-hidden="true" />}</span>
                  <strong>{c.name}</strong>
                  <span className="toys-tile-go" aria-hidden="true">
                    <ArrowRight size={16} />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="toys-section">
        <header className="toys-head toys-head-row">
          <div>
            <span className="toys-pill toys-pill-mint">Destaques</span>
            <h2>{sf.home_featured_title || "Os queridinhos da turma"}</h2>
          </div>
          <Link className="toys-btn toys-btn-line" to={path("/catalogo")}>
            Ver todos <ArrowRight size={17} />
          </Link>
        </header>
        {featured.length ? (
          <div className="toys-grid">
            {featured.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        ) : (
          <p className="toys-note">Os brinquedos estão sendo preparados. Volte em breve!</p>
        )}
      </section>

      <section className="toys-section toys-steps-wrap">
        <header className="toys-head">
          <span className="toys-pill toys-pill-sky">Como funciona</span>
          <h2>É só chegar e brincar</h2>
        </header>
        <ol className="toys-steps">
          {steps.map(({ icon: Icon, title: t, text }, i) => (
            <li key={t} className={`toys-step toys-tint-${i % 4}`}>
              <span className="toys-step-n">{i + 1}</span>
              <Icon size={30} aria-hidden="true" />
              <h3>{t}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="toys-cta">
        <Shapes />
        <h2>Ficou com dúvida? A gente ajuda!</h2>
        <p>Converse com a loja e encontre o presente certo.</p>
        <div className="toys-actions toys-actions-center">
          {wa ? (
            <a className="toys-btn toys-btn-yellow toys-btn-lg" href={wa} target="_blank" rel="noreferrer">
              <MessageCircle size={19} /> Chamar no WhatsApp
            </a>
          ) : (
            <Link className="toys-btn toys-btn-yellow toys-btn-lg" to={path("/catalogo")}>
              Ver o catálogo <ArrowRight size={19} />
            </Link>
          )}
          <Link className="toys-btn toys-btn-white toys-btn-lg" to={path("/sobre")}>
            Conheça a loja
          </Link>
        </div>
      </section>
    </div>
  );
}
