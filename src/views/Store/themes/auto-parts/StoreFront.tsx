import { useEffect, useRef, useState, type FormEvent } from "react";
import { gsap } from "gsap";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Car, Cog, MessageCircle, PackageCheck, Search, SearchCheck, ShieldCheck, Wrench } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { StoreButton } from "../../../../components/store/StoreButton";
import { useShop, waLink } from "./lib";
import { productRouteSegment } from "../../store-routing";
import { SkuRow, TableHead } from "./parts";

export default function StoreFront() {
  const { tenant, categories, active, sf, path, vars } = useShop();
  const navigate = useNavigate();
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!root.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from(".tg-hero-copy > *", { opacity: 0, y: 26, duration: 0.7, stagger: 0.1, ease: "power3.out" });
      gsap.from(".tg-hero-showcase", { opacity: 0, scale: 0.94, duration: 0.9, ease: "power3.out" });
      gsap.from(".tg-finder", { opacity: 0, y: 30, duration: 0.7, delay: 0.3, ease: "power3.out" });
    }, root);
    return () => ctx.revert();
  }, []);
  const [term, setTerm] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [year, setYear] = useState("");
  const highlighted = active.filter((p) => p.is_featured);
  const featured = (highlighted.length ? highlighted : active).slice(0, 8);
  const sectors = categories.filter((c) => active.some((p) => p.category_id === c.id));
  const wa = waLink(tenant, "Olá! Preciso confirmar a compatibilidade de uma peça.");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const base = path("/catalogo");
    const query = [term, vehicle, year].map((v) => v.trim()).filter(Boolean).join(" ");
    navigate(query ? `${base}${base.includes("?") ? "&" : "?"}q=${encodeURIComponent(query)}` : base);
  };
  const words = (tenant.hero_tagline || "A próxima peça do seu projeto.").split(" ");
  const last = words.length > 2 ? words.pop() : null;
  return (
    <main ref={root} className="tg-scope tg-page" style={vars}>
      <StoreSEO title={`${tenant.name} | ${sf.segment_label || "Autopeças & Acessórios"}`} description={tenant.hero_tagline || "Peças, acessórios e ferramentas com busca por código e SKU."} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="tg-wrap tg-top">
        <HeroSlider
          slides={sf.hero_slides}
          autoplaySeconds={sf.hero_autoplay_seconds ?? 6}
          resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
          layout="banner"
          className="tg-slider"
          fallback={
            <section className="tg-hero">
              <div className="tg-hero-copy">
                <span className="tg-kicker">{sf.segment_label || "Autopeças & Acessórios"}</span>
                <h1 className="tg-h">
                  {words.join(" ")}
                  {last && <> <em>{last}</em></>}
                </h1>
                <p className="tg-sub">Peças, acessórios e ferramentas. Confira a compatibilidade com a equipe antes de comprar.</p>
                <div className="tg-hero-cta">
                  <StoreButton asChild shape="pill" className="tg-btn"><Link to={path("/catalogo")}>{sf.hero_button_label || "Ver catálogo"} <ArrowRight size={16} /></Link></StoreButton>
                </div>
              </div>
              <div className="tg-hero-showcase" style={tenant.banner_url && !featured[0] ? { backgroundImage: `url(${tenant.banner_url})` } : undefined}>
                {featured[0] ? (
                  <Link to={path(`/produto/${productRouteSegment(featured[0])}`)} className="tg-showcase-photo" aria-label={featured[0].name}>
                    {(featured[0].images?.[0] || featured[0].image_url) ? <img src={featured[0].images?.[0] || featured[0].image_url} alt="" /> : <Cog size={110} />}
                    <span className="tg-showcase-caption">Em destaque<b>{featured[0].name}</b></span>
                  </Link>
                ) : (
                  <div className="tg-showcase-empty"><Wrench size={64} /><h2>Seu projeto começa pela peça certa.</h2></div>
                )}
              </div>
            </section>
          }
        />
        <form className="tg-finder" role="search" onSubmit={submit} aria-label="Buscar peça por veículo">
          <div className="tg-finder-title"><Car size={22} /><div><b>Encontre a peça do seu veículo</b><span>Informe o veículo, o ano e a peça ou código.</span></div></div>
          <label className="tg-field">
            <span>Veículo</span>
            <input value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Ex.: Gol 1.6" autoComplete="off" />
          </label>
          <label className="tg-field tg-field-year">
            <span>Ano</span>
            <input value={year} onChange={(e) => setYear(e.target.value.replace(/[^\d]/g, "").slice(0, 4))} placeholder="2014" inputMode="numeric" autoComplete="off" />
          </label>
          <label className="tg-field tg-field-grow">
            <span>Peça, código ou SKU</span>
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Ex.: pastilha de freio" autoComplete="off" />
          </label>
          <button className="tg-btn" type="submit"><Search size={18} />Buscar</button>
        </form>
      </div>
      <section className="tg-compat" aria-label="Compatibilidade">
        <div className="tg-wrap">
          <div className="tg-compat-item"><SearchCheck size={26} /><div><b>Confirme a compatibilidade</b><span>Informe modelo e ano do veículo e a equipe valida a peça.</span></div></div>
          <div className="tg-compat-item"><PackageCheck size={26} /><div><b>Código e SKU na lista</b><span>Todo item exibe o código para você comparar com a peça original.</span></div></div>
          <div className="tg-compat-item"><ShieldCheck size={26} /><div><b>Atendimento técnico</b><span>Dúvidas de aplicação resolvidas antes do pedido.</span></div></div>
        </div>
      </section>
      {sectors.length > 0 && (
        <section className="tg-section">
          <div className="tg-wrap">
            <div className="tg-section-head">
              <div>
                <span className="tg-kicker">Mapa da loja</span>
                <h2 className="tg-h">{sf.home_categories_title || "Setores da garagem"}</h2>
              </div>
              <Link className="tg-link" to={path("/catalogo")}>Ver tudo <ArrowRight size={15} /></Link>
            </div>
            <div className="tg-sectors" data-no-fx>
              {sectors.slice(0, 12).map((c) => {
                const sample = active.find((p) => p.category_id === c.id && (p.images?.[0] || p.image_url));
                const src = sample ? sample.images?.[0] || sample.image_url : "";
                return (
                  <Link key={c.id} className="tg-sector-tile" to={path(`/catalogo?cat=${c.id}`)}>
                    <span className="tg-sector-img">{src ? <img src={src} alt="" loading="lazy" /> : <Wrench size={34} strokeWidth={1.5} />}</span>
                    <b>{c.name}</b>
                    <small>{active.filter((p) => p.category_id === c.id).length} itens</small>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
      <section className="tg-section">
        <div className="tg-wrap">
          <div className="tg-section-head">
            <div>
              <span className="tg-kicker">Prontas para o pedido</span>
              <h2 className="tg-h">{sf.home_featured_title || "Seleção da garagem"}</h2>
            </div>
            <Link className="tg-link" to={path("/catalogo")}>Catálogo completo <ArrowRight size={15} /></Link>
          </div>
          {featured.length ? (
            <div className="tg-table" role="table" aria-label="Peças em destaque">
              <TableHead />
              {featured.map((p) => <SkuRow key={p.id} product={p} />)}
            </div>
          ) : (
            <div className="tg-empty">
              <Cog size={36} />
              <h2 className="tg-h">Estoque em atualização</h2>
              <p>Ainda não há peças publicadas. Fale com a equipe pelo WhatsApp.</p>
            </div>
          )}
        </div>
      </section>
      <div className="tg-wrap">
        <section className="tg-panel tg-cta">
          <div>
            <h2 className="tg-h">Não achou a peça?</h2>
            <p>Mande o modelo, o ano e o código que a equipe procura para você.</p>
          </div>
          {wa ? (
            <a className="tg-btn" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={18} />Chamar no WhatsApp</a>
          ) : (
            <Link className="tg-btn" to={path("/sobre")}>Falar com a loja</Link>
          )}
        </section>
      </div>
    </main>
  );
}
