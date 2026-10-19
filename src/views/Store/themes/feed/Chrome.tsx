import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Clock, Facebook, Instagram, MapPin, Menu, MessageCircle, PawPrint, Search, ShoppingBag, X } from "lucide-react";
import { hoursLines, useKit } from "./kit";
import { useShelves, whatsappLink } from "./extras";
import "./styles.css";

function Brand({ foot = false }: { foot?: boolean }) {
  const { tenant, path } = useKit();
  return (
    <Link className={`feed-brand ${foot ? "is-foot" : ""}`} to={path()} aria-label={`${tenant.name} - página inicial`}>
      {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="feed-brand-mark"><PawPrint size={22} aria-hidden="true" /></span>}
      <span>{tenant.name}</span>
    </Link>
  );
}

export function Header() {
  const { path, cart, openCart, tenant } = useKit();
  const shelves = useShelves();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);
  const [q, setQ] = useState("");
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  const activeCat = new URLSearchParams(search).get("cat");
  const onCatalog = /catalogo/.test(pathname);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  useEffect(() => setDrawer(false), [pathname, search]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(path("/catalogo", q.trim() ? { q: q.trim() } : undefined));
  };
  const links = [
    { name: "Início", to: path(), on: !/catalogo|sobre|produto/.test(pathname) },
    { name: "Todos os produtos", to: path("/catalogo"), on: /catalogo|produto/.test(pathname) },
    { name: "Nossa loja", to: path("/sobre"), on: /sobre/.test(pathname) },
  ];
  return (
    <header className="feed-header">
      <div className="feed-wrap feed-bar">
        <button type="button" className="feed-burger" aria-label={drawer ? "Fechar menu" : "Abrir menu"} aria-expanded={drawer} onClick={() => setDrawer((v) => !v)}>
          {drawer ? <X size={22} /> : <Menu size={22} />}
        </button>
        <form className="feed-search" role="search" onSubmit={submit}>
          <Search size={18} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Qual ração você procura?" aria-label="Buscar produtos" />
        </form>
        <Brand />
        <nav className="feed-links" aria-label="Principal">
          {links.slice(1).map((l) => (
            <Link key={l.to} to={l.to} aria-current={l.on ? "page" : undefined}>{l.name}</Link>
          ))}
        </nav>
        <div className="feed-actions">
          {wa && (
            <a className="feed-wpp" href={wa} target="_blank" rel="noreferrer" aria-label="Chamar no WhatsApp">
              <MessageCircle size={20} />
            </a>
          )}
          <button type="button" className="feed-cart" onClick={openCart} aria-label={`Abrir sacola, ${count} ${count === 1 ? "item" : "itens"}`}>
            <ShoppingBag size={21} aria-hidden="true" />
            <span>{count}</span>
          </button>
        </div>
      </div>
      {shelves.length > 0 && (
        <div className="feed-wrap">
          <nav className="feed-rail" aria-label="Escolha por animal ou linha">
            <Link to={path("/catalogo")} aria-current={onCatalog && !activeCat ? "true" : undefined}>Tudo</Link>
            {shelves.slice(0, 14).map((c) => (
              <Link key={c.id} to={path("/catalogo", { cat: String(c.id) })} aria-current={activeCat === String(c.id) ? "true" : undefined}>
                {c.name}
              </Link>
            ))}
          </nav>
        </div>
      )}
      {drawer && (
        <div className="feed-wrap">
          <div className="feed-drawer">
            {links.map((l) => (
              <Link key={l.to} to={l.to} aria-current={l.on ? "page" : undefined}>{l.name}</Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant, path } = useKit();
  const shelves = useShelves();
  const hours = hoursLines(tenant.business_hours);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  return (
    <footer className="feed-footer">
      <div className="feed-wrap feed-foot-grid">
        <section className="feed-foot-card feed-foot-about">
          <Brand foot />
          <p>{tenant.footer_text || tenant.about_text || "Nutrição e cuidado para quem faz parte da família, do pet ao rebanho."}</p>
          <div className="feed-social">
            {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={19} /></a>}
            {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={19} /></a>}
            {wa && <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={19} /></a>}
          </div>
        </section>
        <section className="feed-foot-card">
          <h2>Compre por linha</h2>
          <ul>
            {shelves.slice(0, 6).map((c) => (
              <li key={c.id}><Link to={path("/catalogo", { cat: String(c.id) })}>{c.name}</Link></li>
            ))}
            <li><Link to={path("/catalogo")}>Ver todos</Link></li>
          </ul>
        </section>
        <section className="feed-foot-card">
          <h2>Atendimento</h2>
          <ul>
            {wa && <li><a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={16} aria-hidden="true" /> {tenant.whatsapp}</a></li>}
            {tenant.show_address && tenant.address && <li><span><MapPin size={16} aria-hidden="true" /> {tenant.address}</span></li>}
            {hours.slice(0, 7).map((h) => <li key={h.label}><span><Clock size={14} aria-hidden="true" /> {h.label}: {h.text}</span></li>)}
            <li><Link to={path("/sobre")}>Sobre a loja</Link></li>
          </ul>
        </section>
      </div>
      <p className="feed-credit">
        © {new Date().getFullYear()} {tenant.name} · Desenvolvido por <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a>
      </p>
    </footer>
  );
}
