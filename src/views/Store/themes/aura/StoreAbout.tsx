import { Link } from "react-router-dom";
import { ArrowRight, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit, whatsappLink } from "../street/kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, path, sf } = useKit();
  const about = tenant.about_text || "Moda para acompanhar os seus momentos com naturalidade. Uma seleção de roupas e acessórios para combinar texturas, criar novas composições e vestir o que faz sentido para você.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const image = tenant.banner_url || "/store-assets/aura-editorial-hero-v1.jpg";
  return <div className="au-page au-about">
    <StoreSEO title={`${sf.about_title || "Sobre a loja"} | ${tenant.name}`} description={about} image={image} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
    <div className="au-about-grid">
      <div className="au-about-image"><img className={tenant.banner_url ? "" : "au-hero-default"} src={image} alt={`Campanha da ${tenant.name}`} /></div>
      <article className="au-about-copy"><span className="au-kicker">SOBRE A LOJA</span><h1>{sf.about_title || "A sua forma de estar no mundo."}</h1><p>{about}</p><div className="au-about-actions"><Link className="au-btn au-btn-solid au-btn-lg" to={path("/catalogo")}>Explorar a coleção <ArrowRight size={17} /></Link>{wa && <a className="au-btn au-btn-line au-btn-lg" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Fale com a loja</a>}</div>{tenant.show_address && tenant.address && <p className="au-about-addr"><MapPin size={17} />{tenant.address}</p>}</article>
    </div>
    <section className="au-policies">{[["Entrega", tenant.policies?.shipping], ["Trocas e devoluções", tenant.policies?.returns], ["Trocas", tenant.policies?.exchange]].filter(([, text]) => text).map(([title, text]) => <article key={title}><h2>{title}</h2><p>{text}</p></article>)}</section>
  </div>;
}
