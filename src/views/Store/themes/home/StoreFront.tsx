import { Link } from "react-router-dom";
import { ArrowRight, Home, MessageCircle, Ruler, Search, ShieldCheck, Store, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import Card from "./Card";
import { useKit } from "./kit";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, path, sf, waLink, preview } = useKit();
  const featured = active.filter((p) => p.is_featured);
  const showcase = (featured.length ? featured : active).slice(0, 8);
  const counts = (id: number) => active.filter((p) => p.category_id === id).length;
  const title = tenant.hero_tagline || "Tudo para construir, reformar e decorar a sua casa";

  return (
    <main className="hm-page">
      <StoreSEO title={`${tenant.name} — Casa e construção`} description={tenant.hero_tagline || tenant.about_text || `Catálogo de ${tenant.name}`} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />

      <section className="hm-hero">
        <div className="hm-wrap hm-hero-grid">
          <div className="hm-hero-copy">
            <p className="hm-kicker"><Home size={14} aria-hidden="true" /> Casa &amp; Construção</p>
            <h1>{title}</h1>
            <p className="hm-hero-sub">{tenant.about_text ? tenant.about_text.slice(0, 160) : "Materiais, acabamentos e decoração organizados por cômodo. Encontre, escolha as opções e monte seu pedido."}</p>
            <form className="hm-measure" action={path("/catalogo").split("?")[0]} role="search">
              <label htmlFor="hm-hero-q"><Ruler size={16} aria-hidden="true" /> Busque por produto ou medida</label>
              <div>
                <input id="hm-hero-q" name="q" placeholder="Ex.: porcelanato 60x60, torneira, tinta..." />
                {preview && <input type="hidden" name="previewTheme" value={preview} />}
                <button className="hm-btn hm-btn-accent" type="submit"><Search size={16} aria-hidden="true" /> Buscar</button>
              </div>
            </form>
            <div className="hm-hero-links">
              <Link className="hm-btn hm-btn-dark" to={path("/catalogo")}>{sf.hero_button_label || "Ver catálogo"} <ArrowRight size={16} aria-hidden="true" /></Link>
              {tenant.whatsapp && <a className="hm-btn hm-btn-line" href={waLink("Olá! Preciso de ajuda para escolher um produto.")} target="_blank" rel="noreferrer"><MessageCircle size={16} aria-hidden="true" /> Falar no WhatsApp</a>}
            </div>
          </div>
          <div className="hm-hero-scene">
            {tenant.banner_url ? <img src={tenant.banner_url} alt={`Ambientes ${tenant.name}`} /> : (
              <div className="hm-scene-art" aria-hidden="true">
                <span className="hm-scene-win" /><span className="hm-scene-sofa" /><span className="hm-scene-lamp" /><span className="hm-scene-floor" />
              </div>
            )}
          </div>
        </div>
        <div className="hm-wrap hm-perks">
          <p><Store size={20} aria-hidden="true" /><span><b>Retire na loja</b>Separamos o pedido para você</span></p>
          <p><Truck size={20} aria-hidden="true" /><span><b>{sf.shipping_status === "enabled" ? "Entrega disponível" : "Entrega sob consulta"}</b>Combine com a loja</span></p>
          <p><ShieldCheck size={20} aria-hidden="true" /><span><b>Atendimento direto</b>Tire dúvidas antes de comprar</span></p>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="hm-section">
          <div className="hm-wrap">
            <div className="hm-head">
              <h2>{sf.home_categories_title || "Compre por cômodo"}</h2>
              <Link to={path("/catalogo")}>Todos os departamentos <ArrowRight size={14} aria-hidden="true" /></Link>
            </div>
            <div className="hm-rooms">
              {categories.slice(0, 8).map((c, i) => (
                <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)} className={`hm-room hm-room-${i % 4}`}>
                  {c.cover_url && <img src={c.cover_url} alt="" loading="lazy" />}
                  <span className="hm-room-n">{String(i + 1).padStart(2, "0")}</span>
                  <span className="hm-room-name">{c.name}</span>
                  <span className="hm-room-count">{counts(c.id)} {counts(c.id) === 1 ? "produto" : "produtos"}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="hm-section hm-section-concrete">
        <div className="hm-wrap">
          <div className="hm-head">
            <h2>{sf.home_featured_title || "Em destaque na loja"}</h2>
            <Link to={path("/catalogo")}>Ver tudo <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
          {showcase.length ? (
            <div className="hm-grid">{showcase.map((p) => <Card key={p.id} product={p} />)}</div>
          ) : (
            <p className="hm-empty">Os produtos aparecerão aqui assim que forem cadastrados.</p>
          )}
        </div>
      </section>

      <section className="hm-cta">
        <div className="hm-wrap">
          <h2>Não achou a medida ou o material que precisa?</h2>
          <p>Fale com a loja e peça orientação antes de fechar o pedido.</p>
          <Link className="hm-btn hm-btn-accent" to={path("/sobre")}>Conheça a loja</Link>
        </div>
      </section>
    </main>
  );
}
