import { Link } from "react-router-dom";
import { Clock, Facebook, Heart, Instagram, MapPin, MessageCircle, Pencil, Printer } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { hoursRows, useKit } from "./kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, active, categories, path, sf, waLink } = useKit();
  const hours = hoursRows(tenant);
  const title = sf.about_title || `Um pouquinho sobre a ${tenant.name}`;
  const text = tenant.about_text || `${tenant.name} nasceu do gosto por papel, cor e boas ideias. Aqui você encontra itens de papelaria e impressos para organizar, presentear e criar.`;
  return (
    <main className="pp-page">
      <StoreSEO title={`Sobre — ${tenant.name}`} description={text} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="pp-section pp-about">
        <article className="pp-sheet pp-sheet-wide">
          <span className="pp-label pp-rot-l"><Pencil size={14} aria-hidden="true" /> sobre nós</span>
          <h1 className="pp-h1">{title}</h1>
          <p className="pp-about-text">{text}</p>
          <ul className="pp-stats">
            <li><b>{active.length}</b> produtos</li>
            <li><b>{categories.length}</b> divisórias</li>
            <li><Heart size={16} aria-hidden="true" /> feito à mão, com carinho</li>
          </ul>
          <div className="pp-actions">
            <Link className="pp-btn" to={path("/catalogo")}>Ver catálogo</Link>
            {tenant.whatsapp && <a className="pp-btn pp-btn-ghost" href={waLink()} target="_blank" rel="noreferrer"><MessageCircle size={16} aria-hidden="true" /> Chamar no WhatsApp</a>}
          </div>
        </article>
        <aside className="pp-about-side">
          {tenant.banner_url && <div className="pp-polaroid pp-polaroid-lg"><span className="pp-tape" aria-hidden="true" /><div className="pp-polaroid-img"><img src={tenant.banner_url} alt="" /></div></div>}
          <div className="pp-postit pp-note-yellow pp-tilt-1">
            <h2><Printer size={18} aria-hidden="true" /> Encomendas</h2>
            <p>Precisa de impressos ou algo personalizado? Fale com a loja e conte o que você imagina.</p>
          </div>
          <div className="pp-postit pp-note-mint pp-tilt-2">
            <h2><Clock size={18} aria-hidden="true" /> Horários</h2>
            {hours.length ? hours.map((h) => <p key={h.day} className="pp-hours"><span>{h.day}</span> {h.text}</p>) : <p>Consulte a loja pelo WhatsApp.</p>}
            {tenant.show_address && tenant.address && <p className="pp-addr"><MapPin size={14} aria-hidden="true" /> {tenant.address}</p>}
            <div className="pp-social pp-social-dark">
              {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>}
              {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={18} /></a>}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
