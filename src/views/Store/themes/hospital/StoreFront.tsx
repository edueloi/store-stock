import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, ArrowRight, ClipboardCheck, MessageCircle, Search, ShieldCheck, Stethoscope, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { StoreButton } from "../../../../components/store/StoreButton";
import { useShop, waLink } from "./lib";
import { SupplyCard } from "./parts";

export default function StoreFront() {
  const { tenant, categories, active, sf, path, vars } = useShop();
  const navigate = useNavigate();
  const [spec, setSpec] = useState("");
  const [term, setTerm] = useState("");
  const [panel, setPanel] = useState("");
  const specs = categories
    .map((c) => ({ ...c, count: active.filter((p) => p.category_id === c.id).length }))
    .filter((c) => c.count > 0);
  const highlighted = active.filter((p) => p.is_featured);
  const base = highlighted.length ? highlighted : active;
  const shown = (panel ? active.filter((p) => String(p.category_id) === panel) : base).slice(0, 8);
  const wa = waLink(tenant, "Olá! Gostaria de atendimento para um pedido de suprimentos.");

  const search = (e: FormEvent) => {
    e.preventDefault();
    const qs = new URLSearchParams();
    if (spec) qs.set("cat", spec);
    if (term.trim()) qs.set("q", term.trim());
    const q = qs.toString();
    const target = path("/catalogo");
    navigate(q ? `${target}${target.includes("?") ? "&" : "?"}${q}` : target);
  };

  const fallback = (
    <div className="ms-hero-card" aria-hidden="true">
      {tenant.banner_url ? <img src={tenant.banner_url} alt="" /> : (
        <svg className="pulse" viewBox="0 0 400 80" fill="none" stroke="var(--ms-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M0 40h120l16-30 24 62 20-44 14 12h206" />
        </svg>
      )}
      <div className="ms-badge"><ShieldCheck size={22} /><b>Compra profissional</b><span>{active.length} itens</span></div>
    </div>
  );

  return (
    <main className="ms-scope ms-page" style={vars}>
      <StoreSEO title={`${tenant.name} | ${sf.segment_label || "Materiais hospitalares"}`} description={tenant.hero_tagline || "Materiais, utensílios e equipamentos organizados para sua compra profissional."} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="ms-hero">
        <div className="ms-wrap ms-hero-grid">
          <div className="ms-finder">
            <span className="ms-seal"><ShieldCheck size={16} />Compra profissional</span>
            <h1 className="ms-serif">{tenant.hero_tagline || "Sua equipe, bem equipada."}</h1>
            <form className="ms-finder-box" role="search" onSubmit={search}>
              <div className="ms-tabs-spec" role="group" aria-label="Especialidade">
                <button type="button" aria-pressed={spec === ""} onClick={() => setSpec("")}>Todas</button>
                {specs.slice(0, 5).map((c) => (
                  <button type="button" key={c.id} aria-pressed={spec === String(c.id)} onClick={() => setSpec(String(c.id))}>{c.name}</button>
                ))}
              </div>
              <div className="ms-finder-row">
                <label className="sr-only" htmlFor="ms-hero-q">Buscar material ou código</label>
                <Search size={19} aria-hidden />
                <input id="ms-hero-q" type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Nome do material ou código (SKU)" autoComplete="off" />
                <StoreButton type="submit" shape="soft" size="md" className="ms-fbtn">Buscar</StoreButton>
              </div>
            </form>
            <div className="ms-hero-actions">
              <StoreButton asChild variant="outline" shape="soft" size="md" className="ms-obtn">
                <Link to={path("/catalogo")}>{sf.hero_button_label || "Ver catálogo"}<ArrowRight size={16} /></Link>
              </StoreButton>
              {wa && (
                <a className="ms-link" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} />Falar com a equipe</a>
              )}
            </div>
          </div>
          <HeroSlider
            slides={sf.hero_slides}
            autoplaySeconds={sf.hero_autoplay_seconds ?? 6}
            resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
            layout="banner"
            className="ms-slider"
            fallback={fallback}
          />
        </div>
      </section>
      <section className="ms-trust" aria-label="Diferenciais">
        <div className="ms-wrap">
          <div className="ms-trust-item"><ClipboardCheck /><div><b>Catálogo organizado</b><span>Código, categoria e disponibilidade de cada material.</span></div></div>
          <div className="ms-trust-item"><ShieldCheck /><div><b>Atendimento profissional</b><span>Equipe para tirar dúvidas antes do pedido.</span></div></div>
          <div className="ms-trust-item"><Truck /><div><b>Pedido simples</b><span>Monte o pedido de suprimentos e finalize online.</span></div></div>
        </div>
      </section>
      <section className="ms-section">
        <div className="ms-wrap">
          <div className="ms-sec-head">
            <div><span className="ms-eyebrow">Especialidades</span><h2 className="ms-serif">{sf.home_categories_title || sf.home_featured_title || "Materiais por especialidade"}</h2></div>
            <Link className="ms-link" to={path("/catalogo")}>Ver todo o catálogo <ArrowRight size={16} /></Link>
          </div>
          <div className="ms-browse">
            {specs.length > 0 && (
              <aside className="ms-side" aria-label="Especialidades">
                <button aria-pressed={panel === ""} onClick={() => setPanel("")}><Activity size={17} />Em destaque<em>{base.length}</em></button>
                {specs.slice(0, 10).map((c) => (
                  <button key={c.id} aria-pressed={panel === String(c.id)} onClick={() => setPanel(String(c.id))}>
                    <Stethoscope size={17} />{c.name}<em>{c.count}</em>
                  </button>
                ))}
              </aside>
            )}
            <div className="ms-browse-main">
              {shown.length ? (
                <div className="ms-grid ms-grid-3">{shown.map((p) => <SupplyCard key={p.id} product={p} />)}</div>
              ) : (
                <div className="ms-empty"><Stethoscope size={38} color="var(--ms-accent)" /><h2 className="ms-serif">Catálogo em atualização</h2><p>Ainda não há materiais publicados nesta loja.</p></div>
              )}
              {shown.length > 0 && (
                <div className="ms-more">
                  <StoreButton asChild variant="outline" shape="soft" size="md" className="ms-obtn">
                    <Link to={panel ? path(`/catalogo?cat=${panel}`) : path("/catalogo")}>Ver todos desta seleção<ArrowRight size={16} /></Link>
                  </StoreButton>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      <section className="ms-section">
        <div className="ms-wrap">
          <div className="ms-sec-head"><div><span className="ms-eyebrow">Como comprar</span><h2 className="ms-serif">Três passos para o seu pedido</h2></div></div>
          <div className="ms-steps">
            <div className="ms-step"><b>Escolha os materiais</b><span>Navegue por especialidade ou busque pelo nome e código.</span></div>
            <div className="ms-step"><b>Monte o pedido</b><span>Revise quantidades e opções antes de finalizar.</span></div>
            <div className="ms-step"><b>Receba o atendimento</b><span>A equipe confirma disponibilidade e combina a entrega.</span></div>
          </div>
        </div>
      </section>
      <div className="ms-wrap">
        <section className="ms-cta">
          <div><h2 className="ms-serif">Precisa de ajuda com um pedido grande?</h2><p>Nossa equipe orienta a escolha dos materiais para clínicas, consultórios e equipes de saúde.</p></div>
          {wa ? (
            <StoreButton asChild shape="soft" size="lg" className="ms-wbtn"><a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={18} />Chamar no WhatsApp</a></StoreButton>
          ) : (
            <StoreButton asChild shape="soft" size="lg" className="ms-wbtn"><Link to={path("/sobre")}>Conheça a equipe</Link></StoreButton>
          )}
        </section>
      </div>
    </main>
  );
}
