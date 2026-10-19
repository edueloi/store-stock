import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ArrowRight, ChevronLeft, ChevronRight, CreditCard, MessageCircle, Package, RefreshCcw, Sparkles, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { StoreButton } from "../../../../components/store/StoreButton";
import { productRouteSegment } from "../../store-routing";
import { imageOf, money, priceOf, useShop, whatsappHref } from "./kit";
import { Empty, TechCard } from "./parts";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, config, hidden, path } = useShop();
  const featured = active.filter((p) => p.is_featured);
  const shown = (featured.length ? featured : active).slice(0, 8);
  const lead = shown[0];
  const photo = tenant.banner_url || imageOf(lead);
  const title = tenant.hero_tagline || "Tecnologia que acompanha você.";
  const sub = "Eletrônicos e acessórios selecionados para o trabalho, a casa e a diversão.";
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id));
  const root = useRef<HTMLDivElement>(null);
  const snap = useRef<HTMLDivElement>(null);
  const scrollCats = (dir: number) => snap.current?.scrollBy({ left: dir * 480, behavior: "smooth" });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !root.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".tp-hero-copy > *", { opacity: 0, y: 28, duration: 0.7, stagger: 0.1, ease: "power3.out" });
      gsap.from(".tp-hero-frame", { opacity: 0, scale: 1.06, duration: 1.1, ease: "power2.out" });
      gsap.from(".tp-hero-float", { opacity: 0, y: 24, delay: 0.5, duration: 0.7, ease: "back.out(1.6)" });
      gsap.from(".tp-trust-strip > *", { opacity: 0, y: 16, delay: 0.3, duration: 0.5, stagger: 0.08 });
    }, root);
    return () => ctx.revert();
  }, []);

  const fallback = (
    <section className="tp-hero">
      <div className="tp-hero-copy">
        <span className="tp-pill">
          <Sparkles size={14} /> {config.segment_label || "Novidades em tecnologia"}
        </span>
        <h1>{title}</h1>
        <p>{sub}</p>
        <div className="tp-hero-cta">
          <StoreButton asChild size="lg" className="tp-cta">
            <Link to={path("/catalogo")}>
              {config.hero_button_label || "Ver catálogo"} <ArrowRight size={18} />
            </Link>
          </StoreButton>
          <StoreButton asChild variant="outline" size="lg" className="tp-cta-line">
            <Link to={path("/sobre")}>Conhecer a loja</Link>
          </StoreButton>
        </div>
      </div>
      <div className="tp-hero-art">
        <div className="tp-hero-frame">{photo ? <img src={photo} alt="" /> : <Package size={72} className="ph" />}</div>
        {lead && (
          <Link className="tp-hero-float" to={path(`/produto/${productRouteSegment(lead)}`)} data-no-fx>
            <span>Em destaque</span>
            <strong>{lead.name}</strong>
            {!hidden && <em>{money(priceOf(lead))}</em>}
          </Link>
        )}
      </div>
    </section>
  );

  return (
    <div className="tp-scope tp-page" ref={root}>
      <StoreSEO title={tenant.name} description={tenant.about_text || sub} image={photo} siteName={tenant.name} url={typeof window !== "undefined" ? window.location.href : ""} />
      <div className="tp-wrap tp-hero-wrap" data-no-fx>
        <HeroSlider
          slides={config.hero_slides}
          autoplaySeconds={config.hero_autoplay_seconds ?? 6}
          resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
          layout="split"
          className="tp-slider"
          fallback={fallback}
        />
      </div>

      <div className="tp-wrap tp-trust-strip" data-no-fx>
        <div><Truck size={20} /><span><b>Entrega combinada</b>Falamos com você</span></div>
        <div><CreditCard size={20} /><span><b>Pagamento flexível</b>Pix, cartão e mais</span></div>
        <div><RefreshCcw size={20} /><span><b>Troca facilitada</b>Atendimento direto</span></div>
      </div>

      {cats.length > 0 && (
        <section className="tp-section">
          <div className="tp-wrap">
            <div className="tp-sec-head">
              <div>
                <span className="tp-kicker">Categorias</span>
                <h2>{config.home_categories_title || "Explore por categoria"}</h2>
              </div>
              <div className="tp-arrows">
                <button type="button" aria-label="Anterior" onClick={() => scrollCats(-1)}><ChevronLeft size={18} /></button>
                <button type="button" aria-label="Próximo" onClick={() => scrollCats(1)}><ChevronRight size={18} /></button>
              </div>
            </div>
            <div className="tp-snap" data-no-fx ref={snap}>
              {cats.slice(0, 12).map((c, i) => {
                const img = imageOf(active.find((p) => p.category_id === c.id));
                return (
                  <Link key={c.id} className={`tp-catcard t${i % 4}`} to={path("/catalogo", { categoria: String(c.id) })}>
                    <span className="tp-catcard-img">{img ? <img src={img} alt="" loading="lazy" /> : <Package size={34} />}</span>
                    <strong>{c.name}</strong>
                    <small>{active.filter((p) => p.category_id === c.id).length} produtos</small>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="tp-section">
        <div className="tp-wrap">
          <div className="tp-sec-head">
            <div>
              <span className="tp-kicker">Seleção</span>
              <h2>{config.home_featured_title || "Escolhidos para você"}</h2>
            </div>
            <Link className="tp-link" to={path("/catalogo")}>
              Ver todos <ArrowRight size={15} />
            </Link>
          </div>
          {shown.length ? (
            <div className="tp-grid is-4">
              {shown.map((p) => (
                <TechCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <Empty title="Nenhum produto disponível" text="Em breve novos dispositivos e acessórios por aqui." />
          )}
        </div>
      </section>

      {tenant.whatsapp && (
        <section className="tp-section">
          <div className="tp-wrap">
            <div className="tp-cta-band">
              <div>
                <h2>Precisa confirmar compatibilidade?</h2>
                <p>Fale com a equipe antes de comprar.</p>
              </div>
              <StoreButton asChild size="lg" className="tp-cta">
                <a href={whatsappHref(tenant)} target="_blank" rel="noreferrer">
                  <MessageCircle size={18} /> Falar no WhatsApp
                </a>
              </StoreButton>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
