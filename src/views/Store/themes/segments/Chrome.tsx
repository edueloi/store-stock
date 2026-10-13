import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowRight, Menu, Search, ShoppingBag, X } from "lucide-react";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import { segmentThemes, type SegmentId } from "./registry";
export function SegmentHeader() {
  const { tenant, templateId, categories, cart, openCart } = useStore();
  const { slug } = useParams();
  const { pathname, search: query } = useLocation();
  const preview = new URLSearchParams(query).get("previewTheme");
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const baseTheme = segmentThemes[templateId as SegmentId];
  const theme = {
    ...baseTheme,
    tag: tenant.policies?.storefront?.segment_label || baseTheme.tag,
  };
  const path = (p = "") => {
    const base = buildStorePath(resolveStoreSlug(slug), p);
    return preview
      ? `${base}${base.includes("?") ? "&" : "?"}previewTheme=${encodeURIComponent(preview)}`
      : base;
  };
  const links = [
    { name: "Início", to: path() },
    { name: "Catálogo", to: path("/catalogo") },
    { name: "Nossa loja", to: path("/sobre") },
  ];
  return (
    <header className={`seg-header seg-header-${theme.layout}`}>
      <div className="seg-announcement">
        {theme.tag}
        <Link to={path("/sobre")}>
          Conheça a loja <ArrowRight size={13} />
        </Link>
      </div>
      <div className="seg-header-main">
        <Link className="seg-brand" to={path()}>
          {tenant.logo_url && <img src={tenant.logo_url} alt="" />}
          <span>{tenant.name}</span>
        </Link>
        <nav className="seg-desktop-nav">
          {links.map((l) => (
            <Link
              key={l.to}
              aria-current={
                pathname === l.to.split("?")[0] ? "page" : undefined
              }
              to={l.to}
            >
              {l.name}
            </Link>
          ))}
        </nav>
        <div className="seg-header-actions">
          <button
            aria-label="Abrir busca"
            aria-expanded={search}
            onClick={() => setSearch((v) => !v)}
          >
            <Search size={21} />
          </button>
          <button aria-label="Abrir carrinho" onClick={openCart}>
            <ShoppingBag size={21} />
            <span>{cart.reduce((sum, p) => sum + p.quantity, 0)}</span>
          </button>
          <button
            className="seg-menu-button"
            aria-label="Abrir menu"
            aria-expanded={menu}
            onClick={() => setMenu((v) => !v)}
          >
            {menu ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>
      {search && (
        <form className="seg-header-search" action={path("/catalogo")}>
          {preview && (
            <input type="hidden" name="previewTheme" value={preview} />
          )}
          <label className="sr-only" htmlFor="seg-query">
            Buscar produto
          </label>
          <input
            id="seg-query"
            name="q"
            autoFocus
            placeholder="Nome ou código do produto"
          />
          <button className="seg-button" type="submit">
            Buscar
          </button>
        </form>
      )}
      {menu && (
        <nav className="seg-mobile-nav">
          {links.map((l) => (
            <Link key={l.to} to={l.to} onClick={() => setMenu(false)}>
              {l.name}
            </Link>
          ))}
        </nav>
      )}
      {["technical", "departments", "clinical", "mosaic"].includes(
        theme.layout,
      ) && (
        <nav className="seg-header-categories" aria-label="Departamentos">
          {categories.slice(0, 8).map((c) => (
            <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>
              {c.name}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
export function SegmentFooter() {
  const { tenant, templateId, categories } = useStore();
  const { slug } = useParams();
  const theme = segmentThemes[templateId as SegmentId];
  const preview = new URLSearchParams(useLocation().search).get("previewTheme");
  const path = (p = "") => {
    const base = buildStorePath(resolveStoreSlug(slug), p);
    return preview
      ? `${base}${base.includes("?") ? "&" : "?"}previewTheme=${encodeURIComponent(preview)}`
      : base;
  };
  return (
    <footer className={`seg-footer seg-footer-${theme.layout}`}>
      <div className="seg-footer-statement">
        <span className="seg-kicker">{tenant.name}</span>
        <h2>{tenant.hero_tagline || theme.hero}</h2>
        <Link className="seg-button" to={path("/catalogo")}>
          Explore o catálogo
          <ArrowRight size={17} />
        </Link>
      </div>
      <div className="seg-footer-links">
        <div>
          <h3>A loja</h3>
          <Link to={path("/sobre")}>Nossa história e atendimento</Link>
          {tenant.show_address && tenant.address && <p>{tenant.address}</p>}
          {tenant.whatsapp && (
            <a
              href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
            >
              Fale pelo WhatsApp
            </a>
          )}
        </div>
        <div>
          <h3>Catálogo</h3>
          {categories.slice(0, 5).map((c) => (
            <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>
              {c.name}
            </Link>
          ))}
        </div>
        <div>
          <h3>Informações</h3>
          <Link to={path("/sobre")}>Entrega, trocas e atendimento</Link>
          {tenant.instagram_url && (
            <a href={tenant.instagram_url} target="_blank" rel="noreferrer">
              Instagram
            </a>
          )}
          {tenant.facebook_url && (
            <a href={tenant.facebook_url} target="_blank" rel="noreferrer">
              Facebook
            </a>
          )}
        </div>
      </div>
      <p className="seg-footer-bottom">
        {tenant.footer_text ||
          `${tenant.name} · Produtos e atendimento da nossa loja.`}
      </p>
    </footer>
  );
}
