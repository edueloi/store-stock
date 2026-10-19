import { Link } from "react-router-dom";
import { ClipboardCheck, Facebook, HeartPulse, Instagram, MapPin, MessageCircle, ShieldCheck, Stethoscope } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { StoreButton } from "../../../../components/store/StoreButton";
import { hoursList, useShop, waLink } from "./lib";

export default function StoreAbout() {
  const { tenant, active, categories, sf, path, vars } = useShop();
  const wa = waLink(tenant);
  const hours = hoursList(tenant);
  const title = sf.about_title || `Sobre a ${tenant.name}`;
  const text = tenant.about_text || `${tenant.name} organiza materiais, utensílios e equipamentos para clínicas, consultórios e equipes de saúde, com atendimento profissional em cada pedido.`;
  return (
    <main className="ms-scope ms-page" style={vars}>
      <StoreSEO title={`${title} | ${tenant.name}`} description={text} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="ms-about-hero">
        <div className="ms-wrap ms-about-grid">
          <div>
            <span className="ms-eyebrow">Quem somos</span>
            <h1 className="ms-serif">{title}</h1>
            <p>{text}</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
              <StoreButton asChild shape="soft" size="md" className="ms-fbtn"><Link to={path("/catalogo")}>Ver catálogo</Link></StoreButton>
              {wa && <StoreButton asChild variant="outline" shape="soft" size="md" className="ms-obtn"><a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} />Falar com a equipe</a></StoreButton>}
            </div>
          </div>
          <div className="ms-cert">
            {tenant.banner_url && <img src={tenant.banner_url} alt="" />}
            <div className="ring"><ShieldCheck size={56} strokeWidth={1.4} /></div>
            <b>Atendimento profissional</b>
            <span>{active.length} materiais · {categories.length} especialidades</span>
          </div>
        </div>
      </section>
      <div className="ms-wrap">
        <section className="ms-section">
          <div className="ms-values">
            <div className="ms-value"><Stethoscope /><b>Foco profissional</b><span>Catálogo pensado para a rotina de clínicas, consultórios e equipes de saúde.</span></div>
            <div className="ms-value"><ClipboardCheck /><b>Informação clara</b><span>Código, especialidade e disponibilidade visíveis antes do pedido.</span></div>
            <div className="ms-value"><HeartPulse /><b>Cuidado no atendimento</b><span>Equipe pronta para orientar a escolha e confirmar o pedido.</span></div>
          </div>
        </section>
        <section className="ms-section">
          <div className="ms-sec-head"><div><span className="ms-eyebrow">Fluxo</span><h2 className="ms-serif">Como atendemos</h2></div></div>
          <ol className="ms-timeline">
            <li><b>Você escolhe</b><span>Navegue por especialidade ou busque pelo código do material.</span></li>
            <li><b>Montamos o pedido</b><span>Revise quantidades, opções e observações antes de enviar.</span></li>
            <li><b>Confirmamos</b><span>A equipe valida disponibilidade e combina entrega e pagamento.</span></li>
          </ol>
        </section>
        <div className="ms-two" style={{ marginTop: 40 }}>
          <section className="ms-box">
            <h2 className="ms-serif">Horário de atendimento</h2>
            {hours.length ? <ul>{hours.map((h) => <li key={h.day}><span>{h.day}</span><span>{h.text}</span></li>)}</ul> : <p>Consulte os horários pelo WhatsApp.</p>}
          </section>
          <section className="ms-box">
            <h2 className="ms-serif">Contato</h2>
            {tenant.show_address && tenant.address && <a className="row" href={`https://maps.google.com/?q=${encodeURIComponent(tenant.address)}`} target="_blank" rel="noreferrer"><MapPin size={19} />{tenant.address}</a>}
            {wa && <a className="row" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={19} />WhatsApp</a>}
            {tenant.instagram_url && <a className="row" href={tenant.instagram_url} target="_blank" rel="noreferrer"><Instagram size={19} />Instagram</a>}
            {tenant.facebook_url && <a className="row" href={tenant.facebook_url} target="_blank" rel="noreferrer"><Facebook size={19} />Facebook</a>}
            {!wa && !tenant.instagram_url && !tenant.facebook_url && !(tenant.show_address && tenant.address) && <p>Envie seu pedido pelo carrinho e a equipe retornará o contato.</p>}
          </section>
        </div>
      </div>
    </main>
  );
}
