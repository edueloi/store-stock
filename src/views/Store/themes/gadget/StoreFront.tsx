import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, CreditCard, Headphones, Laptop, MessageCircle, Mouse, ShieldCheck, Smartphone, Sparkles, Truck, Zap } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import Card from "./Card";
import ProductCarousel from "./ProductCarousel";
import { categoryImage, discountPct, EDITORIAL_IMAGE, hasDiscount, shorten, useBestsellers, useGadgetMotion, useHero, useKit, useUsedCategories } from "./kit";
import SocialSection from "./Social";
import "./styles.css";

export default function StoreFront() {
  const { tenant, active, path, sf, hidden, waLink } = useKit();
  const motion = useGadgetMotion();
  const cats = useUsedCategories();
  const hero = useHero();
  const best = useBestsellers();

  const featured = active.filter((p) => p.is_featured);
  const showcase = (featured.length ? featured : active).slice(0, tenant.featured_limit || 8);
  const offers = active.filter((p) => hasDiscount(p)).sort((a, b) => discountPct(b) - discountPct(a)).slice(0, 4);
  const fresh = [...active].sort((a, b) => b.id - a.id).slice(0, 4);

  const heroImage = tenant.banner_url || EDITORIAL_IMAGE;
  const tagline = (tenant.hero_tagline || "").trim();
  const shortTag = tagline && tagline.length <= 64;
  const text = shorten(shortTag ? tenant.about_text || "" : tagline || tenant.about_text || "", 200) || "Tecnologia selecionada, com atendimento próximo e compra simples.";

  const fallback = (
    <section className={`gd-hero${tenant.banner_url ? " gd-custom-campaign" : ""}`}>
      <div className="gd-hero-main">
        <div className="gd-hero-copy">
          <span className="gd-hero-eyebrow"><span /> Seu universo de tecnologia</span>
          <h1>{shortTag ? tagline : <>Tecnologia para <span>ir além.</span></>}</h1>
          <p>{text}</p>
          <div className="gd-hero-actions">
            <Link className="gd-btn gd-btn-electric" to={path("/catalogo")}>
              {sf.hero_button_label || "Explorar a loja"} <ArrowUpRight size={18} />
            </Link>
            {!hidden && offers.length > 0 && (
              <Link className="gd-btn gd-btn-line" to={path("/catalogo?ofertas=1")}>
                Ver ofertas <Zap size={16} />
              </Link>
            )}
            {tenant.whatsapp && <a className="gd-hero-help" href={waLink()} target="_blank" rel="noreferrer">Fale com um especialista <ArrowUpRight size={15} /></a>}
          </div>
          <div className="gd-hero-signature"><span><ShieldCheck size={17} /> Escolha com confiança</span><span><Headphones size={17} /> Atendimento de verdade</span></div>
        </div>
        <div className="gd-hero-art">
          <img src={heroImage} alt={tenant.banner_url ? `Destaque da ${tenant.name}` : "Composição ilustrativa de notebook, smartphone e fone de ouvido"} fetchPriority="high" />
          <span className="gd-image-label">{tenant.banner_url ? "Destaques da loja" : "Universo tech · Imagem ilustrativa"}</span>
          <Link className="gd-hero-float gd-feature-audio" to={path("/catalogo?q=fone")}><span className="gd-float-icon"><Headphones size={22} /></span><div><small>Entre no seu ritmo</small><strong>Som que acompanha.</strong></div><ArrowUpRight size={17} /></Link>
          <Link className="gd-feature-connect" to={path("/catalogo?q=acess%C3%B3rios")}><Zap size={17} /><span>Conecte possibilidades</span><ArrowUpRight size={15} /></Link>
          <span className="gd-hero-orbit" aria-hidden="true"><Sparkles size={22} /></span>
        </div>
      </div>
    </section>
  );

  return (
    <main className="gd-page gd-home-page" ref={motion}>
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

      <div className="gd-wrap gd-benefits-wrap" data-gd-reveal>
        <div className="gd-perks">
          <div><Truck size={18} strokeWidth={1.5} /><span>Entrega combinada<small>Receba em casa ou retire na loja</small></span></div>
          <div><CreditCard size={18} strokeWidth={1.5} /><span>Pagamento facilitado<small>Escolha a forma que preferir</small></span></div>
          <div><ShieldCheck size={18} strokeWidth={1.5} /><span>Compra segura<small>Produtos conferidos pela loja</small></span></div>
          <div><Headphones size={18} strokeWidth={1.5} /><span>Suporte humano<small>Dúvidas resolvidas no WhatsApp</small></span></div>
        </div>
      </div>

      {cats.length > 0 && (
        <section className="gd-wrap gd-section" data-gd-reveal aria-labelledby="gd-cats-title">
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

      {showcase.length > 0 && <section className="gd-wrap gd-section" data-gd-reveal>
        <header className="gd-sec-head">
          <div>
            <span className="gd-kicker">Seleção da loja</span>
            <h2>{sf.home_featured_title || "Em destaque"}</h2>
          </div>
          <Link to={path("/catalogo")}>Ver todos <ArrowRight size={14} /></Link>
        </header>
        <ProductCarousel products={showcase} label={sf.home_featured_title || "Em destaque"} />
      </section>}

      {!active.length && <section className="gd-wrap gd-section" data-gd-reveal>
        <header className="gd-sec-head"><div><span className="gd-kicker">Explore possibilidades</span><h2>Qual é o seu próximo upgrade?</h2></div></header>
        <div className="gd-discover-grid">{[
          { Icon: Smartphone, name: "Mais conexão", desc: "Smartphones e acessórios", query: "smartphone" },
          { Icon: Laptop, name: "Mais produtividade", desc: "Informática para o seu dia", query: "informática" },
          { Icon: Headphones, name: "Mais imersão", desc: "Áudio e entretenimento", query: "fone" },
          { Icon: Mouse, name: "Mais possibilidades", desc: "Acessórios e conectividade", query: "acessórios" },
        ].map(({ Icon, name, desc, query }) => <Link key={query} to={path(`/catalogo?q=${encodeURIComponent(query)}`)}><Icon size={36} strokeWidth={1.2} /><strong>{name}</strong><span>{desc}</span><ArrowUpRight size={17} /></Link>)}</div>
        <p className="gd-catalog-notice">Nosso catálogo está sendo atualizado.{tenant.whatsapp ? " Fale com a gente para consultar produtos e disponibilidade." : " Volte em breve para conhecer os produtos disponíveis."}</p>
      </section>}

      {best.items.length > 0 && (
        <section className="gd-wrap gd-section" data-gd-reveal aria-labelledby="gd-best-title">
          <header className="gd-sec-head">
            <div>
              <span className="gd-kicker">Preferidos dos clientes</span>
              <h2 id="gd-best-title">Mais vendidos</h2>
            </div>
            <Link to={path("/catalogo")}>Ver todos <ArrowRight size={14} /></Link>
          </header>
          <ProductCarousel products={best.items} label="Mais vendidos" ranked />
        </section>
      )}

      {!hidden && offers.length > 0 && (
        <section className="gd-wrap gd-section" data-gd-reveal>
          <div className="gd-promo">
            <div className="gd-promo-copy">
              <span className="gd-kicker">Ofertas</span>
              <h2>Preços que valem a pena</h2>
              <p>Até {discountPct(offers[0])}% de desconto em itens selecionados. Por tempo limitado, enquanto durar o estoque.</p>
              <Link className="gd-btn gd-btn-accent" to={path("/catalogo?ofertas=1")}>
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
        <section className="gd-wrap gd-section" data-gd-reveal>
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

      <section className="gd-wrap gd-section" data-gd-reveal>
        <div className="gd-story-teaser">
          <div className="gd-story-photo"><img src={EDITORIAL_IMAGE} alt="Ambiente de trabalho com equipamentos de tecnologia, imagem ilustrativa" loading="lazy" /><span><Sparkles size={17} /> Tecnologia que faz sentido para você.</span></div>
          <div className="gd-story-copy"><span className="gd-kicker">Muito além de produtos</span><h2>Boas escolhas começam<br />com uma boa conversa.</h2><p>{shorten(tenant.about_text || "Acreditamos na tecnologia que aproxima, simplifica e abre novas possibilidades. Por isso, ajudamos você a encontrar o que faz sentido para a sua rotina.", 260)}</p><Link className="gd-text-link" to={path("/sobre")}>Conheça a {tenant.name} <ArrowUpRight size={18} /></Link></div>
        </div>
      </section>

      <SocialSection />
      {tenant.whatsapp && (
        <section className="gd-wrap gd-section" data-gd-reveal>
          <div className="gd-cta">
            <div>
              <h2>Não sabe qual escolher?</h2>
              <p>Fale com a gente. Ajudamos a comparar modelos e a encontrar o que combina com o seu uso.</p>
            </div>
            <a className="gd-btn gd-btn-light" href={waLink()} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Falar com a loja <ArrowUpRight size={15} /></a>
          </div>
        </section>
      )}
    </main>
  );
}
