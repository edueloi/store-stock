import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, Search, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { hoursRows, useKit } from "./kit";
import "./styles.css";

export function Header() {
  const { tenant, categories, cartCount, openCart, path } = useKit();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [find, setFind] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setMenu(false);
    setFind(false);
  }, [pathname, search]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(path(q ? `/catalogo?q=${encodeURIComponent(q)}` : "/catalogo"));
  };
  const cur = (to: string): "page" | undefined => (pathname === to.split("?")[0] ? "page" : undefined);

  return (
    <header className="mn-header">
      <div className="mn-bar">
        <nav className="mn-nav" aria-label="Principal">
          <button className="mn-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => { setMenu((v) => !v); setFind(false); }}>
            {menu ? <X size={22} /> : <Menu size={22} />}
          </button>
          <Link to={path()} aria-current={cur(path())} className="mn-hide-m">Início</Link>
          <Link to={path("/catalogo")} aria-current={cur(path("/catalogo"))} className="mn-hide-m">Catálogo</Link>
          <Link to={path("/sobre")} aria-current={cur(path("/sobre"))} className="mn-hide-m">Sobre</Link>
        </nav>
        <Link to={path()} className="mn-brand" aria-label={`${tenant.name} — início`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt={tenant.name} /> : <span>{tenant.name}</span>}
        </Link>
        <div className="mn-tools">
          <button className="mn-link" aria-label={find ? "Fechar busca" : "Abrir busca"} aria-expanded={find} onClick={() => { setFind((v) => !v); setMenu(false); }}>
            {find ? <X size={20} /> : <Search size={20} />}
          </button>
          <button className="mn-link mn-cart" onClick={openCart} aria-label={`Abrir carrinho, ${cartCount} itens`}>
            <span className="mn-hide-m">Carrinho</span> <span className="mn-count">{cartCount}</span>
          </button>
        </div>
      </div>
      {find && (
        <form className="mn-drop mn-find" onSubmit={submit} role="search">
          <SearchBar value={query} onChange={setQuery} placeholder="Buscar produtos" />
          <button type="submit" className="mn-btn">Buscar</button>
        </form>
      )}
      {menu && (
        <div className="mn-drop mn-menu" role="dialog" aria-label="Menu">
          <Link to={path()}>Início</Link>
          <Link to={path("/catalogo")}>Catálogo</Link>
          <Link to={path("/sobre")}>Sobre</Link>
          {categories.length > 0 && <p>Categorias</p>}
          {categories.map((c) => <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>{c.name}</Link>)}
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant, path, waLink } = useKit();
  const hours = hoursRows(tenant);
  return (
    <footer className="mn-footer">
      <div className="mn-foot-in">
        <span className="mn-foot-name">{tenant.name}</span>
        <span className="mn-foot-text">{tenant.footer_text || tenant.about_text || ""}</span>
        <nav aria-label="Rodapé">
          <Link to={path("/catalogo")}>Catálogo</Link>
          <Link to={path("/sobre")}>Sobre</Link>
          {tenant.whatsapp && <a href={waLink()} target="_blank" rel="noreferrer">WhatsApp</a>}
          {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer">Instagram</a>}
          {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer">Facebook</a>}
          {hours.length > 0 && (
            <details className="mn-hours">
              <summary>Horários</summary>
              <ul>{hours.map((h) => <li key={h.day}><span>{h.day}</span> {h.text}</li>)}</ul>
            </details>
          )}
        </nav>
        {tenant.show_address && tenant.address && <span className="mn-foot-text mn-foot-addr">{tenant.address}</span>}
        <span className="mn-credit">BoxSys</span>
      </div>
    </footer>
  );
}
