import { Link } from "react-router-dom";
import { ArrowRight, Headphones, ShieldCheck, Store, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { Card } from "./parts";
import { whatsappLink, useKit } from "./kit";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, path, sf } = useKit();
  const wa = whatsappLink(tenant);
  const featured = active.filter((p) => p.is_featured);
  const limit = tenant.featured_limit && tenant.featured_limit > 0 ? Math.min(tenant.featured_limit, 8) : 8;
  const best = (featured.length ? featured : active).slice(0, limit);
  const bestIds = new Set(best.map((p) => p.id));
  const newest = [...active].sort((a, b) => b.id - a.id);
  const launches = [...newest.filter((p) => !bestIds.has(p.id)), ...newest.filter((p) => bestIds.has(p.id))].slice(0, 4);
  const withProducts = categories.filter((c) => active.some((p) => p.category_id === c.id));
  const catImage = (id: number) => {
    const p = active.find((x) => x.category_id === id && (x.images?.[0] || x.image_url));
    return p ? p.images?.[0] || p.image_url : "";
  };
  const benefits = [
    { icon: Truck, title: "Retirada ou entrega", text: "Combine a melhor forma de receber seu pedido." },
    { icon: Headphones, title: "Atendimento humano", text: wa ? "Tire dúvidas direto pelo WhatsApp." : "Fale com a loja antes de comprar." },
    { icon: ShieldCheck, title: "Compra segura", text: "Pedido acompanhado do carrinho ao atendimento." },
  ];
  const about = tenant.about_text || "";

  return (
    <div className="dfl-page">
      <StoreSEO title={`${tenant.name} — Loja online`} description={tenant.hero_tagline || about || `Conheça os produtos da ${tenant.name}.`} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />

      <section className="dfl-hero" style={tenant.banner_url ? { backgroundImage: `url(${tenant.banner_url})` } : undefined}>
        <div className="dfl-hero-shade" />
        <div className="dfl-wrap dfl-hero-in">
          <div className="dfl-hero-card">
            <span className="dfl-hero-kicker">{sf.segment_label || "Bem-vindo à loja"}</span>
            <h1>{tenant.hero_tagline || tenant.name}</h1>
            <p>{about ? about.slice(0, 140) + (about.length > 140 ? "…" : "") : "Confira nossos produtos e monte seu pedido com praticidade."}</p>
            <Link to={path("/catalogo")} className="dfl-btn dfl-btn-inline">{sf.hero_button_label || "Ver produtos"} <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>

      <div className="dfl-wrap">
        <ul className="dfl-benefits">
          {benefits.map(({ icon: Icon, title, text }) => (
            <li key={title}><Icon size={28} strokeWidth={1.6} /><div><strong>{title}</strong><span>{text}</span></div></li>
          ))}
        </ul>

        {withProducts.length > 0 && (
          <section className="dfl-section">
            <div className="dfl-section-head"><h2>{sf.home_categories_title || "Compre por categoria"}</h2><Link to={path("/catalogo")}>Ver tudo</Link></div>
            <div className="dfl-cat-grid">
              {withProducts.slice(0, 8).map((c) => {
                const img = c.cover_url || catImage(c.id);
                return (
                  <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className="dfl-cat">
                    <span className="dfl-cat-pic">{img ? <img src={img} alt="" loading="lazy" /> : <Store size={26} />}</span>
                    <span>{c.name}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {best.length > 0 && (
          <section className="dfl-section">
            <div className="dfl-section-head"><h2>{sf.home_featured_title || "Mais vendidos"}</h2><Link to={path("/catalogo")}>Ver todos</Link></div>
            <div className="dfl-grid">{best.map((p) => <Card key={p.id} product={p} />)}</div>
          </section>
        )}
      </div>

      {active.length > 4 && (
        <section className="dfl-promo">
          <div className="dfl-wrap dfl-promo-in">
            <div>
              <h2>{sf.catalog_title || "Todo o catálogo em um só lugar"}</h2>
              <p>{sf.catalog_description || "Filtre por categoria, ordene por preço e encontre o que precisa."}</p>
            </div>
            <Link to={path("/catalogo")} className="dfl-btn dfl-btn-inline dfl-btn-light">Explorar catálogo <ArrowRight size={16} /></Link>
          </div>
        </section>
      )}

      {launches.length > 0 && (
        <div className="dfl-wrap">
          <section className="dfl-section">
            <div className="dfl-section-head"><h2>Lançamentos</h2><Link to={path("/catalogo")}>Ver mais</Link></div>
            <div className="dfl-grid">{launches.map((p) => <Card key={p.id} product={p} />)}</div>
          </section>
        </div>
      )}

      {active.length === 0 && (
        <div className="dfl-wrap"><p className="dfl-note">Em breve novos produtos por aqui.</p></div>
      )}
    </div>
  );
}
