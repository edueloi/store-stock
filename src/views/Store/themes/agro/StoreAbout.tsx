import { Link } from "react-router-dom";
import { ArrowRight, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit } from "./kit";
import { whatsappLink } from "./extras";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, path, config: sf } = useKit();
  const about = tenant.about_text || "Produtos para cuidar da propriedade, dos animais e da rotina de trabalho. Reunimos insumos, ferramentas e acessórios com atendimento próximo para ajudar você a encontrar o que precisa.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const image = tenant.banner_url || "/store-assets/agro-editorial-hero-v1.jpg";
  return <div className="agro-page agro-about">
    <StoreSEO title={`${sf.about_title || "Sobre a loja"} | ${tenant.name}`} description={about} image={image} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
    <div className="agro-about-grid">
      <div className="agro-about-image"><img className={tenant.banner_url ? "" : "agro-hero-default"} src={image} alt={`Campanha da ${tenant.name}`} /></div>
      <article className="agro-about-copy"><span className="agro-kicker">SOBRE A LOJA</span><h1>{sf.about_title || "Perto de quem faz o campo."}</h1><p>{about}</p><div className="agro-about-actions"><Link className="agro-btn agro-btn-solid agro-btn-lg" to={path("/catalogo")}>Explorar o campo <ArrowRight size={17} /></Link>{wa && <a className="agro-btn agro-btn-line agro-btn-lg" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Fale com a loja</a>}</div>{tenant.show_address && tenant.address && <p className="agro-about-addr"><MapPin size={17} />{tenant.address}</p>}</article>
    </div>
    <section className="agro-policies">{[["Entrega", tenant.policies?.shipping], ["Trocas e devoluções", tenant.policies?.returns], ["Trocas", tenant.policies?.exchange]].filter(([, text]) => text).map(([title, text]) => <article key={title}><h2>{title}</h2><p>{text}</p></article>)}</section>
  </div>;
}
