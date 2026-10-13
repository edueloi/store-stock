import { Link } from "react-router-dom";
import { Clock, Facebook, Instagram, MapPin, MessageCircle, Wrench } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursList, useShop, waLink } from "./lib";

export default function StoreAbout() {
  const { tenant, active, categories, sf, path, vars } = useShop();
  const wa = waLink(tenant);
  const hours = hoursList(tenant);
  const title = sf.about_title || `Sobre a ${tenant.name}`;
  const text = tenant.about_text || `${tenant.name} reúne peças, acessórios e ferramentas com atendimento técnico para você encontrar a peça certa, com código e disponibilidade à vista.`;
  const steps = [
    { t: "Busque", d: "Procure por nome, código ou SKU da peça." },
    { t: "Confirme", d: "Valide a compatibilidade com a equipe da loja." },
    { t: "Monte o pedido", d: "Adicione as peças e finalize online." },
    { t: "Receba", d: "Acompanhe a confirmação e a entrega combinada." },
  ];
  return (
    <main className="tg-scope tg-page" style={vars}>
      <StoreSEO title={`${title} | ${tenant.name}`} description={text} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="tg-about-hero">
        <div className="tg-wrap tg-about-grid">
          <div>
            <span className="tg-kicker">A garagem</span>
            <h1 className="tg-h">{title}</h1>
            <p>{text}</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
              <Link className="tg-btn" to={path("/catalogo")}>Ver catálogo</Link>
              {wa && <a className="tg-btn tg-btn-ghost" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} />WhatsApp</a>}
            </div>
          </div>
          <div className="tg-panel tg-about-media">
            {tenant.banner_url ? <img src={tenant.banner_url} alt="" /> : <Wrench size={80} color="var(--tg-line)" strokeWidth={1} />}
          </div>
        </div>
      </section>
      <div className="tg-wrap">
        <section className="tg-section">
          <div className="tg-section-head">
            <div><span className="tg-kicker">Processo</span><h2 className="tg-h">Do código ao pedido</h2></div>
            <span className="tg-mono" style={{ color: "var(--tg-mute)", fontSize: 12 }}>{active.length} peças · {categories.length} setores</span>
          </div>
          <div className="tg-steps">
            {steps.map((s) => (<div key={s.t} className="tg-step"><b>{s.t}</b><span>{s.d}</span></div>))}
          </div>
        </section>
        <div className="tg-info-grid">
          <section className="tg-panel">
            <h2 className="tg-h"><Clock size={20} style={{ verticalAlign: "-3px", marginRight: 8 }} color="var(--tg-accent)" />Horário</h2>
            {hours.length ? <ul>{hours.map((h) => <li key={h.day}><span>{h.day}</span><span>{h.text}</span></li>)}</ul> : <p>Consulte os horários de atendimento pelo WhatsApp.</p>}
          </section>
          <section className="tg-panel tg-contact">
            <h2 className="tg-h">Contato</h2>
            {tenant.show_address && tenant.address && <a href={`https://maps.google.com/?q=${encodeURIComponent(tenant.address)}`} target="_blank" rel="noreferrer"><MapPin size={17} color="var(--tg-accent)" />{tenant.address}</a>}
            {wa && <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} color="var(--tg-accent)" />Falar pelo WhatsApp</a>}
            {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer"><Instagram size={17} color="var(--tg-accent)" />Instagram</a>}
            {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer"><Facebook size={17} color="var(--tg-accent)" />Facebook</a>}
            {!wa && !tenant.instagram_url && !tenant.facebook_url && !(tenant.show_address && tenant.address) && <p>Use o carrinho para enviar seu pedido e a loja entrará em contato.</p>}
          </section>
        </div>
      </div>
    </main>
  );
}
