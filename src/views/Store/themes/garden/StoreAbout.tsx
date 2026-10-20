import { Link } from "react-router-dom";
import { ArrowRight, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit } from "./kit";
import { whatsappLink } from "./extras";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, path, config: sf } = useKit();
  const about = tenant.about_text || "Acreditamos no prazer de acompanhar a vida crescer. Reunimos plantas, sementes, vasos e ferramentas para a horta e o jardim, com uma seleção para quem está começando e para quem já cultiva todos os dias.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const image = tenant.banner_url || "/store-assets/garden-editorial-hero-v1.jpg";
  return <div className="garden-page garden-about">
    <StoreSEO title={`${sf.about_title || "Sobre a loja"} | ${tenant.name}`} description={about} image={image} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
    <div className="garden-about-grid">
      <div className="garden-about-image"><img className={tenant.banner_url ? "" : "garden-hero-default"} src={image} alt={`Campanha da ${tenant.name}`} /></div>
      <article className="garden-about-copy"><span className="garden-kicker">SOBRE A LOJA</span><h1>{sf.about_title || "Cultivar começa com cuidado."}</h1><p>{about}</p><div className="garden-about-actions"><Link className="garden-btn garden-btn-solid garden-btn-lg" to={path("/catalogo")}>Explorar o jardim <ArrowRight size={17} /></Link>{wa && <a className="garden-btn garden-btn-line garden-btn-lg" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Fale com a loja</a>}</div>{tenant.show_address && tenant.address && <p className="garden-about-addr"><MapPin size={17} />{tenant.address}</p>}</article>
    </div>
    <section className="garden-policies">{[["Entrega", tenant.policies?.shipping], ["Trocas e devoluções", tenant.policies?.returns], ["Trocas", tenant.policies?.exchange]].filter(([, text]) => text).map(([title, text]) => <article key={title}><h2>{title}</h2><p>{text}</p></article>)}</section>
  </div>;
}
