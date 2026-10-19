import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ArrowRight, Package, ShieldCheck, Truck, Zap } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { StoreButton } from "../../../../components/store/StoreButton";
import { imageOf, useShop } from "./kit";
import { Empty, NeonCard } from "./parts";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, config, path } = useShop();
  const root = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<number | null>(null);
  const featured = active.filter((p) => p.is_featured);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 8);
  const pool = tab === null ? (featured.length ? featured : active) : active.filter((p) => p.category_id === tab);
  const shown = pool.slice(0, 8);
  const heroImage = tenant.banner_url || imageOf(featured[0] || active[0]);
  const title = tenant.hero_tagline || "Prepare o seu próximo nível.";
  const sub = "Produtos, acessórios e novidades para montar seu espaço.";
  const ticker = [config.segment_label || "Games & Cultura Digital", `${active.length} produtos`, "Atendimento rápido", tenant.name];

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !root.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".cy-hero-copy > *", { opacity: 0, y: 30, duration: 0.7, stagger: 0.11, ease: "power3.out" });
      gsap.fromTo(".cy-hero-bg", { scale: 1.12 }, { scale: 1, duration: 1.6, ease: "power2.out" });
      gsap.from(".cy-glass", { opacity: 0, y: 26, delay: 0.4, duration: 0.6, stagger: 0.1, ease: "power3.out" });
    }, root);
    return () => ctx.revert();
  }, []);

  const fallback = (
    <section className="cy-hero">
      <div className="cy-hero-bg" aria-hidden="true">{heroImage && <img src={heroImage} alt="" />}</div>
      <div className="cy-hero-shade" aria-hidden="true" />
      <div className="cy-hero-copy">
        <span className="cy-chip"><Zap size={14} /> {config.segment_label || "Novidades"}</span>
        <h1>{title}</h1>
        <p>{sub}</p>
        <div className="cy-actions">
          <StoreButton asChild size="lg" className="cy-cta">
            <Link to={path("/catalogo")}>{config.hero_button_label || "Explorar catálogo"} <ArrowRight size={18} /></Link>
          </StoreButton>
          <StoreButton asChild variant="outline" size="lg" className="cy-cta-line">
            <Link to={path("/sobre")}>Sobre a loja</Link>
          </StoreButton>
        </div>
      </div>
      <div className="cy-glass-row">
        <div className="cy-glass"><b>{active.length}</b><span>produtos</span></div>
        <div className="cy-glass"><b>{cats.length}</b><span>categorias</span></div>
        <div className="cy-glass"><Truck size={20} /><span>Envio combinado</span></div>
      </div>
    </section>
  );

  return (
    <div className="cy-scope cy-page" ref={root}>
      <StoreSEO title={tenant.name} description={tenant.about_text || sub} image={heroImage} siteName={tenant.name} url={typeof window !== "undefined" ? window.location.href : ""} />
      <div className="cy-wrap cy-hero-wrap" data-no-fx>
        <HeroSlider
          slides={config.hero_slides}
          autoplaySeconds={config.hero_autoplay_seconds ?? 6}
          resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
          layout="banner"
          className="cy-slider"
          fallback={fallback}
        />
      </div>

      <div className="cy-wrap" data-no-fx>
        <div className="cy-ticker" aria-hidden="true">
          <div className="cy-ticker-track">
            {[...ticker, ...ticker, ...ticker, ...ticker].map((t, i) => <span key={i}>{t}</span>)}
          </div>
        </div>
      </div>

      <section className="cy-section">
        <div className="cy-wrap">
          <div className="cy-sec-head">
            <div>
              <span className="cy-tag">Vitrine</span>
              <h2>{tab === null ? config.home_featured_title || "Em destaque" : config.home_categories_title || "Por categoria"}</h2>
            </div>
            <Link className="cy-link" to={path("/catalogo", tab !== null ? { categoria: String(tab) } : {})}>Ver catálogo <ArrowRight size={15} /></Link>
          </div>
          {cats.length > 0 && (
            <div className="cy-tabs" role="tablist" aria-label="Categorias" data-no-fx>
              <button type="button" role="tab" aria-selected={tab === null} onClick={() => setTab(null)}>Destaques</button>
              {cats.map((c) => (
                <button key={c.id} type="button" role="tab" aria-selected={tab === c.id} onClick={() => setTab(c.id)}>{c.name}</button>
              ))}
            </div>
          )}
          {shown.length ? (
            <div className="cy-grid is-4">{shown.map((p) => <NeonCard key={p.id} product={p} />)}</div>
          ) : (
            <Empty title="Nenhum produto por aqui" text="Escolha outra categoria ou volte em breve." />
          )}
        </div>
      </section>

      <section className="cy-section">
        <div className="cy-wrap cy-trust">
          <div><ShieldCheck size={22} /><span><b>Compra segura</b>Pedido confirmado pela loja</span></div>
          <div><Truck size={22} /><span><b>Entrega combinada</b>Combine direto com a equipe</span></div>
          <div><Package size={22} /><span><b>Troca facilitada</b>Atendimento pelo WhatsApp</span></div>
        </div>
      </section>
    </div>
  );
}
