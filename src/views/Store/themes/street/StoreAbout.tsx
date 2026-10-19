import { Link } from "react-router-dom";
import { ArrowRight, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit, whatsappLink } from "../street/kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, path, sf } = useKit();
  const about = tenant.about_text || "Camisetas, sneakers e peças que acompanham o ritmo da cidade. Uma seleção de moda urbana para expressar a sua identidade, com conforto e liberdade para fazer as suas próprias escolhas.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const image = tenant.banner_url || "/store-assets/street-editorial-hero-v1.jpg";
  return <div className="sd-page sd-about">
    <StoreSEO title={`${sf.about_title || "Nossa essência"} | ${tenant.name}`} description={about} image={image} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
    <div className="sd-about-grid">
      <div className="sd-about-image"><img className={tenant.banner_url ? "" : "sd-hero-default"} src={image} alt={`A essência da ${tenant.name}`} /></div>
      <article className="sd-about-copy"><span className="sd-kicker">NOSSA ESSÊNCIA</span><h1>{sf.about_title || "Da rua. Para o seu dia."}</h1><p>{about}</p><div className="sd-about-actions"><Link className="sd-btn sd-btn-solid sd-btn-lg" to={path("/catalogo")}>Explorar o drop <ArrowRight size={17} /></Link>{wa && <a className="sd-btn sd-btn-line sd-btn-lg" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Fale com a loja</a>}</div>{tenant.show_address && tenant.address && <p className="sd-about-addr"><MapPin size={17} />{tenant.address}</p>}</article>
    </div>
    <section className="sd-policies">{[["Entrega", tenant.policies?.shipping], ["Trocas e devoluções", tenant.policies?.returns], ["Trocas", tenant.policies?.exchange]].filter(([, text]) => text).map(([title, text]) => <article key={title}><h2>{title}</h2><p>{text}</p></article>)}</section>
  </div>;
}
