import { Link } from "react-router-dom";
import { ArrowRight, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit, whatsappLink } from "../street/kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, path, sf } = useKit();
  const about = tenant.about_text || "Uma seleção de utilidades, presentes e objetos para o dia a dia. A Vitrine Mix reúne pequenas descobertas para organizar a rotina, cuidar da casa e encontrar algo especial.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const image = tenant.banner_url || "/store-assets/variety-editorial-hero-v1.jpg";
  return <div className="variety-page variety-about">
    <StoreSEO title={`${sf.about_title || "Sobre a loja"} | ${tenant.name}`} description={about} image={image} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
    <div className="variety-about-grid">
      <div className="variety-about-image"><img className={tenant.banner_url ? "" : "variety-hero-default"} src={image} alt={`Campanha da ${tenant.name}`} /></div>
      <article className="variety-about-copy"><span className="variety-kicker">SOBRE A LOJA</span><h1>{sf.about_title || "O útil também pode encantar."}</h1><p>{about}</p><div className="variety-about-actions"><Link className="variety-btn variety-btn-solid variety-btn-lg" to={path("/catalogo")}>Explorar o catálogo <ArrowRight size={17} /></Link>{wa && <a className="variety-btn variety-btn-line variety-btn-lg" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Fale com a loja</a>}</div>{tenant.show_address && tenant.address && <p className="variety-about-addr"><MapPin size={17} />{tenant.address}</p>}</article>
    </div>
    <section className="variety-policies">{[["Entrega", tenant.policies?.shipping], ["Trocas e devoluções", tenant.policies?.returns], ["Trocas", tenant.policies?.exchange]].filter(([, text]) => text).map(([title, text]) => <article key={title}><h2>{title}</h2><p>{text}</p></article>)}</section>
  </div>;
}
