import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { gsap } from "gsap";
import { ArrowRight, Check, Gem, HeartHandshake, Ruler, Wrench } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { StoreButton } from "../../../../components/store/StoreButton";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import { VitraProductCard, vitraHidePrices, vitraImage } from "./ThemeParts";

const FALLBACK_HERO = "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1800&q=85";
const FALLBACK_CATEGORY = "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=800&q=85";

const BENEFITS = [
  { icon: Ruler, title: "Projetos sob medida", desc: "Do seu jeito, no seu espaço" },
  { icon: Gem, title: "Acabamento premium", desc: "Qualidade em cada detalhe" },
  { icon: Wrench, title: "Instalação especializada", desc: "Equipe técnica qualificada" },
  { icon: HeartHandshake, title: "Atendimento próximo", desc: "Do orçamento à entrega" },
];

export default function StoreFront() {
  const { slug: routeSlug } = useParams();
  const { tenant, products, categories } = useStore();
  const root = useRef<HTMLElement>(null);
  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);
  const sf = tenant.policies?.storefront || {};

  const active = products.filter((p) => p.is_active);
  const featured = active.filter((p) => p.is_featured);
  const showcase = featured.length > 0 ? featured : active;
  const hidePrices = vitraHidePrices(tenant);
  const heroImage = tenant.banner_url || FALLBACK_HERO;
  const whatsappLink = tenant.whatsapp
    ? `https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent("Olá! Gostaria de solicitar um orçamento para um projeto em vidro.")}`
    : null;

  // Categoria não tem imagem própria: usa a foto de um produto da categoria.
  const categoryImage = (categoryId: number | string) => {
    const sample = active.find((p) => p.category_id === categoryId && vitraImage(p));
    return (sample && vitraImage(sample)) || FALLBACK_CATEGORY;
  };
  const shownCategories = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 5);

  useEffect(() => {
    if (!root.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from(".vitra-hero-copy > *", { opacity: 0, y: 26, duration: 0.7, stagger: 0.1, ease: "power3.out" });
            gsap.from(".vitra-hero-float", { opacity: 0, scale: 0.85, duration: 0.7, delay: 0.5, stagger: 0.15, ease: "back.out(1.6)" });
      gsap.to(".vitra-hero-bg", { scale: 1.1, duration: 9, ease: "none", yoyo: true, repeat: -1 });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <main ref={root} className="vitra-root vitra-home">
      <StoreSEO
        title={`${tenant.name} | Vidraçaria & Design`}
        description={tenant.about_text || "Vidros temperados, espelhos lapidados, box para banheiros, portas e esquadrias sob medida."}
        image={heroImage}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
        keywords={`${tenant.name}, vidraçaria, vidros temperados, espelhos, box de vidro, esquadrias`}
      />

      <div className="vitra-container vitra-hero-wrap">
        <HeroSlider
          slides={sf.hero_slides}
          autoplaySeconds={sf.hero_autoplay_seconds ?? 6}
          resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
          layout="banner"
          className="vitra-slider"
          fallback={
            <section className="vitra-hero">
              <img className="vitra-hero-bg" src={heroImage} alt="" />
              <div className="vitra-hero-copy">
                <div className="vitra-eyebrow">Elegância em transparência</div>
                <h1>
                  Transforme seus ambientes com <em>vidro e design.</em>
                </h1>
                <p>{tenant.about_text || "Soluções em vidros, espelhos, boxes e esquadrias para trazer mais luz, sofisticação e personalidade a cada espaço."}</p>
                <div className="vitra-hero-actions">
                  <StoreButton asChild size="lg" className="vitra-cta">
                    <Link to={path("/catalogo")}>Explorar catálogo <ArrowRight size={16} /></Link>
                  </StoreButton>
                  <Link to={path("/sobre")} className="vitra-btn-secondary">Nossa história</Link>
                </div>
              </div>
              <div className="vitra-hero-float vitra-float-a"><strong>15+</strong><span>anos transformando ambientes</span></div>
              <div className="vitra-hero-float vitra-float-b"><Check size={16} /> Vidro temperado certificado</div>
            </section>
          }
        />
      </div>

      <section className="vitra-container vitra-benefits" aria-label="Diferenciais">
        {BENEFITS.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="vitra-benefit">
            <span><Icon size={20} /></span>
            <div><b>{title}</b><small>{desc}</small></div>
          </div>
        ))}
      </section>

      {shownCategories.length > 0 && (
        <section className="vitra-container vitra-section">
          <div className="vitra-sec-head">
            <div>
              <div className="vitra-eyebrow">Soluções para cada ambiente</div>
              <h2>Explore nossas linhas</h2>
            </div>
            <p>De pequenos detalhes a projetos completos: encontre a solução ideal para transformar seu espaço.</p>
          </div>
          <div className={`vitra-bento n${shownCategories.length}`}>
            {shownCategories.map((cat) => (
              <Link key={cat.id} to={path(`/catalogo?cat=${cat.id}`)} className="vitra-cat-card">
                <img src={categoryImage(cat.id)} alt="" loading="lazy" />
                <div className="vitra-cat-content">
                  <small>Conheça a linha</small>
                  <h3>{cat.name} <ArrowRight size={18} /></h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="vitra-band">
        <div className="vitra-container vitra-section">
          <div className="vitra-sec-head">
            <div>
              <div className="vitra-eyebrow">Seleção especial</div>
              <h2>Produtos em destaque</h2>
            </div>
            <Link to={path("/catalogo")} className="vitra-textlink">Ver catálogo completo <ArrowRight size={14} /></Link>
          </div>
          <div className="vitra-grid">
            {showcase.slice(0, 8).map((product) => (
              <VitraProductCard
                key={product.id}
                product={product}
                category={categories.find((c) => c.id === product.category_id)?.name}
                path={path}
                hidePrices={hidePrices}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="vitra-container vitra-section">
        <div className="vitra-about-split">
          <div className="vitra-about-photo">
            <img src={FALLBACK_CATEGORY} alt="Ambiente arquitetônico com vidro" loading="lazy" />
            <div className="vitra-exp"><strong>15+</strong><span>Anos de experiência</span></div>
          </div>
          <div>
            <div className="vitra-eyebrow">Sobre a {tenant.name}</div>
            <h2 className="vitra-about-title">Mais do que vidro. Criamos novas perspectivas.</h2>
            <p className="vitra-about-text">
              {tenant.about_text || "Acreditamos no poder dos detalhes. Cada solução é pensada para unir segurança, beleza e funcionalidade, valorizando o seu projeto e a sua história."}
            </p>
            <ul className="vitra-checks">
              {["Atendimento consultivo e personalizado", "Materiais selecionados e acabamento impecável", "Projetos residenciais e comerciais sob medida"].map((item) => (
                <li key={item}><Check size={16} />{item}</li>
              ))}
            </ul>
            <Link to={path("/sobre")} className="vitra-btn-primary">Conheça nossa empresa <ArrowRight size={15} /></Link>
          </div>
        </div>
      </section>

      <section className="vitra-container vitra-cta-wrap">
        <div className="vitra-cta-card">
          <div>
            <h2>Tem um projeto em mente?</h2>
            <p>Conte para nós o que você precisa. Preparamos soluções sob medida.</p>
          </div>
          {whatsappLink ? (
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="vitra-btn-primary">Solicitar orçamento <ArrowRight size={15} /></a>
          ) : (
            <Link to={path("/catalogo")} className="vitra-btn-primary">Ver catálogo completo <ArrowRight size={15} /></Link>
          )}
        </div>
      </section>
    </main>
  );
}
