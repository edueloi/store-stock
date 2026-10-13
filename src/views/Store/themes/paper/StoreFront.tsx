import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle, Scissors, Star } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import Card from "./Card";
import { useKit } from "./kit";
import "./styles.css";

const FOLDERS = ["#ffd966", "#ff9ecb", "#8ee0c0", "#9ad0ff", "#ffb38a", "#c7b8ff"];

export default function StoreFront() {
  const { tenant, categories, active, path, sf, waLink } = useKit();
  const featured = active.filter((p) => p.is_featured);
  const showcase = (featured.length ? featured : active).slice(0, 8);
  const title = tenant.hero_tagline || "Anote, cole, imprima e crie do seu jeito";

  return (
    <main className="pp-page">
      <StoreSEO title={`${tenant.name} — Papelaria criativa`} description={tenant.hero_tagline || tenant.about_text || `Catálogo de ${tenant.name}`} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />

      <section className="pp-hero">
        <div className="pp-hero-copy">
          <span className="pp-label pp-rot-l"><Star size={14} aria-hidden="true" /> página 1</span>
          <h1>{title}</h1>
          <p>{tenant.about_text ? tenant.about_text.slice(0, 150) : "Cadernos, canetas, papéis e impressos para organizar a rotina e dar vida às suas ideias."}</p>
          <div className="pp-actions">
            <Link className="pp-btn" to={path("/catalogo")}>{sf.hero_button_label || "Abrir o catálogo"} <ArrowRight size={16} aria-hidden="true" /></Link>
            {tenant.whatsapp && <a className="pp-btn pp-btn-ghost" href={waLink("Olá! Quero fazer um pedido personalizado.")} target="_blank" rel="noreferrer"><MessageCircle size={16} aria-hidden="true" /> Pedido personalizado</a>}
          </div>
        </div>
        <div className="pp-hero-art">
          <div className="pp-polaroid">
            {tenant.banner_url ? <img src={tenant.banner_url} alt={tenant.name} /> : <div className="pp-doodle" aria-hidden="true"><span className="pp-d-pencil" /><span className="pp-d-circle" /><span className="pp-d-star">★</span></div>}
            <p>{tenant.name}</p>
          </div>
          <span className="pp-sticker pp-sticker-big pp-rot-r">feito com carinho</span>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="pp-section">
          <h2 className="pp-title"><span>{sf.home_categories_title || "Divisórias do caderno"}</span></h2>
          <div className="pp-folders">
            {categories.slice(0, 8).map((c, i) => (
              <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)} className="pp-folder" style={{ ["--tab" as string]: FOLDERS[i % FOLDERS.length] }}>
                <span className="pp-folder-tab">{String(i + 1).padStart(2, "0")}</span>
                {c.cover_url && <img src={c.cover_url} alt="" loading="lazy" />}
                <b>{c.name}</b>
                <small>{active.filter((p) => p.category_id === c.id).length} itens</small>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="pp-section">
        <h2 className="pp-title"><span>{sf.home_featured_title || "Recadinhos em destaque"}</span></h2>
        {showcase.length ? (
          <div className="pp-grid">{showcase.map((p, i) => <Card key={p.id} product={p} index={i} />)}</div>
        ) : (
          <p className="pp-empty">As folhas ainda estão em branco. Os produtos aparecem aqui assim que forem cadastrados.</p>
        )}
        <p className="pp-center"><Link className="pp-btn" to={path("/catalogo")}>Ver tudo <ArrowRight size={16} aria-hidden="true" /></Link></p>
      </section>

      <section className="pp-cutout">
        <Scissors size={22} aria-hidden="true" />
        <div>
          <h2>Precisa de algo sob medida?</h2>
          <p>Convites, adesivos, cartões e impressos: conte sua ideia e a gente ajuda a transformar em papel.</p>
        </div>
        <Link className="pp-btn" to={path("/sobre")}>Conheça a loja</Link>
      </section>
    </main>
  );
}
