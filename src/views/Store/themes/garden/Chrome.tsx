import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Clock, Facebook, Instagram, Leaf, MapPin, Menu, MessageCircle, Search, ShoppingBasket, Sprout, X } from "lucide-react";
import { hoursLines, useKit } from "./kit";
import { useShelves, whatsappLink } from "./extras";
import "./styles.css";

function Brand({ foot = false }: { foot?: boolean }) {
  const { tenant, path } = useKit();
  return (
    <Link className={`garden-brand ${foot ? "is-foot" : ""}`} to={path()} aria-label={`${tenant.name} - página inicial`}>
      {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="garden-brand-mark"><Sprout size={21} aria-hidden="true" /></span>}
      <span>{tenant.name}</span>
    </Link>
  );
}

export function Header() {
  const { path, cart, openCart } = useKit();
  const shelves = useShelves();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);
  const [pop, setPop] = useState(false);
  const [q, setQ] = useState("");
  const holder = useRef<HTMLDivElement>(null);
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  useEffect(() => {
    setDrawer(false);
    setPop(false);
  }, [pathname, search]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && (setPop(false), setDrawer(false));
    const click = (e: MouseEvent) => holder.current && !holder.current.contains(e.target as Node) && setPop(false);
    window.addEventListener("keydown", key);
    document.addEventListener("mousedown", click);
    return () => {
      window.removeEventListener("keydown", key);
      document.removeEventListener("mousedown", click);
    };
  }, []);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(path("/catalogo", q.trim() ? { q: q.trim() } : undefined));
  };
  const links = [
    { name: "Início", to: path(), on: !/catalogo|sobre|produto/.test(pathname) },
    { name: "Catálogo", to: path("/catalogo"), on: /catalogo|produto/.test(pathname) },
    { name: "Nossa história", to: path("/sobre"), on: /sobre/.test(pathname) },
  ];
  return (
    <header className="garden-header">
      <div className="garden-island" ref={holder}>
        <Brand />
        <nav className="garden-nav" aria-label="Principal">
          {links.slice(0, 2).map((l) => (
            <Link key={l.to} to={l.to} aria-current={l.on ? "page" : undefined}>{l.name}</Link>
          ))}
          <button type="button" aria-expanded={pop} aria-controls="garden-pop" onClick={() => setPop((v) => !v)}>
            Plantas e jardim <ChevronDown size={16} aria-hidden="true" />
          </button>
          <Link to={links[2].to} aria-current={links[2].on ? "page" : undefined}>{links[2].name}</Link>
        </nav>
        <form className="garden-search" role="search" onSubmit={submit}>
          <Search size={17} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" aria-label="Buscar produtos" />
        </form>
        <button type="button" className="garden-cart" onClick={openCart} aria-label={`Abrir sacola, ${count} ${count === 1 ? "item" : "itens"}`}>
          <ShoppingBasket size={21} aria-hidden="true" />
          <span>{count}</span>
        </button>
        <button type="button" className="garden-burger" aria-label={drawer ? "Fechar menu" : "Abrir menu"} aria-expanded={drawer} onClick={() => setDrawer((v) => !v)}>
          {drawer ? <X size={22} /> : <Menu size={22} />}
        </button>
        {pop && (
          <div className="garden-pop" id="garden-pop">
            {shelves.slice(0, 12).map((c) => (
              <Link key={c.id} to={path("/catalogo", { cat: String(c.id) })}><Leaf size={15} aria-hidden="true" /> {c.name} <small>{c.count}</small></Link>
            ))}
            {!shelves.length && <p>As categorias aparecem aqui quando houver produtos.</p>}
          </div>
        )}
      </div>
      {drawer && (
        <div className="garden-drawer">
          <form className="garden-search" role="search" onSubmit={submit}>
            <Search size={17} aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar plantas e produtos" aria-label="Buscar produtos" />
          </form>
          <nav aria-label="Menu">
            {links.map((l) => <Link key={l.to} to={l.to} aria-current={l.on ? "page" : undefined}>{l.name}</Link>)}
          </nav>
          {shelves.length > 0 && (
            <>
              <p className="garden-drawer-title">Plantas e jardim</p>
              <div className="garden-drawer-grid">
                {shelves.slice(0, 12).map((c) => <Link key={c.id} to={path("/catalogo", { cat: String(c.id) })}>{c.name}</Link>)}
              </div>
            </>
          )}
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
    <footer className="garden-footer">
      <svg className="garden-wave" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 60V30C120 6 240 6 360 26s240 30 360 10 240-34 360-14 240 26 360 8v30z" fill="currentColor" />
      </svg>
      <div className="garden-wrap garden-foot-grid">
        <section className="garden-foot-card garden-foot-about">
          <Brand foot />
          <p>{tenant.footer_text || tenant.about_text || "Plantas, vasos e ferramentas para cultivar um cantinho verde em casa."}</p>
          <div className="garden-social">
            {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={19} /></a>}
            {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={19} /></a>}
            {wa && <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={19} /></a>}
          </div>
        </section>
        <section className="garden-foot-card">
          <h2>Explore</h2>
          <ul>
            {shelves.slice(0, 6).map((c) => <li key={c.id}><Link to={path("/catalogo", { cat: String(c.id) })}>{c.name}</Link></li>)}
            <li><Link to={path("/catalogo")}>Ver tudo</Link></li>
          </ul>
        </section>
        <section className="garden-foot-card">
          <h2>Fale com a gente</h2>
          <ul>
            {wa && <li><a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={16} aria-hidden="true" /> {tenant.whatsapp}</a></li>}
            {tenant.show_address && tenant.address && <li><span><MapPin size={16} aria-hidden="true" /> {tenant.address}</span></li>}
            {hours.slice(0, 7).map((h) => <li key={h.label}><span><Clock size={14} aria-hidden="true" /> {h.label}: {h.text}</span></li>)}
            <li><Link to={path("/sobre")}>Nossa história</Link></li>
          </ul>
        </section>
      </div>
      <p className="garden-credit">
        © {new Date().getFullYear()} {tenant.name} · Desenvolvido por <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a>
      </p>
    </footer>
  );
}
