import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Clock, Facebook, Instagram, MapPin, Menu, MessageCircle, ShoppingCart, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { cartCount, hoursList, useKit, whatsappLink } from "./kit";
import "./styles.css";

export function Header() {
  const { tenant, categories, cart, openCart, path } = useKit();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState(false);
  const count = cartCount(cart);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate(path(`/catalogo?q=${encodeURIComponent(q)}`));
    setQuery("");
    setMenu(false);
  };
  const links = [
    { name: "Início", to: path() },
    { name: "Catálogo", to: path("/catalogo") },
    { name: "Sobre a loja", to: path("/sobre") },
  ];
  const isCurrent = (to: string) => pathname === to.split("?")[0];

  return (
    <header className="dfl-header">
      <div className="dfl-wrap dfl-main">
        <button type="button" className="dfl-icon-btn dfl-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          {menu ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Link to={path()} className="dfl-logo" aria-label={`${tenant.name} — página inicial`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : null}
          <span>{tenant.name}</span>
        </Link>
        <form className="dfl-search" role="search" onSubmit={submit}>
          <SearchBar value={query} onChange={setQuery} placeholder="O que você procura?" />
          <button type="submit" className="dfl-search-go">Buscar</button>
        </form>
        <div className="dfl-actions">
          <button type="button" className="dfl-cart" aria-label={`Abrir carrinho, ${count} ${count === 1 ? "item" : "itens"}`} onClick={openCart}>
            <ShoppingCart size={21} />
            <span className="dfl-cart-label">Carrinho</span>
            <b>{count}</b>
          </button>
        </div>
      </div>
      <nav className="dfl-cats" aria-label="Categorias">
        <div className="dfl-wrap dfl-cats-in">
          {links.map((l) => (
            <Link key={l.name} to={l.to} aria-current={isCurrent(l.to) ? "page" : undefined}>{l.name}</Link>
          ))}
          <span className="dfl-cats-sep" aria-hidden="true" />
          {categories.slice(0, 9).map((c) => (
            <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link>
          ))}
        </div>
      </nav>
      {menu && (
        <div className="dfl-drawer">
          <nav aria-label="Menu principal">
            {links.map((l) => (
              <Link key={l.name} to={l.to} onClick={() => setMenu(false)}>{l.name}</Link>
            ))}
            <p>Categorias</p>
            {categories.map((c) => (
              <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} onClick={() => setMenu(false)}>{c.name}</Link>
            ))}
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
    <footer className="dfl-footer">
      <div className="dfl-wrap dfl-foot-grid">
        <div className="dfl-foot-about">
          <strong className="dfl-foot-name">{tenant.name}</strong>
          <p>{tenant.footer_text || tenant.about_text || "Produtos selecionados, atendimento próximo e compra simples."}</p>
          <div className="dfl-social">
            {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>}
            {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={18} /></a>}
            {wa && <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={18} /></a>}
          </div>
        </div>
        <div>
          <h3>Institucional</h3>
          <Link to={path()}>Início</Link>
          <Link to={path("/catalogo")}>Todos os produtos</Link>
          <Link to={path("/sobre")}>Sobre a loja</Link>
        </div>
        <div>
          <h3>Categorias</h3>
          {categories.slice(0, 6).map((c) => (
            <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link>
          ))}
        </div>
        <div>
          <h3>Atendimento</h3>
          {wa && <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={14} /> WhatsApp {tenant.whatsapp}</a>}
          {tenant.show_address && tenant.address && <p><MapPin size={14} /> {tenant.address}</p>}
          {hours.length > 0 && (
            <ul className="dfl-hours" aria-label="Horários de atendimento">
              {hours.map((h) => <li key={h.day}><Clock size={12} /> <span>{h.day}</span> {h.text}</li>)}
            </ul>
          )}
        </div>
      </div>
      <div className="dfl-foot-bottom">
        <div className="dfl-wrap">
          <span>© {new Date().getFullYear()} {tenant.name}. Todos os direitos reservados.</span>
          <span>Loja criada com BoxSys</span>
        </div>
      </div>
    </footer>
  );
}
