import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Clock, Facebook, GlassWater, Instagram, MapPin, Menu, MessageCircle, Search, ShoppingBag, X } from "lucide-react";
import { hoursLines, useKit, whatsappLink } from "./kit";
import { SearchField } from "./parts";
import "./styles.css";

export function Header() {
  const { tenant, categories, active, openCart, cartCount, path } = useKit();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [find, setFind] = useState(false);
  const [term, setTerm] = useState("");
  const used = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 8);
  const links = [
    { name: "Início", to: path(), on: !/catalogo|sobre|produto/.test(pathname) },
    { name: "Cardápio", to: path("/catalogo"), on: /catalogo|produto/.test(pathname) },
    { name: "A adega", to: path("/sobre"), on: /sobre/.test(pathname) },
  ];
  useEffect(() => {
    setMenu(false);
    setFind(false);
  }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        setFind(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setMenu(false);
    setFind(false);
    navigate(path(`/catalogo${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ""}`));
  };
  return (
    <header className="adg-header">
      <div className="adg-bar">
        <button type="button" className="adg-icon adg-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => { setMenu((v) => !v); setFind(false); }}>
          {menu ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Link className="adg-brand" to={path()} aria-label={`${tenant.name} - página inicial`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <GlassWater size={22} aria-hidden="true" />}
          <span>{tenant.name}</span>
        </Link>
        <nav className="adg-nav" aria-label="Principal">
          {links.map((l) => <Link key={l.to} to={l.to} aria-current={l.on ? "page" : undefined}>{l.name}</Link>)}
        </nav>
        <div className="adg-tools">
          <button type="button" className="adg-icon" aria-label="Buscar" aria-expanded={find} onClick={() => { setFind((v) => !v); setMenu(false); }}>
            <Search size={20} />
          </button>
          <button type="button" className="adg-icon adg-cart" aria-label={`Abrir sacola, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`} onClick={openCart}>
            <ShoppingBag size={20} />
            {cartCount > 0 && <b>{cartCount}</b>}
          </button>
        </div>
      </div>
      {find && (
        <form className="adg-panel adg-find" role="search" onSubmit={submit}>
          <SearchField value={term} onChange={setTerm} placeholder="Buscar cerveja, vinho, gelo..." label="Buscar produtos" autoFocus />
          <button type="submit" className="adg-btn">Buscar</button>
        </form>
      )}
      {menu && (
        <div className="adg-panel adg-drawer">
          <form role="search" onSubmit={submit}>
            <SearchField value={term} onChange={setTerm} placeholder="Buscar cerveja, vinho, gelo..." />
          </form>
          <nav aria-label="Menu">
            {links.map((l) => <Link key={l.to} to={l.to} aria-current={l.on ? "page" : undefined}>{l.name}</Link>)}
          </nav>
          {used.length > 0 && (
            <div className="adg-chips">
              {used.map((c) => <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>{c.name}</Link>)}
            </div>
          )}
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant, categories, active, path } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 6);
  return (
    <footer className="adg-footer">
      <div className="adg-wrap adg-foot-grid">
        <section className="adg-foot-about">
          <p className="adg-foot-mark">{tenant.name}</p>
          <p>{tenant.footer_text || tenant.about_text || "Bebida gelada, gelo, carvão e conveniência para a sua noite."}</p>
          <div className="adg-social">
            {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>}
            {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={18} /></a>}
            {wa && <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={18} /></a>}
          </div>
        </section>
        <section className="adg-foot-col">
          <h2>Navegue</h2>
          <Link to={path()}>Início</Link>
          <Link to={path("/catalogo")}>Cardápio completo</Link>
          <Link to={path("/sobre")}>A adega</Link>
          {cats.map((c) => <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>{c.name}</Link>)}
        </section>
        <section className="adg-foot-col">
          <h2>Atendimento</h2>
          {wa && <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={15} /> {tenant.whatsapp}</a>}
          {tenant.show_address && tenant.address && <p><MapPin size={15} /> {tenant.address}</p>}
          {hours.slice(0, 7).map((h) => <p key={h.day}><Clock size={14} /> {h.day}: {h.text}</p>)}
        </section>
      </div>
      <p className="adg-credit">
        © {new Date().getFullYear()} {tenant.name} · Beba com moderação. Venda proibida para menores de 18 anos. · Desenvolvido por <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a>
      </p>
    </footer>
  );
}
