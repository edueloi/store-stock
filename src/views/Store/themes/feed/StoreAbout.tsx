import { Link } from "react-router-dom";
import { ArrowRight, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit } from "./kit";
import { whatsappLink } from "./extras";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, path, config: sf } = useKit();
  const about = tenant.about_text || "Alimentação e cuidados para os animais que fazem parte da sua vida. Nosso catálogo reúne rações, acessórios e produtos para pets e criação, com atendimento para conferir as informações de cada produto.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const image = tenant.banner_url || "/store-assets/feed-editorial-hero-v1.jpg";
  return <div className="feed-page feed-about">
    <StoreSEO title={`${sf.about_title || "Sobre a loja"} | ${tenant.name}`} description={about} image={image} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
    <div className="feed-about-grid">
      <div className="feed-about-image"><img className={tenant.banner_url ? "" : "feed-hero-default"} src={image} alt={`Campanha da ${tenant.name}`} /></div>
      <article className="feed-about-copy"><span className="feed-kicker">SOBRE A LOJA</span><h1>{sf.about_title || "Cuidado em cada escolha."}</h1><p>{about}</p><div className="feed-about-actions"><Link className="feed-btn feed-btn-solid feed-btn-lg" to={path("/catalogo")}>Explorar os cuidados <ArrowRight size={17} /></Link>{wa && <a className="feed-btn feed-btn-line feed-btn-lg" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Fale com a loja</a>}</div>{tenant.show_address && tenant.address && <p className="feed-about-addr"><MapPin size={17} />{tenant.address}</p>}</article>
    </div>
    <section className="feed-policies">{[["Entrega", tenant.policies?.shipping], ["Trocas e devoluções", tenant.policies?.returns], ["Trocas", tenant.policies?.exchange]].filter(([, text]) => text).map(([title, text]) => <article key={title}><h2>{title}</h2><p>{text}</p></article>)}</section>
  </div>;
}
