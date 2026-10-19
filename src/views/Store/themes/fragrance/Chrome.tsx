import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Clock, Droplets, Facebook, Instagram, MapPin, Menu, MessageCircle, ShoppingBag, X } from "lucide-react";
import { hoursLines, useKit, whatsappLink } from "./kit";
import { SearchField } from "./parts";
import "./styles.css";

export function Header() {
  const { tenant, categories, active, openCart, cartCount, path } = useKit();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [term, setTerm] = useState("");
  const used = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 10);
  const links = [
    { name: "Início", to: path(), on: !/catalogo|sobre|produto/.test(pathname) },
    { name: "Fragrâncias", to: path("/catalogo"), on: /catalogo|produto/.test(pathname) },
    { name: "Nossa loja", to: path("/sobre"), on: /sobre/.test(pathname) },
  ];
  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setMenu(false);
    navigate(path(`/catalogo${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ""}`));
  };
  return (
    <header className="frg-header">
      <div className="frg-bar">
        <button type="button" className="frg-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          {menu ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Link className="frg-brand" to={path()} aria-label={`${tenant.name} - página inicial`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="frg-brand-mark"><Droplets size={19} /></span>}
          <span>{tenant.name}</span>
        </Link>
        <form className="frg-search" role="search" onSubmit={submit}>
          <SearchField value={term} onChange={setTerm} placeholder="Busque por fragrância, marca ou nota" />
        </form>
        <button type="button" className="frg-cart" aria-label={`Abrir sacola, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`} onClick={openCart}>
          <ShoppingBag size={20} />
          <span className="frg-cart-label">Sacola</span>
          <b>{cartCount}</b>
        </button>
      </div>
      <div className="frg-tray-wrap">
        <nav className="frg-tray" aria-label="Navegação e famílias">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="frg-tray-link" aria-current={l.on ? "page" : undefined}>{l.name}</Link>
          ))}
          {used.length > 0 && <span className="frg-tray-sep" aria-hidden="true" />}
          {used.map((c) => (
            <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)} className="frg-tray-cat">{c.name}</Link>
          ))}
        </nav>
      </div>
      {menu && (
        <div className="frg-drawer">
          <form role="search" onSubmit={submit}>
            <SearchField value={term} onChange={setTerm} placeholder="Buscar fragrância" />
          </form>
          <nav aria-label="Menu">
            {links.map((l) => (
              <Link key={l.to} to={l.to} aria-current={l.on ? "page" : undefined}>{l.name}</Link>
            ))}
          </nav>
          {used.length > 0 && (
            <>
              <p className="frg-drawer-title">Famílias olfativas</p>
              <div className="frg-drawer-chips">
                {used.map((c) => (
                  <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>{c.name}</Link>
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
  const { tenant, categories, active, path } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 6);
  return (
    <footer className="frg-footer">
      <div className="frg-footer-inner">
        <section className="frg-foot-card frg-foot-about">
          <Link className="frg-brand" to={path()}>
            {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="frg-brand-mark"><Droplets size={19} /></span>}
            <span>{tenant.name}</span>
          </Link>
          <p>{tenant.footer_text || tenant.about_text || "Fragrâncias selecionadas para marcar presença em cada momento."}</p>
          <div className="frg-social">
            {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={19} /></a>}
            {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={19} /></a>}
            {wa && <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={19} /></a>}
          </div>
        </section>
        <section className="frg-foot-card">
          <h2>Navegue</h2>
          <Link to={path()}>Início</Link>
          <Link to={path("/catalogo")}>Todas as fragrâncias</Link>
          <Link to={path("/sobre")}>Nossa loja</Link>
        </section>
        {cats.length > 0 && (
          <section className="frg-foot-card">
            <h2>Famílias</h2>
            {cats.map((c) => <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>{c.name}</Link>)}
          </section>
        )}
        <section className="frg-foot-card">
          <h2>Atendimento</h2>
          {wa && <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={15} /> {tenant.whatsapp}</a>}
          {tenant.show_address && tenant.address && <p><MapPin size={15} /> {tenant.address}</p>}
          {hours.slice(0, 7).map((h) => <p key={h.day}><Clock size={14} /> {h.day}: {h.text}</p>)}
        </section>
      </div>
      <p className="frg-credit">
        © {new Date().getFullYear()} {tenant.name} · Desenvolvido por <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a>
      </p>
    </footer>
  );
}
