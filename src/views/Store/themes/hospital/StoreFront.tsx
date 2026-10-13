import { Link } from "react-router-dom";
import { Activity, ArrowRight, Bandage, ClipboardCheck, HeartPulse, MessageCircle, Microscope, Pill, ShieldCheck, Stethoscope, Syringe, Thermometer, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useShop, waLink } from "./lib";
import { SupplyCard } from "./parts";

const icons = [Stethoscope, Syringe, Activity, Pill, Thermometer, HeartPulse, Microscope, Bandage];

export default function StoreFront() {
  const { tenant, categories, active, sf, path, vars } = useShop();
  const highlighted = active.filter((p) => p.is_featured);
  const featured = (highlighted.length ? highlighted : active).slice(0, 8);
  const specs = categories.filter((c) => active.some((p) => p.category_id === c.id));
  const wa = waLink(tenant, "Olá! Gostaria de atendimento para um pedido de suprimentos.");
  return (
    <main className="ms-scope ms-page" style={vars}>
      <StoreSEO title={`${tenant.name} | ${sf.segment_label || "Materiais hospitalares"}`} description={tenant.hero_tagline || "Materiais, utensílios e equipamentos organizados para sua compra profissional."} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="ms-hero">
        <div className="ms-wrap ms-hero-grid">
          <div>
            <span className="ms-seal"><ShieldCheck size={18} />Atendimento profissional</span>
            <h1 className="ms-serif">{tenant.hero_tagline || "Sua equipe, bem equipada."}</h1>
            <p className="lead">Materiais, utensílios e equipamentos organizados para sua compra profissional.</p>
            <div className="ms-hero-actions">
              <Link className="ms-btn" to={path("/catalogo")}>{sf.hero_button_label || "Ver catálogo"}<ArrowRight size={17} /></Link>
              {wa && <a className="ms-btn ghost" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} />Falar com a equipe</a>}
            </div>
          </div>
          <div className="ms-hero-card" aria-hidden="true">
            {tenant.banner_url && <img src={tenant.banner_url} alt="" />}
            {!tenant.banner_url && (
              <svg className="pulse" viewBox="0 0 400 80" fill="none" stroke="var(--ms-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M0 40h120l16-30 24 62 20-44 14 12h206" />
              </svg>
            )}
            <div className="ms-badge">
              <div><ShieldCheck size={24} /><b>Compra profissional</b><span>{active.length} itens</span></div>
            </div>
          </div>
        </div>
      </section>
      <section className="ms-trust" aria-label="Diferenciais">
        <div className="ms-wrap">
          <div className="ms-trust-item"><ClipboardCheck /><div><b>Catálogo organizado</b><span>Código, categoria e disponibilidade de cada material.</span></div></div>
          <div className="ms-trust-item"><ShieldCheck /><div><b>Atendimento profissional</b><span>Equipe para tirar dúvidas antes do pedido.</span></div></div>
          <div className="ms-trust-item"><Truck /><div><b>Pedido simples</b><span>Monte o pedido de suprimentos e finalize online.</span></div></div>
        </div>
      </section>
      {specs.length > 0 && (
        <section className="ms-section">
          <div className="ms-wrap">
            <div className="ms-sec-head">
              <div><span className="ms-eyebrow">Especialidades</span><h2 className="ms-serif">{sf.home_categories_title || "Áreas de atendimento"}</h2></div>
              <Link className="ms-link" to={path("/catalogo")}>Ver todo o catálogo <ArrowRight size={16} /></Link>
            </div>
            <div className="ms-spec-grid">
              {specs.slice(0, 8).map((c, i) => {
                const Icon = icons[i % icons.length];
                const n = active.filter((p) => p.category_id === c.id).length;
                return (
                  <Link key={c.id} className="ms-spec" to={path(`/catalogo?cat=${c.id}`)}>
                    <span className="ic"><Icon size={24} /></span>
                    <div><b>{c.name}</b><br /><small>{n} {n === 1 ? "material" : "materiais"}</small></div>
                    <span className="go">Explorar <ArrowRight size={15} /></span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
      <section className="ms-section">
        <div className="ms-wrap">
          <div className="ms-sec-head">
            <div><span className="ms-eyebrow">Mais procurados</span><h2 className="ms-serif">{sf.home_featured_title || "Materiais em destaque"}</h2></div>
            <Link className="ms-link" to={path("/catalogo")}>Ver mais <ArrowRight size={16} /></Link>
          </div>
          {featured.length ? (
            <div className="ms-grid">{featured.map((p) => <SupplyCard key={p.id} product={p} />)}</div>
          ) : (
            <div className="ms-empty"><Stethoscope size={38} color="var(--ms-accent)" /><h2 className="ms-serif">Catálogo em atualização</h2><p>Ainda não há materiais publicados nesta loja.</p></div>
          )}
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
          {wa ? <a className="ms-btn" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={18} />Chamar no WhatsApp</a> : <Link className="ms-btn" to={path("/sobre")}>Conheça a equipe</Link>}
        </section>
      </div>
    </main>
  );
}
