import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ClipboardList, FileText, Hammer, MessageCircle, Ruler } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { StoreButton } from "../../../../components/store/StoreButton";
import { useShop, waLink } from "./lib";
import { Sidebar, ToolCard } from "./parts";

export default function StoreFront() {
  const { tenant, categories, active, sf, path, vars } = useShop();
  const navigate = useNavigate();
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!root.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from(".op-hero-copy > *", { opacity: 0, y: 24, duration: 0.7, stagger: 0.1, ease: "power3.out" });
      gsap.from(".op-hero-art", { opacity: 0, scale: 0.94, duration: 0.9, ease: "power3.out" });
      const big = root.current?.querySelector<HTMLElement>(".op-big");
      if (big) {
        const counter = { n: 0 };
        gsap.to(counter, { n: active.length, duration: 1.2, ease: "power2.out", onUpdate: () => { big.textContent = String(Math.round(counter.n)).padStart(2, "0"); } });
      }
    }, root);
    return () => ctx.revert();
  }, [active.length]);
  const highlighted = active.filter((p) => p.is_featured);
  const featured = (highlighted.length ? highlighted : active).slice(0, 10);
  const depts = categories.filter((c) => active.some((p) => p.category_id === c.id));
  const wa = waLink(tenant, "Olá! Gostaria de um orçamento de materiais.");
  const goCat = (id: string) => navigate(path(id ? `/catalogo?cat=${id}` : "/catalogo"));
  return (
    <main ref={root} className="op-scope op-page" style={vars}>
      <StoreSEO title={`${tenant.name} | ${sf.segment_label || "Ferramentas & Construção"}`} description={tenant.hero_tagline || "Ferramentas, materiais e acessórios para tirar projetos do papel."} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="op-wrap">
        <div className="op-shell">
          <Sidebar selected="" onSelect={goCat} />
          <div style={{ minWidth: 0 }}>
            <HeroSlider
              slides={sf.hero_slides}
              autoplaySeconds={sf.hero_autoplay_seconds ?? 6}
              resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
              layout="banner"
              className="op-slider"
              fallback={
                <section className="op-hero">
                  <div className="op-hero-copy">
                    <span className="op-tag">{sf.segment_label || "Ferramentas & Construção"}</span>
                    <h1 className="op-h">{tenant.hero_tagline || "Seu trabalho merece a ferramenta certa."}</h1>
                    <p>Ferramentas, materiais e acessórios para tirar projetos do papel.</p>
                    <div className="op-hero-cta">
                      <StoreButton asChild shape="pill" className="op-cta"><Link to={path("/catalogo")}>{sf.hero_button_label || "Ver catálogo"} <ArrowRight size={16} /></Link></StoreButton>
                      {wa && <a className="op-btn light" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={16} />Pedir orçamento</a>}
                    </div>
                  </div>
                  <div className="op-hero-art" style={tenant.banner_url ? { backgroundImage: `linear-gradient(rgba(28,42,52,.25), rgba(28,42,52,.5)), url(${tenant.banner_url})` } : undefined} aria-hidden="true">
                    <span className="op-big">{String(active.length).padStart(2, "0")}</span>
                    <small>itens no catálogo</small>
                    <span className="op-stripe-corner" />
                  </div>
                </section>
              }
            />
            <div className="op-perks">
              <div className="op-perk"><ClipboardList /><div><b>Lista de materiais</b><span>Reúna tudo o que o projeto precisa em um só pedido.</span></div></div>
              <div className="op-perk"><FileText /><div><b>Ficha técnica</b><span>Referência, departamento e disponibilidade em cada item.</span></div></div>
              <div className="op-perk"><Ruler /><div><b>Orientação da equipe</b><span>Dúvida de medida ou aplicação? Chame a loja.</span></div></div>
            </div>
            {depts.length > 0 && (
              <>
                <div className="op-sec-head"><h2 className="op-h">{sf.home_categories_title || "Departamentos da oficina"}</h2></div>
                <div className="op-depts">
                  {depts.slice(0, 9).map((c, i) => (
                    <Link key={c.id} className="op-dept" to={path(`/catalogo?cat=${c.id}`)}>
                      <i>{String(i + 1).padStart(2, "0")}</i><span>{c.name}</span><small>{active.filter((p) => p.category_id === c.id).length} itens</small>
                    </Link>
                  ))}
                </div>
              </>
            )}
            <div className="op-sec-head">
              <h2 className="op-h">{sf.home_featured_title || "Prontos para o trabalho"}</h2>
              <Link className="op-link" to={path("/catalogo")}>Ver catálogo completo <ArrowRight size={15} /></Link>
            </div>
            {featured.length ? (
              <div className="op-grid cols5">{featured.map((p) => <ToolCard key={p.id} product={p} />)}</div>
            ) : (
              <div className="op-empty"><Hammer size={38} /><h2 className="op-h">Estoque em atualização</h2><p>Ainda não há itens publicados nesta loja.</p></div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
