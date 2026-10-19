import { Link } from "react-router-dom";
import { ArrowRight, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit, whatsappLink } from "../street/kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, path, sf } = useKit();
  const about = tenant.about_text || "Eletrônicos e acessórios para conectar trabalho, casa e diversão. Uma seleção para acompanhar as suas necessidades, com atendimento direto para ajudar você a escolher e confirmar a compatibilidade antes da compra.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const image = tenant.banner_url || "/store-assets/tech-editorial-hero-v1.jpg";
  return <div className="tp-page tp-about">
    <StoreSEO title={`${sf.about_title || "Sobre a loja"} | ${tenant.name}`} description={about} image={image} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
    <div className="tp-about-grid">
      <div className="tp-about-image"><img className={tenant.banner_url ? "" : "tp-hero-default"} src={image} alt={`A essência da ${tenant.name}`} /></div>
      <article className="tp-about-copy"><span className="tp-kicker">SOBRE A LOJA</span><h1>{sf.about_title || "Conecte o que importa."}</h1><p>{about}</p><div className="tp-about-actions"><Link className="tp-btn tp-btn-solid tp-btn-lg" to={path("/catalogo")}>Explorar tecnologia <ArrowRight size={17} /></Link>{wa && <a className="tp-btn tp-btn-line tp-btn-lg" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Fale com a loja</a>}</div>{tenant.show_address && tenant.address && <p className="tp-about-addr"><MapPin size={17} />{tenant.address}</p>}</article>
    </div>
    <section className="tp-policies">{[["Entrega", tenant.policies?.shipping], ["Trocas e devoluções", tenant.policies?.returns], ["Trocas", tenant.policies?.exchange]].filter(([, text]) => text).map(([title, text]) => <article key={title}><h2>{title}</h2><p>{text}</p></article>)}</section>
  </div>;
}
