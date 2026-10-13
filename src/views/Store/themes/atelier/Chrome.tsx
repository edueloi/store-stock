import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Facebook, Instagram, Menu, MessageCircle, Search, ShoppingBag, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { cartCount, hoursList, useKit, whatsappLink } from "./kit";
import "./styles.css";

export function Header() {
  const { tenant, categories, cart, openCart, path } = useKit();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [menu, setMenu] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const count = cartCount(cart);

  useEffect(() => { setMenu(false); setSearching(false); }, [pathname, search]);
  useEffect(() => {
    if (searching) panel.current?.querySelector("input")?.focus();
  }, [searching]);
  useEffect(() => {
    if (!menu && !searching) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenu(false); setSearching(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu, searching]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate(path(`/catalogo?q=${encodeURIComponent(q)}`));
    setQuery("");
    setSearching(false);
  };
  const is = (to: string) => pathname === to.split("?")[0];

  return (
    <header className="atl-header">
      <div className="atl-bar">
        <div className="atl-bar-side">
          <button type="button" className="atl-icon atl-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => { setMenu((v) => !v); setSearching(false); }}>
            {menu ? <X size={24} strokeWidth={1.4} /> : <Menu size={24} strokeWidth={1.4} />}
          </button>
          <nav className="atl-main-nav" aria-label="Principal">
            <Link to={path("/catalogo")} aria-current={is(path("/catalogo")) ? "page" : undefined}>Coleção</Link>
            <Link to={path("/sobre")} aria-current={is(path("/sobre")) ? "page" : undefined}>O ateliê</Link>
          </nav>
        </div>
        <Link to={path()} className="atl-brand" aria-label={`${tenant.name} — página inicial`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt={tenant.name} /> : <span>{tenant.name}</span>}
        </Link>
        <div className="atl-bar-side atl-bar-right">
          <button type="button" className="atl-icon" aria-label="Buscar" aria-expanded={searching} onClick={() => { setSearching((v) => !v); setMenu(false); }}>
            {searching ? <X size={22} strokeWidth={1.4} /> : <Search size={22} strokeWidth={1.4} />}
          </button>
          <button type="button" className="atl-icon atl-bag" aria-label={`Abrir sacola, ${count} ${count === 1 ? "item" : "itens"}`} onClick={openCart}>
            <ShoppingBag size={22} strokeWidth={1.4} />
            <b>{count}</b>
          </button>
        </div>
      </div>
      {categories.length > 0 && (
        <nav className="atl-cats" aria-label="Categorias">
          {categories.slice(0, 8).map((c) => <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link>)}
        </nav>
      )}
      {searching && (
        <div className="atl-searchpanel" ref={panel}>
          <form role="search" onSubmit={submit}>
            <SearchBar value={query} onChange={setQuery} placeholder="O que você procura?" />
            <button type="submit">Buscar</button>
          </form>
        </div>
      )}
      {menu && (
        <div className="atl-drawer">
          <nav aria-label="Menu">
            <Link to={path()}>Início</Link>
            <Link to={path("/catalogo")}>Coleção</Link>
            <Link to={path("/sobre")}>O ateliê</Link>
            {categories.length > 0 && <p>Categorias</p>}
            {categories.map((c) => <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link>)}
          </nav>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant, categories, path } = useKit();
  const wa = whatsappLink(tenant);
  const hours = hoursList(tenant);
  return (
    <footer className="atl-footer">
      <div className="atl-foot-top">
        <p className="atl-foot-mark">{tenant.name}</p>
        <p className="atl-foot-line">{tenant.footer_text || tenant.hero_tagline || "Peças pensadas com cuidado, para vestir com calma."}</p>
        <div className="atl-foot-social">
          {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={20} strokeWidth={1.4} /></a>}
          {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={20} strokeWidth={1.4} /></a>}
          {wa && <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={20} strokeWidth={1.4} /></a>}
        </div>
      </div>
      <div className="atl-foot-grid">
        <div>
          <h3>Explorar</h3>
          <Link to={path()}>Início</Link>
          <Link to={path("/catalogo")}>Coleção completa</Link>
          <Link to={path("/sobre")}>O ateliê</Link>
          {categories.slice(0, 4).map((c) => <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link>)}
        </div>
        <div>
          <h3>Atendimento</h3>
          {wa && <a href={wa} target="_blank" rel="noreferrer">WhatsApp {tenant.whatsapp}</a>}
          {tenant.show_address && tenant.address && <p>{tenant.address}</p>}
        </div>
        {hours.length > 0 && (
          <div>
            <h3>Horários</h3>
            <ul>{hours.map((h) => <li key={h.day}><span>{h.day}</span> {h.text}</li>)}</ul>
          </div>
        )}
      </div>
      <div className="atl-foot-bottom">
        <span>© {new Date().getFullYear()} {tenant.name}</span>
        <span>Loja criada com BoxSys</span>
      </div>
    </footer>
  );
}
