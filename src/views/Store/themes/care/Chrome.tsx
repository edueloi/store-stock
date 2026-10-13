import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Facebook, Instagram, MapPin, Menu, MessageCircle, Search, ShoppingBag, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { hoursRows, useShop, whatsappLink } from "./core";
import { Drop, T } from "./parts";
import "./styles.css";

export function Header() {
  const { tenant, categories, count, openCart, path } = useShop();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const links = [
    { name: "Início", to: path(), match: path().split("?")[0] },
    { name: "Catálogo", to: path("/catalogo"), match: path("/catalogo").split("?")[0] },
    { name: "Nossa história", to: path("/sobre"), match: path("/sobre").split("?")[0] },
  ];
  const current = (m: string) => (pathname.replace(/\/$/, "") === m.replace(/\/$/, "") ? ("page" as const) : undefined);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(false);
    setMenu(false);
    navigate(path(q.trim() ? `/catalogo?q=${encodeURIComponent(q.trim())}` : "/catalogo"));
  };
  return (
    <header className="ca ca-header">
      <div className="ca-pill">
        <button type="button" className="ca-icon ca-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => { setMenu((v) => !v); setSearching(false); }}>
          {menu ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Link className="ca-brand" to={path()} aria-label={`${tenant.name} - início`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="ca-brand-mark"><Drop /></span>}
          <span>{tenant.name}</span>
        </Link>
        <nav className="ca-nav" aria-label="Principal">
          {links.map((l) => (
            <Link key={l.name} to={l.to} aria-current={current(l.match)}>{l.name}</Link>
          ))}
        </nav>
        <div className="ca-actions">
          <button type="button" className="ca-icon" aria-label="Buscar produtos" aria-expanded={searching} onClick={() => { setSearching((v) => !v); setMenu(false); }}>
            <Search size={21} />
          </button>
          <button type="button" className="ca-icon ca-bag" aria-label={`Abrir carrinho, ${count} itens`} onClick={openCart}>
            <ShoppingBag size={21} />
            {count > 0 && <b>{count}</b>}
          </button>
        </div>
      </div>
      {searching && (
        <form className="ca-drawer ca-searchform" role="search" onSubmit={submit}>
          <SearchBar value={q} onChange={setQ} placeholder="O que você quer cuidar hoje?" />
          <button type="submit" className="ca-btn">Buscar</button>
        </form>
      )}
      {menu && (
        <div className="ca-drawer ca-sheet">
          {links.map((l) => (
            <Link key={l.name} to={l.to} aria-current={current(l.match)} onClick={() => setMenu(false)}>{l.name}</Link>
          ))}
          {categories.length > 0 && <p>Explore os cuidados</p>}
          <div className="ca-sheet-cats">
            {categories.slice(0, 10).map((c) => (
              <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} onClick={() => setMenu(false)}>{c.name}</Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant, categories, path } = useShop();
  const hours = hoursRows(tenant);
  return (
    <footer className="ca ca-footer">
      <svg className="ca-wave" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 60V28C240 -4 480 -4 720 22s480 30 720 -2V60z" fill="currentColor" />
      </svg>
      <div className="ca-foot-in">
        <div className="ca-foot-lead">
          <p className="ca-foot-name">{tenant.name}</p>
          <p className="ca-foot-text">{tenant.footer_text || tenant.hero_tagline || T.hero}</p>
          <div className="ca-social">
            {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={20} /></a>}
            {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={20} /></a>}
            {tenant.whatsapp && <a href={whatsappLink(tenant)} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={20} /></a>}
          </div>
        </div>
        <div className="ca-foot-col">
          <h3>Explore</h3>
          <Link to={path("/catalogo")}>Todo o catálogo</Link>
          {categories.slice(0, 5).map((c) => (
            <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link>
          ))}
        </div>
        <div className="ca-foot-col">
          <h3>Fale com a gente</h3>
          <Link to={path("/sobre")}>Nossa história</Link>
          {tenant.whatsapp && <a href={whatsappLink(tenant)} target="_blank" rel="noreferrer">WhatsApp {tenant.whatsapp}</a>}
          {tenant.show_address && tenant.address && <span><MapPin size={15} aria-hidden="true" /> {tenant.address}</span>}
        </div>
        {hours.length > 0 && (
          <div className="ca-foot-col">
            <h3>Horários</h3>
            {hours.map((h) => (
              <span key={h.day} className="ca-hrow"><em>{h.day}</em>{h.text}</span>
            ))}
          </div>
        )}
      </div>
      <p className="ca-credit">
        © {new Date().getFullYear()} {tenant.name} · Powered by{" "}
        <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a>
      </p>
    </footer>
  );
}
