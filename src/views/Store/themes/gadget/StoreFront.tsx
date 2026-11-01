import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, CreditCard, Headphones, Laptop, MessageCircle, Mouse, ShieldCheck, Smartphone, Sparkles, Truck, Zap } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import CampaignHero, { GADGET_CAMPAIGN } from "./CampaignHero";
import Card from "./Card";
import ProductCarousel from "./ProductCarousel";
import { categoryImage, discountPct, hasDiscount, shorten, useBestsellers, useGadgetMotion, useKit, useUsedCategories } from "./kit";
import SocialSection from "./Social";
import "./styles.css";

export default function StoreFront() {
  const { tenant, active, path, sf, hidden, waLink } = useKit();
  const motion = useGadgetMotion();
  const cats = useUsedCategories();
  const best = useBestsellers();

  const featured = active.filter((p) => p.is_featured);
  const showcase = (featured.length ? featured : active).slice(0, tenant.featured_limit || 8);
  const offers = active.filter((p) => hasDiscount(p)).sort((a, b) => discountPct(b) - discountPct(a)).slice(0, 4);
  const fresh = [...active].sort((a, b) => b.id - a.id).slice(0, 4);



  return (
    <main className="gd-page gd-home-page" ref={motion}>
      <StoreSEO
        title={tenant.name}
        description={tenant.hero_tagline || tenant.about_text || `Catálogo de ${tenant.name}`}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      <CampaignHero />

      <div className="gd-wrap gd-benefits-wrap" data-gd-reveal>
        <div className="gd-perks">
          <div><Truck size={18} strokeWidth={1.5} /><span>Entrega combinada<small>Receba em casa ou retire na loja</small></span></div>
          <div><CreditCard size={18} strokeWidth={1.5} /><span>Pagamento facilitado<small>Escolha a forma que preferir</small></span></div>
          <div><ShieldCheck size={18} strokeWidth={1.5} /><span>Compra segura<small>Produtos conferidos pela loja</small></span></div>
          <div><Headphones size={18} strokeWidth={1.5} /><span>Suporte humano<small>Dúvidas resolvidas no WhatsApp</small></span></div>
        </div>
      </div>

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
          <div className="gd-story-photo"><img src={GADGET_CAMPAIGN.hero} alt="Ambiente de trabalho com equipamentos de tecnologia, imagem ilustrativa" loading="lazy" /><span><Sparkles size={17} /> Tecnologia que faz sentido para você.</span></div>
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
