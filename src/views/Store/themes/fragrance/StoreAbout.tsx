import { Link } from "react-router-dom";
import { ArrowRight, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit, whatsappLink } from "./kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, path, sf } = useKit();
  const about = tenant.about_text || "Uma seleção de perfumes para acompanhar a sua história. Acreditamos na memória de um aroma, na escolha pessoal e nos pequenos gestos que marcam os seus momentos.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const image = tenant.banner_url || "/store-assets/fragrance-editorial-hero-v1.jpg";
  return <div className="frg-page frg-about">
    <StoreSEO title={`${sf.about_title || "Nossa essência"} | ${tenant.name}`} description={about} image={image} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
    <div className="frg-about-grid">
      <div className="frg-about-image"><img className={tenant.banner_url ? "" : "frg-hero-default"} src={image} alt={`A essência da ${tenant.name}`} /></div>
      <article className="frg-about-copy"><span className="frg-kicker">NOSSA ESSÊNCIA</span><h1>{sf.about_title || "Fragrâncias que contam histórias."}</h1><p>{about}</p><div className="frg-about-actions"><Link className="frg-btn frg-btn-solid frg-btn-lg" to={path("/catalogo")}>Explorar fragrâncias <ArrowRight size={17} /></Link>{wa && <a className="frg-btn frg-btn-line frg-btn-lg" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Fale com a loja</a>}</div>{tenant.show_address && tenant.address && <p className="frg-about-addr"><MapPin size={17} />{tenant.address}</p>}</article>
    </div>
    <section className="frg-policies">{[["Entrega", tenant.policies?.shipping], ["Trocas e devoluções", tenant.policies?.returns], ["Trocas", tenant.policies?.exchange]].filter(([, text]) => text).map(([title, text]) => <article key={title}><h2>{title}</h2><p>{text}</p></article>)}</section>
  </div>;
}
