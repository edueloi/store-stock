import { Link } from "react-router-dom";
import { ArrowRight, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit, whatsappLink } from "./kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, path, sf } = useKit();
  const about = tenant.about_text || "Uma seleção de skincare, cosméticos e autocuidado para acompanhar os seus momentos. Acreditamos em escolhas conscientes e no valor de reservar um tempo para você.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const image = tenant.banner_url || "/store-assets/beauty-editorial-hero-v1.jpg";
  return <div className="bty-page bty-about">
    <StoreSEO title={`${sf.about_title || "Nossa essência"} | ${tenant.name}`} description={about} image={image} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
    <div className="bty-about-grid">
      <div className="bty-about-image"><img className={tenant.banner_url ? "" : "bty-hero-default"} src={image} alt={`A essência da ${tenant.name}`} /></div>
      <article className="bty-about-copy"><span className="bty-kicker">NOSSA ESSÊNCIA</span><h1>{sf.about_title || "O cuidado começa em você."}</h1><p>{about}</p><div className="bty-about-actions"><Link className="bty-btn bty-btn-solid bty-btn-lg" to={path("/catalogo")}>Descobrir os cuidados <ArrowRight size={17} /></Link>{wa && <a className="bty-btn bty-btn-line bty-btn-lg" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Fale com a loja</a>}</div>{tenant.show_address && tenant.address && <p className="bty-about-addr"><MapPin size={17} />{tenant.address}</p>}</article>
    </div>
    <section className="bty-policies">{[["Entrega", tenant.policies?.shipping], ["Trocas e devoluções", tenant.policies?.returns], ["Trocas", tenant.policies?.exchange]].filter(([, text]) => text).map(([title, text]) => <article key={title}><h2>{title}</h2><p>{text}</p></article>)}</section>
  </div>;
}
