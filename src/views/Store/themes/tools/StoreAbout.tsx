import { Link } from "react-router-dom";
import { Facebook, Hammer, Instagram, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursList, useShop, waLink } from "./lib";

export default function StoreAbout() {
  const { tenant, active, categories, sf, path, vars } = useShop();
  const wa = waLink(tenant);
  const hours = hoursList(tenant);
  const title = sf.about_title || "Nossa oficina";
  const text = tenant.about_text || `${tenant.name} reúne ferramentas, materiais e acessórios para quem coloca a mão na massa, com ficha técnica clara e atendimento direto.`;
  const rules = [
    { t: "Ficha clara", d: "Referência, departamento e disponibilidade em cada item." },
    { t: "Lista de materiais", d: "Reúna tudo do projeto e envie em um único pedido." },
    { t: "Papo de oficina", d: "Dúvida de aplicação ou medida? Fale com a equipe." },
  ];
  return (
    <main className="op-scope op-page" style={vars}>
      <StoreSEO title={`${title} | ${tenant.name}`} description={text} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="op-about-hero">
        <div className="op-wrap op-about-grid">
          <div>
            <span className="op-tag y">Sobre a loja</span>
            <h1 className="op-h">{title}</h1>
            <p>{text}</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
              <Link className="op-btn dark" to={path("/catalogo")}>Ver catálogo</Link>
              {wa && <a className="op-btn light" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={16} />WhatsApp</a>}
            </div>
          </div>
          <div className="op-about-media">
            {tenant.banner_url ? <img src={tenant.banner_url} alt="" /> : <Hammer size={90} color="var(--op-accent)" strokeWidth={1.2} />}
          </div>
        </div>
        <div className="op-stripe" aria-hidden="true" />
      </section>
      <div className="op-wrap" style={{ paddingTop: 36 }}>
        <div className="op-sec-head" style={{ marginTop: 0 }}>
          <h2 className="op-h">Como trabalhamos</h2>
          <span className="op-mono" style={{ fontSize: 12, textTransform: "uppercase" }}>{active.length} itens · {categories.length} departamentos</span>
        </div>
        <div className="op-rules">
          {rules.map((r, i) => <div key={r.t} className="op-rule"><i>0{i + 1}</i><b>{r.t}</b><span>{r.d}</span></div>)}
        </div>
        <div className="op-info">
          <section>
            <h2 className="op-h">Horário</h2>
            {hours.length ? <ul>{hours.map((h) => <li key={h.day}><span>{h.day}</span><span>{h.text}</span></li>)}</ul> : <p>Consulte os horários pelo WhatsApp.</p>}
          </section>
          <section>
            <h2 className="op-h">Contato</h2>
            {tenant.show_address && tenant.address && <a className="row" href={`https://maps.google.com/?q=${encodeURIComponent(tenant.address)}`} target="_blank" rel="noreferrer"><MapPin size={18} />{tenant.address}</a>}
            {wa && <a className="row" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={18} />WhatsApp</a>}
            {tenant.instagram_url && <a className="row" href={tenant.instagram_url} target="_blank" rel="noreferrer"><Instagram size={18} />Instagram</a>}
            {tenant.facebook_url && <a className="row" href={tenant.facebook_url} target="_blank" rel="noreferrer"><Facebook size={18} />Facebook</a>}
            {!wa && !tenant.instagram_url && !tenant.facebook_url && !(tenant.show_address && tenant.address) && <p>Envie sua lista de materiais pelo carrinho e a loja retorna com o orçamento.</p>}
          </section>
        </div>
      </div>
    </main>
  );
}
