import { Link } from "react-router-dom";
import { ArrowRight, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit, whatsappLink } from "../street/kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, path, sf } = useKit();
  const about = tenant.about_text || "Brinquedos, jogos e presentes para acompanhar descobertas e criar memórias. Confira a faixa etária e as informações da embalagem para encontrar uma escolha para cada momento.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const image = tenant.banner_url || "/store-assets/toys-editorial-hero-v1.jpg";
  return <div className="toys-page toys-about">
    <StoreSEO title={`${sf.about_title || "Sobre a loja"} | ${tenant.name}`} description={about} image={image} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
    <div className="toys-about-grid">
      <div className="toys-about-image"><img className={tenant.banner_url ? "" : "toys-hero-default"} src={image} alt={`Campanha da ${tenant.name}`} /></div>
      <article className="toys-about-copy"><span className="toys-kicker">SOBRE A LOJA</span><h1>{sf.about_title || "Tempo para ser criança."}</h1><p>{about}</p><div className="toys-about-actions"><Link className="toys-btn toys-btn-solid toys-btn-lg" to={path("/catalogo")}>Explorar o catálogo <ArrowRight size={17} /></Link>{wa && <a className="toys-btn toys-btn-line toys-btn-lg" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Fale com a loja</a>}</div>{tenant.show_address && tenant.address && <p className="toys-about-addr"><MapPin size={17} />{tenant.address}</p>}</article>
    </div>
    <section className="toys-policies">{[["Entrega", tenant.policies?.shipping], ["Trocas e devoluções", tenant.policies?.returns], ["Trocas", tenant.policies?.exchange]].filter(([, text]) => text).map(([title, text]) => <article key={title}><h2>{title}</h2><p>{text}</p></article>)}</section>
  </div>;
}
