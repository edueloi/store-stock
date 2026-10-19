import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Clock, Facebook, Instagram, MapPin, Menu, MessageCircle, Search, ShoppingBasket, Sprout, X } from "lucide-react";
import { hoursLines, useKit } from "./kit";
import { useShelves, whatsappLink } from "./extras";
import "./styles.css";

function Brand({ foot = false }: { foot?: boolean }) {
  const { tenant, path } = useKit();
  return (
    <Link className={`agro-brand ${foot ? "is-foot" : ""}`} to={path()} aria-label={`${tenant.name} - página inicial`}>
      {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="agro-brand-mark"><Sprout size={22} aria-hidden="true" /></span>}
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
  const [mega, setMega] = useState(false);
  const [q, setQ] = useState("");
  const holder = useRef<HTMLDivElement>(null);
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  useEffect(() => {
    setDrawer(false);
    setMega(false);
  }, [pathname, search]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && (setMega(false), setDrawer(false));
    const click = (e: MouseEvent) => holder.current && !holder.current.contains(e.target as Node) && setMega(false);
    window.addEventListener("keydown", key);
    document.addEventListener("mousedown", click);
    return () => {
      window.removeEventListener("keydown", key);
      document.removeEventListener("mousedown", click);
    };
  }, []);
  const links = [
    { name: "Início", to: path(), on: !/catalogo|sobre|produto/.test(pathname) },
    { name: "Catálogo", to: path("/catalogo"), on: /catalogo|produto/.test(pathname) },
    { name: "Nossa loja", to: path("/sobre"), on: /sobre/.test(pathname) },
  ];
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(path("/catalogo", q.trim() ? { q: q.trim() } : undefined));
  };
  const searchForm = (
    <form className="agro-search" role="search" onSubmit={submit}>
      <Search size={18} aria-hidden="true" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar sementes, insumos, ferramentas" aria-label="Buscar produtos" />
      <button type="submit">Buscar</button>
    </form>
  );
  return (
    <header className="agro-header">
      <div className="agro-wrap agro-bar">
        <Brand />
        {searchForm}
        <button type="button" className="agro-cart" onClick={openCart} aria-label={`Abrir pedido, ${count} ${count === 1 ? "item" : "itens"}`}>
          <ShoppingBasket size={22} aria-hidden="true" />
          <span>{count}</span>
        </button>
        <button type="button" className="agro-burger" aria-label={drawer ? "Fechar menu" : "Abrir menu"} aria-expanded={drawer} onClick={() => setDrawer((v) => !v)}>
          {drawer ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      <div className="agro-wrap agro-navwrap" ref={holder}>
        <nav className="agro-nav" aria-label="Principal">
          <button type="button" className="agro-nav-dept" aria-expanded={mega} aria-controls="agro-mega" onClick={() => setMega((v) => !v)}>
            <Menu size={17} aria-hidden="true" /> Departamentos <ChevronDown size={16} aria-hidden="true" />
          </button>
          {links.map((l) => (
            <Link key={l.to} to={l.to} aria-current={l.on ? "page" : undefined}>
              {l.name}
            </Link>
          ))}
        </nav>
        {mega && (
          <div className="agro-mega" id="agro-mega">
            {shelves.slice(0, 12).map((c) => (
              <Link key={c.id} to={path("/catalogo", { cat: String(c.id) })}>
                <span className="agro-mega-img">{c.cover ? <img src={c.cover} alt="" loading="lazy" /> : <Sprout size={22} aria-hidden="true" />}</span>
                <span>
                  <strong>{c.name}</strong>
                  <small>{c.count} {c.count === 1 ? "produto" : "produtos"}</small>
                </span>
              </Link>
            ))}
            {!shelves.length && <p>Os departamentos aparecem aqui assim que houver produtos.</p>}
          </div>
        )}
      </div>
      {drawer && (
        <div className="agro-drawer">
          <nav aria-label="Menu">
            {links.map((l) => (
              <Link key={l.to} to={l.to} aria-current={l.on ? "page" : undefined}>
                {l.name}
              </Link>
            ))}
          </nav>
          {shelves.length > 0 && (
            <>
              <p className="agro-drawer-title">Departamentos</p>
              <div className="agro-drawer-grid">
                {shelves.slice(0, 12).map((c) => (
                  <Link key={c.id} to={path("/catalogo", { cat: String(c.id) })}>
                    {c.name}
                  </Link>
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
  const { tenant, path } = useKit();
  const shelves = useShelves();
  const hours = hoursLines(tenant.business_hours);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  return (
    <footer className="agro-footer">
      <div className="agro-wrap agro-foot-grid">
        <section className="agro-foot-card agro-foot-about">
          <Brand foot />
          <p>{tenant.footer_text || tenant.about_text || "Insumos, ferramentas e tudo para a sua propriedade, com atendimento de quem conhece o campo."}</p>
          <div className="agro-social">
            {tenant.instagram_url && (
              <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram">
                <Instagram size={19} />
              </a>
            )}
            {tenant.facebook_url && (
              <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook">
                <Facebook size={19} />
              </a>
            )}
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp">
                <MessageCircle size={19} />
              </a>
            )}
          </div>
        </section>
        <section className="agro-foot-card">
          <h2>Departamentos</h2>
          <ul>
            {shelves.slice(0, 6).map((c) => (
              <li key={c.id}>
                <Link to={path("/catalogo", { cat: String(c.id) })}>{c.name}</Link>
              </li>
            ))}
            <li>
              <Link to={path("/catalogo")}>Ver tudo</Link>
            </li>
          </ul>
        </section>
        <section className="agro-foot-card">
          <h2>A loja</h2>
          <ul>
            <li><Link to={path()}>Início</Link></li>
            <li><Link to={path("/catalogo")}>Catálogo</Link></li>
            <li><Link to={path("/sobre")}>Nossa loja</Link></li>
          </ul>
        </section>
        <section className="agro-foot-card">
          <h2>Atendimento</h2>
          <ul>
            {wa && (
              <li>
                <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={16} aria-hidden="true" /> {tenant.whatsapp}</a>
              </li>
            )}
            {tenant.show_address && tenant.address && (
              <li><span><MapPin size={16} aria-hidden="true" /> {tenant.address}</span></li>
            )}
            {hours.slice(0, 7).map((h) => (
              <li key={h.label}><span><Clock size={14} aria-hidden="true" /> {h.label}: {h.text}</span></li>
            ))}
          </ul>
        </section>
      </div>
      <p className="agro-credit">
        © {new Date().getFullYear()} {tenant.name} · Desenvolvido por{" "}
        <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a>
      </p>
    </footer>
  );
}
