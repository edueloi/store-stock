import { Link } from "react-router-dom";
import { ArrowRight, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit, whatsappLink } from "./kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, path, sf } = useKit();
  const about = tenant.about_text || "Uma seleção de livros e cultura para quem valoriza o tempo de uma boa leitura. Reunimos histórias, ideias e descobertas para fazer parte da sua estante e acompanhar diferentes momentos da sua vida.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const image = tenant.banner_url || "/store-assets/books-editorial-hero-v1.jpg";
  return <div className="bk-page bk-about">
    <StoreSEO title={`${sf.about_title || "Nossa história"} | ${tenant.name}`} description={about} image={image} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
    <div className="bk-about-grid">
      <div className="bk-about-image"><img className={tenant.banner_url ? "" : "bk-hero-default"} src={image} alt={`A essência da ${tenant.name}`} /></div>
      <article className="bk-about-copy"><span className="bk-kicker">NOSSA HISTÓRIA</span><h1>{sf.about_title || "Histórias que aproximam."}</h1><p>{about}</p><div className="bk-about-actions"><Link className="bk-btn bk-btn-solid bk-btn-lg" to={path("/catalogo")}>Explorar a estante <ArrowRight size={17} /></Link>{wa && <a className="bk-btn bk-btn-line bk-btn-lg" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Fale com a loja</a>}</div>{tenant.show_address && tenant.address && <p className="bk-about-addr"><MapPin size={17} />{tenant.address}</p>}</article>
    </div>
    <section className="bk-policies">{[["Entrega", tenant.policies?.shipping], ["Trocas e devoluções", tenant.policies?.returns], ["Trocas", tenant.policies?.exchange]].filter(([, text]) => text).map(([title, text]) => <article key={title}><h2>{title}</h2><p>{text}</p></article>)}</section>
  </div>;
}
