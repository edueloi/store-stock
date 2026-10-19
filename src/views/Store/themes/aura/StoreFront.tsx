import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ArrowRight, Gem, Image as ImageIcon, MessageCircle, Sparkles, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { StoreButton } from "../../../../components/store/StoreButton";
import { imageOf, useShop, whatsappHref } from "./kit";
import { Empty, SoftCard } from "./parts";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, config, path } = useShop();
  const root = useRef<HTMLDivElement>(null);
  const featured = active.filter((p) => p.is_featured);
  const shown = (featured.length ? featured : active).slice(0, 8);
  const photo = tenant.banner_url || imageOf(shown[0]);
  const second = imageOf(shown[1]);
  const third = imageOf(shown[2]);
  const title = tenant.hero_tagline || "Leveza, cor e estilo em cada detalhe.";
  const sub = "Uma seleção cuidadosa de peças para o seu dia a dia, com atendimento próximo.";
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 10);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !root.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".au-hero-copy > *", { opacity: 0, y: 26, duration: 0.8, stagger: 0.12, ease: "power3.out" });
      gsap.from(".au-arch", { opacity: 0, scale: 0.94, duration: 1, ease: "power2.out" });
      gsap.from(".au-orb", { opacity: 0, scale: 0.6, duration: 0.8, delay: 0.4, stagger: 0.15, ease: "back.out(1.7)" });
      gsap.to(".au-orb", { y: -10, duration: 2.6, ease: "sine.inOut", yoyo: true, repeat: -1, stagger: 0.4 });
    }, root);
    return () => ctx.revert();
  }, []);

  const fallback = (
    <section className="au-hero">
      <div className="au-hero-copy">
        <span className="au-eyebrow"><Sparkles size={14} /> {config.segment_label || "Nova seleção"}</span>
        <h1>{title}</h1>
        <p>{sub}</p>
        <div className="au-hero-cta">
          <StoreButton asChild size="lg" shape="pill" className="au-cta">
            <Link to={path("/catalogo")}>{config.hero_button_label || "Ver a coleção"} <ArrowRight size={18} /></Link>
          </StoreButton>
          <StoreButton asChild variant="outline" size="lg" className="au-cta-line">
            <Link to={path("/sobre")}>Nossa história</Link>
          </StoreButton>
        </div>
      </div>
      <div className="au-hero-art">
        <div className="au-arch">{photo ? <img src={photo} alt="" /> : <ImageIcon size={64} className="ph" />}</div>
        {second && <div className="au-orb o1"><img src={second} alt="" /></div>}
        {third && <div className="au-orb o2"><img src={third} alt="" /></div>}
      </div>
    </section>
  );

  return (
    <div className="au-scope au-page" ref={root}>
      <StoreSEO title={tenant.name} description={tenant.about_text || sub} image={photo} siteName={tenant.name} url={typeof window !== "undefined" ? window.location.href : ""} />
      <div className="au-wrap au-hero-wrap" data-no-fx>
        <HeroSlider
          slides={config.hero_slides}
          autoplaySeconds={config.hero_autoplay_seconds ?? 6}
          resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
          layout="split"
          className="au-slider"
          fallback={fallback}
        />
      </div>

      <div className="au-wrap au-perks" data-no-fx>
        <span><Truck size={18} /> Entrega combinada</span>
        <span><Gem size={18} /> Peças selecionadas</span>
        <span><MessageCircle size={18} /> Atendimento no WhatsApp</span>
      </div>

      {cats.length > 0 && (
        <section className="au-section">
          <div className="au-wrap">
            <div className="au-sec-head center">
              <span className="au-kicker">Categorias</span>
              <h2>{config.home_categories_title || "Escolha o seu estilo"}</h2>
            </div>
            <div className="au-bubbles" data-no-fx>
              {cats.map((c, i) => {
                const img = imageOf(active.find((p) => p.category_id === c.id));
                return (
                  <Link key={c.id} className="au-bubble" to={path("/catalogo", { categoria: String(c.id) })}>
                    <span className={`au-bubble-img p${i % 4}`}>{img ? <img src={img} alt="" loading="lazy" /> : <ImageIcon size={26} />}</span>
                    <strong>{c.name}</strong>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="au-section">
        <div className="au-wrap">
          <div className="au-sec-head">
            <div>
              <span className="au-kicker">Seleção</span>
              <h2>{config.home_featured_title || "Para amar agora"}</h2>
            </div>
            <Link className="au-link" to={path("/catalogo")}>Ver tudo <ArrowRight size={15} /></Link>
          </div>
          {shown.length ? (
            <div className="au-mosaic">
              {shown.map((p, i) => <SoftCard key={p.id} product={p} feature={i === 0 && shown.length > 4} />)}
            </div>
          ) : (
            <Empty title="Nenhuma peça por aqui ainda" text="Em breve novidades lindas na vitrine." />
          )}
        </div>
      </section>

      {tenant.whatsapp && (
        <section className="au-section">
          <div className="au-wrap">
            <div className="au-band">
              <div>
                <h2>Quer ajuda para escolher?</h2>
                <p>Converse com a gente e receba sugestões sob medida.</p>
              </div>
              <StoreButton asChild size="lg" className="au-cta">
                <a href={whatsappHref(tenant)} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Falar no WhatsApp</a>
              </StoreButton>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
