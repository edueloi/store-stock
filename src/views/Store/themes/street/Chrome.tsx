import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Menu, Search, ShoppingBag, X, Zap } from "lucide-react";
import SiteFooter from "./SiteFooter";
import { categoryImage, useHeaderState } from "./shared";
import "./styles.css";

function Brand({ onClick }: { onClick?: () => void }) {
  const { tenant, path } = useHeaderState();
  return (
    <Link className="sd-brand" to={path()} aria-label={`${tenant.name} - página inicial`} onClick={onClick}>
      {tenant.logo_url ? (
        <img src={tenant.logo_url} alt="" />
      ) : (
        <span className="sd-brand-mark" aria-hidden="true">
          <Zap size={20} fill="currentColor" />
        </span>
      )}
      <span className="sd-brand-name">{tenant.name}</span>
    </Link>
  );
}

export function Header() {
  const h = useHeaderState();
  const { path, pathname, active, used, openCart, cartCount, menu, setMenu, term, setTerm, submit } = h;
  const [mega, setMega] = useState(false);
  useEffect(() => setMega(false), [pathname]);
  useEffect(() => {
    if (!mega) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMega(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [mega]);
  const nav = [
    { name: "Início", to: path(), on: !/catalogo|sobre|produto/.test(pathname) },
    { name: "Drops", to: path("/catalogo"), on: /catalogo|produto/.test(pathname) },
    { name: "Manifesto", to: path("/sobre"), on: /sobre/.test(pathname) },
  ];
  const count = (id: number) => active.filter((p) => p.category_id === id).length;

  return (
    <header className="sd-header">
      {mega && <button type="button" className="sd-scrim" aria-label="Fechar categorias" onClick={() => setMega(false)} />}
      <div className="sd-bar">
        <button type="button" className="sd-iconbtn sd-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu(!menu)}>
          {menu ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Brand />
        <nav className="sd-nav" aria-label="Principal">
          {nav.map((l) => (
            <Link key={l.to} to={l.to} aria-current={l.on ? "page" : undefined}>
              {l.name}
            </Link>
          ))}
          {used.length > 0 && (
            <button type="button" className="sd-nav-cats" aria-expanded={mega} aria-controls="sd-mega" onClick={() => setMega((v) => !v)}>
              Categorias <ChevronDown size={16} />
            </button>
          )}
        </nav>
        <form className="sd-search" role="search" onSubmit={submit}>
          <Search size={18} aria-hidden="true" />
          <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar peça, cor, modelo" aria-label="Buscar produtos" />
        </form>
        <button type="button" className="sd-cart" aria-label={`Abrir sacola, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`} onClick={openCart}>
          <ShoppingBag size={21} />
          <span className="sd-cart-count">{cartCount}</span>
        </button>
      </div>

      {mega && (
        <div className="sd-mega" id="sd-mega">
          <div className="sd-mega-head">
            <strong>Escolha por categoria</strong>
            <Link to={path("/catalogo")}>Ver todas as peças</Link>
          </div>
          <div className="sd-mega-grid">
            {used.slice(0, 8).map((c) => {
              const img = categoryImage(c, active);
              return (
                <Link key={c.id} className="sd-mega-item" to={path(`/catalogo?categoria=${c.id}`)}>
                  <span className="sd-mega-img">{img && <img src={img} alt="" loading="lazy" />}</span>
                  <span>
                    <b>{c.name}</b>
                    <small>{count(c.id)} peças</small>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {menu && (
        <div className="sd-drawer" role="dialog" aria-label="Menu">
          <button type="button" className="sd-drawer-bg" aria-label="Fechar menu" onClick={() => setMenu(false)} />
          <div className="sd-drawer-panel">
            <div className="sd-drawer-top">
              <Brand onClick={() => setMenu(false)} />
              <button type="button" className="sd-iconbtn" aria-label="Fechar menu" onClick={() => setMenu(false)}>
                <X size={22} />
              </button>
            </div>
            <form className="sd-search" role="search" onSubmit={submit}>
              <Search size={18} aria-hidden="true" />
              <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar peça" aria-label="Buscar produtos" />
            </form>
            <nav className="sd-drawer-nav" aria-label="Menu">
              {nav.map((l) => (
                <Link key={l.to} to={l.to} aria-current={l.on ? "page" : undefined}>
                  {l.name}
                </Link>
              ))}
            </nav>
            {used.length > 0 && (
              <div className="sd-drawer-cats">
                <p>Categorias</p>
                <div>
                  {used.slice(0, 12).map((c) => (
                    <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>
                      {c.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  return <SiteFooter t="sd" tagline="Moda de rua feita para quem vive a cidade." />;
}
