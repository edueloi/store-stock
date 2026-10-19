import { Link } from "react-router-dom";
import { ArrowRight, MapPin, MessageCircle } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit, whatsappLink } from "../street/kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, path, sf } = useKit();
  const about = tenant.about_text || "Acreditamos em peças que fazem parte da sua vida. Roupas, calçados e acessórios que combinam conforto, personalidade e a liberdade de vestir o que faz sentido para você.";
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const image = tenant.banner_url || "/store-assets/urban-editorial-hero-v1.jpg";
  return <div className="ur-page ur-about">
    <StoreSEO title={`${sf.about_title || "Nossa essência"} | ${tenant.name}`} description={about} image={image} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
    <div className="ur-about-grid">
      <div className="ur-about-image"><img className={tenant.banner_url ? "" : "ur-hero-default"} src={image} alt={`A essência da ${tenant.name}`} /></div>
      <article className="ur-about-copy"><span className="ur-kicker">NOSSA ESSÊNCIA</span><h1>{sf.about_title || "Estilo que faz parte de você."}</h1><p>{about}</p><div className="ur-about-actions"><Link className="ur-btn ur-btn-solid ur-btn-lg" to={path("/catalogo")}>Conheça a coleção <ArrowRight size={17} /></Link>{wa && <a className="ur-btn ur-btn-line ur-btn-lg" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Fale com a loja</a>}</div>{tenant.show_address && tenant.address && <p className="ur-about-addr"><MapPin size={17} />{tenant.address}</p>}</article>
    </div>
  </div>;
}
