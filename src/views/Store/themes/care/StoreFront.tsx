import { Link } from "react-router-dom";
import { ArrowRight, HeartHandshake, Leaf, MessageCircle, Search, ShieldCheck, Sparkles, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { StoreButton } from "../../../../components/store/StoreButton";
import { pageUrl, productImage, useShop, whatsappLink } from "./core";
import { Blob, categoryIcon, ProductCard, Rail, T } from "./parts";

export default function StoreFront() {
  const { tenant, categories, active, config, path } = useShop();
  const featured = active.filter((p) => p.is_featured);
  const shelf = (featured.length ? featured : active).slice(0, 12);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id));
  const art = tenant.banner_url || productImage(shelf[0]);
  const steps = [
    { icon: <Search size={26} />, title: "Escolha com calma", text: "Navegue por cuidados e encontre o que combina com a sua rotina." },
    { icon: <HeartHandshake size={26} />, title: "Fale com a gente", text: tenant.whatsapp ? "Tire dúvidas direto com a equipe, sem pressa." : "Estamos por perto para ajudar no que precisar." },
    { icon: <ShieldCheck size={26} />, title: "Receba com segurança", text: "Pedido conferido e embalado com todo o cuidado." },
  ];
  const fallback = (
    <section className="ca-hero">
      <div className="ca-hero-copy">
        <span className="ca-eyebrow">{config.segment_label || T.tag}</span>
        <h1>{tenant.hero_tagline || T.hero}</h1>
        <p>{T.sub}</p>
        <div className="ca-hero-btns">
          <StoreButton asChild size="lg" className="ca-b ca-b-solid">
            <Link to={path("/catalogo")}>{config.hero_button_label || "Ver catálogo"} <ArrowRight size={18} aria-hidden="true" /></Link>
          </StoreButton>
          <StoreButton asChild size="lg" className="ca-b ca-b-line">
            <Link to={path("/sobre")}>Nossa história</Link>
          </StoreButton>
        </div>
      </div>
      <div className="ca-hero-art">
        <Blob className="ca-blob-a" />
        <Blob className="ca-blob-b" />
        <div className="ca-hero-photo">{art ? <img src={art} alt="" /> : <Leaf size={90} aria-hidden="true" />}</div>
        <div className="ca-welcome">
          <span><HeartHandshake size={22} aria-hidden="true" /></span>
          <div><b>Seja bem-vinda(o)</b><small>Cuidamos de cada detalhe para você.</small></div>
        </div>
      </div>
    </section>
  );

  return (
    <div className="ca ca-page">
      <StoreSEO title={`${tenant.name} | ${config.segment_label || T.tag}`} description={tenant.about_text || T.sub} image={tenant.banner_url} siteName={tenant.name} url={pageUrl()} />

      <HeroSlider
        slides={config.hero_slides}
        autoplaySeconds={config.hero_autoplay_seconds ?? 6}
        resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
        layout="banner"
        className="ca-slider"
        fallback={fallback}
      />

      {cats.length > 0 && (
        <section className="ca-block">
          <h2 className="ca-h2">{config.home_categories_title || T.categories}</h2>
          <div className="ca-icons" role="list">
            {cats.map((c, i) => {
              const Icon = categoryIcon(i);
              return (
                <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className={`ca-icon-pill ca-tint-${i % 4}`} role="listitem">
                  <span>{c.cover_url ? <img src={c.cover_url} alt="" loading="lazy" /> : <Icon size={34} aria-hidden="true" />}</span>
                  <b>{c.name}</b>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="ca-steps" aria-labelledby="ca-steps-t">
        <h2 id="ca-steps-t" className="ca-h2">Como cuidamos de você</h2>
        <ol>
          {steps.map((s, i) => (
            <li key={s.title} className={`ca-step ca-tint-${i}`}>
              <span className="ca-step-ico">{s.icon}</span>
              <small>Passo {i + 1}</small>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {shelf.length > 0 ? (
        <Rail title={config.home_featured_title || T.featured} to={path("/catalogo")}>
          {shelf.map((p) => <div className="ca-slide" key={p.id}><ProductCard product={p} /></div>)}
        </Rail>
      ) : (
        <p className="ca-empty">Em breve, novos cuidados por aqui.</p>
      )}

      <section className="ca-cta">
        <span className="ca-cta-ico"><Truck size={26} aria-hidden="true" /></span>
        <div>
          <h2>Cuidar de você é uma rotina.</h2>
          <p>Conheça a loja e descubra como podemos ajudar.</p>
        </div>
        {tenant.whatsapp ? (
          <StoreButton asChild size="lg" className="ca-b ca-b-solid">
            <a href={whatsappLink(tenant, "Olá! Gostaria de uma orientação.")} target="_blank" rel="noreferrer"><MessageCircle size={18} aria-hidden="true" /> Conversar agora</a>
          </StoreButton>
        ) : (
          <StoreButton asChild size="lg" className="ca-b ca-b-solid">
            <Link to={path("/sobre")}><Sparkles size={18} aria-hidden="true" /> Conhecer a loja</Link>
          </StoreButton>
        )}
      </section>
    </div>
  );
}
