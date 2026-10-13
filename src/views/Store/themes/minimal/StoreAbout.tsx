import { Link } from "react-router-dom";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursRows, useKit } from "./kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, path, sf, waLink } = useKit();
  const hours = hoursRows(tenant);
  const title = sf.about_title || "Sobre";
  const text = tenant.about_text || `${tenant.name} reúne uma seleção de produtos pensada para ser simples de escolher e de comprar.`;
  return (
    <main className="mn-page">
      <StoreSEO title={`Sobre — ${tenant.name}`} description={text} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="mn-section mn-about">
        <h1>{title}<span className="mn-dot">.</span></h1>
        <p className="mn-about-lead">{text}</p>
        {tenant.banner_url && <img className="mn-about-img" src={tenant.banner_url} alt="" />}
        <dl className="mn-facts">
          {tenant.show_address && tenant.address && <div><dt>Endereço</dt><dd>{tenant.address}</dd></div>}
          {tenant.whatsapp && <div><dt>WhatsApp</dt><dd><a href={waLink()} target="_blank" rel="noreferrer">{tenant.whatsapp}</a></dd></div>}
          {tenant.instagram_url && <div><dt>Instagram</dt><dd><a href={tenant.instagram_url} target="_blank" rel="noreferrer">Abrir perfil</a></dd></div>}
          {tenant.facebook_url && <div><dt>Facebook</dt><dd><a href={tenant.facebook_url} target="_blank" rel="noreferrer">Abrir página</a></dd></div>}
          {hours.length > 0 && <div><dt>Horários</dt><dd>{hours.map((h) => <span key={h.day} className="mn-hour-line">{h.day} · {h.text}</span>)}</dd></div>}
        </dl>
        <Link className="mn-btn" to={path("/catalogo")}>Ver catálogo →</Link>
      </section>
    </main>
  );
}
