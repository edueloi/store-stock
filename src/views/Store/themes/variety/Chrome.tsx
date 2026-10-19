import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Grid2x2, Instagram, Menu, MessageCircle, Search, ShoppingBag, Store, X } from "lucide-react";
import { useVariety } from "./ThemeParts";
import "./styles.css";

export function Header() {
  const { tenant, usedCategories, cartCount, openCart, path } = useVariety();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [mega, setMega] = useState(false);

  useEffect(() => {
    setDrawer(false);
    setMega(false);
  }, [pathname, search]);

  useEffect(() => {
    if (!mega) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMega(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mega]);

  const links = [
    { label: "Início", to: path(), on: !/catalogo|sobre|produto/.test(pathname) },
    { label: "Catálogo", to: path("/catalogo"), on: /catalogo|produto/.test(pathname) },
    { label: "Nossa loja", to: path("/sobre"), on: /sobre/.test(pathname) },
  ];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = query.trim();
    setDrawer(false);
    navigate(path(term ? `/catalogo?q=${encodeURIComponent(term)}` : "/catalogo"));
  };

  return (
    <header className="variety-header">
      <div className="variety-wrap variety-mainbar">
        <button type="button" className="variety-icon-btn variety-burger" aria-label={drawer ? "Fechar menu" : "Abrir menu"} aria-expanded={drawer} onClick={() => setDrawer((v) => !v)}>
          {drawer ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Link to={path()} className="variety-brand" aria-label={`${tenant.name} - início`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="variety-brand-mark"><Store size={21} /></span>}
          <span>{tenant.name}</span>
        </Link>
        <form className="variety-search" role="search" onSubmit={submit}>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="O que você está procurando?" aria-label="Buscar produtos" />
          <button type="submit" aria-label="Buscar"><Search size={18} /></button>
        </form>
        <button type="button" className="variety-cart" onClick={openCart} aria-label={`Abrir pedido, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`}>
          <ShoppingBag size={20} />
          <span className="variety-cart-label">Meu pedido</span>
          <b>{cartCount}</b>
        </button>
      </div>

      <div className="variety-wrap variety-navwrap">
        <nav className="variety-nav" aria-label="Principal">
          {usedCategories.length > 0 && (
            <button type="button" className="variety-mega-btn" aria-expanded={mega} aria-controls="variety-mega" onClick={() => setMega((v) => !v)}>
              <Grid2x2 size={17} /> Departamentos <ChevronDown size={15} className={mega ? "is-flip" : ""} />
            </button>
          )}
          {links.map((l) => (
            <Link key={l.label} to={l.to} aria-current={l.on ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        {mega && (
          <div id="variety-mega" className="variety-mega">
            <p className="variety-mega-title">Compre por departamento</p>
            <div className="variety-mega-grid">
              {usedCategories.slice(0, 15).map((c, i) => (
                <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className={`variety-mega-item variety-c${i % 6}`}>
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {drawer && (
        <div className="variety-drawer">
          <form className="variety-search" role="search" onSubmit={submit}>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar produtos" aria-label="Buscar produtos" />
            <button type="submit" aria-label="Buscar"><Search size={18} /></button>
          </form>
          <nav aria-label="Menu">
            {links.map((l) => (
              <Link key={l.label} to={l.to} aria-current={l.on ? "page" : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>
          {usedCategories.length > 0 && (
            <>
              <p className="variety-mega-title">Departamentos</p>
              <div className="variety-mega-grid">
                {usedCategories.slice(0, 12).map((c, i) => (
                  <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className={`variety-mega-item variety-c${i % 6}`}>
                    {c.name}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant, usedCategories, path, whatsapp } = useVariety();
  return (
    <footer className="variety-footer">
      <div className="variety-wrap">
        <div className="variety-footer-grid">
          <section className="variety-foot-card variety-foot-about">
            <Link to={path()} className="variety-brand">
              {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="variety-brand-mark"><Store size={21} /></span>}
              <span>{tenant.name}</span>
            </Link>
            <p>{tenant.footer_text || tenant.about_text || "Utilidades, presentes e produtos para deixar o dia a dia mais fácil."}</p>
            <div className="variety-socials">
              {tenant.instagram_url && (
                <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>
              )}
              {whatsapp && (
                <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={18} /></a>
              )}
            </div>
          </section>
          <section className="variety-foot-card">
            <h3>Explore</h3>
            <Link to={path()}>Início</Link>
            <Link to={path("/catalogo")}>Todos os produtos</Link>
            <Link to={path("/sobre")}>Nossa loja</Link>
          </section>
          {usedCategories.length > 0 && (
            <section className="variety-foot-card">
              <h3>Departamentos</h3>
              {usedCategories.slice(0, 6).map((c) => (
                <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link>
              ))}
            </section>
          )}
          <section className="variety-foot-card">
            <h3>Fale com a loja</h3>
            {tenant.show_address && tenant.address && <p>{tenant.address}</p>}
            {whatsapp && (
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">Atendimento pelo WhatsApp</a>
            )}
          </section>
        </div>
        <p className="variety-credit">
          © {new Date().getFullYear()} {tenant.name} · Powered by{" "}
          <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a>
        </p>
      </div>
    </footer>
  );
}
