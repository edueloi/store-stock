import { Link } from "react-router-dom";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import SiteFooter from "../street/SiteFooter";
import { categoryImage, useHeaderState } from "../street/shared";
import "./styles.css";

export function Header() {
  const h = useHeaderState();
  const { tenant, path, pathname, active, used, openCart, cartCount, menu, setMenu, term, setTerm, submit } = h;
  const nav = [
    { name: "Início", to: path(), on: !/catalogo|sobre|produto/.test(pathname) },
    { name: "Catálogo", to: path("/catalogo"), on: /catalogo|produto/.test(pathname) && !/categoria=/.test(window.location.search) },
    { name: "Sobre", to: path("/sobre"), on: /sobre/.test(pathname) },
  ];
  const activeCat = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("categoria");
  return (
    <header className="ur-header">
      <div className="ur-top">
        <button type="button" className="ur-iconbtn ur-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu(!menu)}>
          {menu ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Link className="ur-brand" to={path()} aria-label={`${tenant.name} - página inicial`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="ur-brand-mark" aria-hidden="true">{tenant.name.slice(0, 1)}</span>}
          <span>{tenant.name}</span>
        </Link>
        <form className="ur-search" role="search" onSubmit={submit}>
          <Search size={20} aria-hidden="true" />
          <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar peças, marcas, estilos..." aria-label="Buscar produtos" />
          <button type="submit">Buscar</button>
        </form>
        <button type="button" className="ur-cart" aria-label={`Abrir sacola, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`} onClick={openCart}>
          <ShoppingBag size={21} />
          <span className="ur-cart-label">Sacola</span>
          <span className="ur-cart-count">{cartCount}</span>
        </button>
      </div>
      <nav className="ur-rail" aria-label="Principal e categorias">
        <div className="ur-rail-in">
          {nav.map((l) => (
            <Link key={l.to} to={l.to} className="ur-rail-main" aria-current={l.on ? "page" : undefined}>
              {l.name}
            </Link>
          ))}
          {used.length > 0 && <span className="ur-rail-sep" aria-hidden="true" />}
          {used.slice(0, 14).map((c) => (
            <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)} aria-current={activeCat === String(c.id) ? "page" : undefined}>
              {c.name}
            </Link>
          ))}
        </div>
      </nav>

      {menu && (
        <div className="ur-drawer" role="dialog" aria-label="Menu">
          <button type="button" className="ur-drawer-bg" aria-label="Fechar menu" onClick={() => setMenu(false)} />
          <div className="ur-drawer-panel">
            <div className="ur-drawer-top">
              <strong>Menu</strong>
              <button type="button" className="ur-iconbtn" aria-label="Fechar menu" onClick={() => setMenu(false)}>
                <X size={22} />
              </button>
            </div>
            <nav className="ur-drawer-nav" aria-label="Menu">
              {nav.map((l) => (
                <Link key={l.to} to={l.to} aria-current={l.on ? "page" : undefined}>
                  {l.name}
                </Link>
              ))}
            </nav>
            {used.length > 0 && (
              <>
                <p className="ur-drawer-title">Categorias</p>
                <div className="ur-drawer-cats">
                  {used.slice(0, 12).map((c) => (
                    <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>
                      <span className="ur-dot">{categoryImage(c, active) && <img src={categoryImage(c, active)} alt="" loading="lazy" />}</span>
                      {c.name}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  return <SiteFooter t="ur" tagline="Moda urbana, edições e looks para a cidade." />;
}
