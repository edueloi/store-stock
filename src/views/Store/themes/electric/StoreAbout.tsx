import { Link } from "react-router-dom";
import { ArrowRight, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit, whatsappLink } from "../street/kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, path, sf } = useKit();
  const about = tenant.about_text || "Materiais elétricos, acessórios e iluminação em um catálogo para consultar com atenção. Confira medidas, tensão e as informações técnicas de cada item antes de escolher.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const image = tenant.banner_url || "/store-assets/electric-editorial-hero-v1.jpg";
  return <div className="ep-page ep-about">
    <StoreSEO title={`${sf.about_title || "Sobre a loja"} | ${tenant.name}`} description={about} image={image} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
    <div className="ep-about-grid">
      <div className="ep-about-image"><img className={tenant.banner_url ? "" : "ep-hero-default"} src={image} alt={`Campanha da ${tenant.name}`} /></div>
      <article className="ep-about-copy"><span className="ep-kicker">SOBRE A LOJA</span><h1>{sf.about_title || "Cada detalhe do seu projeto."}</h1><p>{about}</p><div className="ep-about-actions"><Link className="ep-btn ep-btn-solid ep-btn-lg" to={path("/catalogo")}>Explorar o catálogo <ArrowRight size={17} /></Link>{wa && <a className="ep-btn ep-btn-line ep-btn-lg" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Fale com a loja</a>}</div>{tenant.show_address && tenant.address && <p className="ep-about-addr"><MapPin size={17} />{tenant.address}</p>}</article>
    </div>
    <section className="ep-policies">{[["Entrega", tenant.policies?.shipping], ["Trocas e devoluções", tenant.policies?.returns], ["Trocas", tenant.policies?.exchange]].filter(([, text]) => text).map(([title, text]) => <article key={title}><h2>{title}</h2><p>{text}</p></article>)}</section>
  </div>;
}
