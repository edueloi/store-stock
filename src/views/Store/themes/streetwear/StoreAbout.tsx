import { Link } from "react-router-dom";
import { ArrowRight, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit, whatsappLink } from "../street/kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, path, sf } = useKit();
  const about = tenant.about_text || "Streetwear e skate fazem parte de um jeito livre de viver. Reunimos camisetas, calçados e peças versáteis para o seu dia a dia, com espaço para a sua personalidade e para os caminhos que você escolher.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const image = tenant.banner_url || "/store-assets/streetwear-editorial-hero-v1.jpg";
  return <div className="sw-page sw-about">
    <StoreSEO title={`${sf.about_title || "Nossa essência"} | ${tenant.name}`} description={about} image={image} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
    <div className="sw-about-grid">
      <div className="sw-about-image"><img className={tenant.banner_url ? "" : "sw-hero-default"} src={image} alt={`A essência da ${tenant.name}`} /></div>
      <article className="sw-about-copy"><span className="sw-kicker">NOSSA ESSÊNCIA</span><h1>{sf.about_title || "Feito para acompanhar você."}</h1><p>{about}</p><div className="sw-about-actions"><Link className="sw-btn sw-btn-solid sw-btn-lg" to={path("/catalogo")}>Conhecer a coleção <ArrowRight size={17} /></Link>{wa && <a className="sw-btn sw-btn-line sw-btn-lg" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Fale com a loja</a>}</div>{tenant.show_address && tenant.address && <p className="sw-about-addr"><MapPin size={17} />{tenant.address}</p>}</article>
    </div>
    <section className="sw-policies">{[["Entrega", tenant.policies?.shipping], ["Trocas e devoluções", tenant.policies?.returns], ["Trocas", tenant.policies?.exchange]].filter(([, text]) => text).map(([title, text]) => <article key={title}><h2>{title}</h2><p>{text}</p></article>)}</section>
  </div>;
}
