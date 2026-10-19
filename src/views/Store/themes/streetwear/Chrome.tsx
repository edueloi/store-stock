import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Menu, Search, ShoppingBag, X } from "lucide-react";
import SiteFooter from "../street/SiteFooter";
import { categoryImage, useHeaderState } from "../street/shared";
import "./styles.css";

export function Header() {
  const h = useHeaderState();
  const { tenant, path, pathname, active, used, openCart, cartCount, menu, setMenu, term, setTerm, submit } = h;
  const [panel, setPanel] = useState<"" | "cols" | "search">("");
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => setPanel(""), [pathname]);
  useEffect(() => {
    if (panel === "search") searchRef.current?.focus();
    if (!panel) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setPanel("");
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [panel]);
  const nav = [
    { name: "Loja", to: path("/catalogo"), on: /catalogo|produto/.test(pathname) },
    { name: "Sobre", to: path("/sobre"), on: /sobre/.test(pathname) },
  ];
  const count = (id: number) => active.filter((p) => p.category_id === id).length;

  return (
    <header className="sw-header">
      <div className="sw-bar">
        <div className="sw-side sw-left">
          <button type="button" className="sw-iconbtn sw-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu(!menu)}>
            {menu ? <X size={22} /> : <Menu size={22} />}
          </button>
          <nav className="sw-nav" aria-label="Principal">
            {nav.map((l) => (
              <Link key={l.to} to={l.to} aria-current={l.on ? "page" : undefined}>
                {l.name}
              </Link>
            ))}
            {used.length > 0 && (
              <button type="button" aria-expanded={panel === "cols"} onClick={() => setPanel(panel === "cols" ? "" : "cols")}>
                Coleções <ChevronDown size={15} />
              </button>
            )}
          </nav>
        </div>
        <Link className="sw-brand" to={path()} aria-label={`${tenant.name} - página inicial`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : null}
          <span>{tenant.name}</span>
        </Link>
        <div className="sw-side sw-right">
          <button type="button" className="sw-iconbtn" aria-label="Buscar" aria-expanded={panel === "search"} onClick={() => setPanel(panel === "search" ? "" : "search")}>
            <Search size={21} />
          </button>
          <button type="button" className="sw-iconbtn sw-cart" aria-label={`Abrir sacola, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`} onClick={openCart}>
            <ShoppingBag size={21} />
            <span className="sw-cart-count">{cartCount}</span>
          </button>
        </div>
      </div>

      {panel === "search" && (
        <div className="sw-panel">
          <form className="sw-bigsearch" role="search" onSubmit={submit}>
            <Search size={24} aria-hidden="true" />
            <input ref={searchRef} type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="O que você procura?" aria-label="Buscar produtos" />
            <button type="submit">Buscar</button>
          </form>
        </div>
      )}
      {panel === "cols" && (
        <div className="sw-panel">
          <div className="sw-cols">
            {used.slice(0, 12).map((c, i) => (
              <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>
                <small>{String(i + 1).padStart(2, "0")}</small>
                <span>{c.name}</span>
                <em>{count(c.id)}</em>
              </Link>
            ))}
          </div>
        </div>
      )}
      {panel && <button type="button" className="sw-scrim" aria-label="Fechar" onClick={() => setPanel("")} />}

      {menu && (
        <div className="sw-drawer" role="dialog" aria-label="Menu">
          <button type="button" className="sw-drawer-bg" aria-label="Fechar menu" onClick={() => setMenu(false)} />
          <div className="sw-drawer-panel">
            <form className="sw-bigsearch" role="search" onSubmit={submit}>
              <Search size={20} aria-hidden="true" />
              <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar" aria-label="Buscar produtos" />
            </form>
            <nav aria-label="Menu">
              <Link to={path()}>Início</Link>
              {nav.map((l) => (
                <Link key={l.to} to={l.to} aria-current={l.on ? "page" : undefined}>
                  {l.name}
                </Link>
              ))}
            </nav>
            {used.length > 0 && (
              <div className="sw-drawer-cols">
                <p>Coleções</p>
                {used.slice(0, 12).map((c, i) => (
                  <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>
                    <small>{String(i + 1).padStart(2, "0")}</small> {c.name}
                    <span className="sw-thumb">{categoryImage(c, active) && <img src={categoryImage(c, active)} alt="" loading="lazy" />}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  return <SiteFooter t="sw" tagline="Streetwear e skate com curadoria. Peças que contam uma história." />;
}
