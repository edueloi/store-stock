import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Facebook, Instagram, MapPin, Menu, MessageCircle, Paperclip, Pencil, ShoppingBag, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { hoursRows, useKit } from "./kit";
import "./styles.css";

const TAB_COLORS = ["#ffd966", "#ff9ecb", "#8ee0c0", "#9ad0ff", "#ffb38a", "#c7b8ff"];

export function Header() {
  const { tenant, categories, cartCount, openCart, path } = useKit();
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
  const tabs = [
    { name: "Início", to: path() },
    { name: "Catálogo", to: path("/catalogo") },
    { name: "Sobre", to: path("/sobre") },
    ...categories.slice(0, 6).map((c) => ({ name: c.name, to: path(`/catalogo?categoria=${c.id}`) })),
  ];
  const isActive = (to: string) => {
    const [p, q] = to.split("?");
    if (q) return false;
    return pathname === p;
  };

  return (
    <header className="pp-header">
      <div className="pp-top">
        <button className="pp-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          {menu ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Link to={path()} className="pp-brand">
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <Pencil size={20} aria-hidden="true" />}
          <span>{tenant.name}</span>
        </Link>
        <form className="pp-note-search" onSubmit={submit} role="search">
          <Paperclip className="pp-clip" size={22} aria-hidden="true" />
          <SearchBar value={query} onChange={setQuery} placeholder="Procurar no caderno..." />
        </form>
        <button className="pp-cart" onClick={openCart} aria-label={`Abrir carrinho, ${cartCount} itens`}>
          <ShoppingBag size={22} aria-hidden="true" />
          <b>{cartCount}</b>
        </button>
      </div>
      <nav className="pp-tabs" aria-label="Principal">
        {tabs.map((t, i) => (
          <Link key={t.name + i} to={t.to} style={{ ["--tab" as string]: TAB_COLORS[i % TAB_COLORS.length] }} aria-current={isActive(t.to) ? "page" : undefined}>
            {t.name}
          </Link>
        ))}
      </nav>
      {menu && (
        <div className="pp-panel" role="dialog" aria-label="Menu">
          <form className="pp-note-search" onSubmit={submit} role="search">
            <SearchBar value={query} onChange={setQuery} placeholder="Procurar no caderno..." />
          </form>
          {tabs.map((t, i) => (
            <Link key={t.name + i} to={t.to} style={{ ["--tab" as string]: TAB_COLORS[i % TAB_COLORS.length] }}>{t.name}</Link>
          ))}
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant, categories, path, waLink } = useKit();
  const hours = hoursRows(tenant);
  return (
    <footer className="pp-footer">
      <div className="pp-footer-in">
        <div>
          <p className="pp-footer-brand">{tenant.name}</p>
          <p className="pp-footer-text">{tenant.footer_text || tenant.about_text || "Papelaria, criatividade e impressos feitos com carinho."}</p>
          <div className="pp-social">
            {tenant.whatsapp && <a href={waLink()} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={18} /></a>}
            {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>}
            {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={18} /></a>}
          </div>
        </div>
        <div className="pp-footer-note">
          <h3>Folhear</h3>
          <Link to={path("/catalogo")}>Todos os produtos</Link>
          {categories.slice(0, 5).map((c) => <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>{c.name}</Link>)}
          <Link to={path("/sobre")}>Sobre a loja</Link>
        </div>
        <div className="pp-footer-note pp-footer-note-2">
          <h3>Onde e quando</h3>
          {tenant.show_address && tenant.address && <p><MapPin size={14} aria-hidden="true" /> {tenant.address}</p>}
          {hours.map((h) => <p key={h.day}><span>{h.day}</span> {h.text}</p>)}
          {!hours.length && !(tenant.show_address && tenant.address) && <p>Chame a gente pelo WhatsApp.</p>}
        </div>
      </div>
      <p className="pp-footer-credit">© {new Date().getFullYear()} {tenant.name} · Feito com BoxSys</p>
    </footer>
  );
}
