import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import { hoursRows, useKit, useUsedCategories } from "./kit";
import "./styles.css";

export function Header() {
  const { tenant, cartCount, openCart, path } = useKit();
  const cats = useUsedCategories();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => setMenu(false), [pathname, search]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(path(q ? `/catalogo?q=${encodeURIComponent(q)}` : "/catalogo"));
  };
  const cur = (to: string): "page" | undefined => (pathname === to.split("?")[0] ? "page" : undefined);
  const links = [
    { to: path(), label: "Início" },
    { to: path("/catalogo"), label: "Catálogo" },
    { to: path("/sobre"), label: "Sobre" },
  ];

  return (
    <div className="mn-header" role="banner">
      <div className="mn-bar">
        <Link to={path()} className="mn-brand" aria-label={`${tenant.name} — início`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt={tenant.name} /> : <span>{tenant.name}</span>}
        </Link>
        <nav className="mn-nav" aria-label="Principal">
          {links.map((l) => (
            <Link key={l.to} to={l.to} aria-current={cur(l.to)}>
              {l.label}
            </Link>
          ))}
        </nav>
        <form className="mn-search mn-search-bar" role="search" onSubmit={submit}>
          <Search size={16} aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar" aria-label="Buscar produtos" />
        </form>
        <button type="button" className="mn-icon" onClick={openCart} aria-label={`Abrir carrinho, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`}>
          <ShoppingBag size={20} strokeWidth={1.6} />
          {cartCount > 0 && <span className="mn-count">{cartCount}</span>}
        </button>
        <button type="button" className="mn-icon mn-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          {menu ? <X size={22} strokeWidth={1.6} /> : <Menu size={22} strokeWidth={1.6} />}
        </button>
      </div>
      {menu && (
        <div className="mn-drawer" role="dialog" aria-label="Menu">
          <form className="mn-search" role="search" onSubmit={submit}>
            <Search size={16} aria-hidden="true" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar" aria-label="Buscar produtos" />
          </form>
          <nav aria-label="Menu">
            {links.map((l) => (
              <Link key={l.to} to={l.to} aria-current={cur(l.to)}>
                {l.label}
              </Link>
            ))}
          </nav>
          {cats.length > 0 && (
            <>
              <p className="mn-drawer-title">Categorias</p>
              <nav className="mn-drawer-cats" aria-label="Categorias">
                {cats.slice(0, 12).map((c) => (
                  <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>
                    {c.name}
                  </Link>
                ))}
              </nav>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function Footer() {
  const { tenant, path, waLink } = useKit();
  const cats = useUsedCategories();
  const hours = hoursRows(tenant);
  return (
    <div className="mn-footer" role="contentinfo">
      <div className="mn-foot-grid">
        <section className="mn-foot-card mn-foot-about">
          <strong>{tenant.name}</strong>
          <p>{tenant.footer_text || tenant.about_text || "Uma seleção simples, feita para escolher com calma."}</p>
        </section>
        <section className="mn-foot-card">
          <h2>Navegar</h2>
          <Link to={path("/catalogo")}>Catálogo</Link>
          <Link to={path("/sobre")}>Sobre</Link>
          {cats.slice(0, 5).map((c) => (
            <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>
              {c.name}
            </Link>
          ))}
        </section>
        <section className="mn-foot-card">
          <h2>Contato</h2>
          {tenant.whatsapp && (
            <a href={waLink()} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          )}
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
          {tenant.show_address && tenant.address && <p>{tenant.address}</p>}
          {hours.length > 0 && (
            <ul className="mn-hours">
              {hours.map((h) => (
                <li key={h.day}>
                  <span>{h.day}</span> {h.text}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <p className="mn-credit">
        © {new Date().getFullYear()} {tenant.name} · Desenvolvido por{" "}
        <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">
          BoxSys
        </a>
      </p>
    </div>
  );
}
