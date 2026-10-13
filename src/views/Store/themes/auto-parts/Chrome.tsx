import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Cog, Facebook, Instagram, Menu, MessageCircle, ShoppingCart, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { hoursList, useShop, waLink } from "./lib";
import "./styles.css";
import "./storefront.css";

export function Header() {
  const { tenant, openCart, cartCount, path, vars, sf } = useShop();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const links = [
    { name: "Início", to: path() },
    { name: "Catálogo", to: path("/catalogo") },
    { name: "Sobre", to: path("/sobre") },
  ];
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const sub = (e.nativeEvent as SubmitEvent).submitter;
    if (sub && sub.getAttribute("type") !== "submit") return;
    const base = path("/catalogo");
    const sep = base.includes("?") ? "&" : "?";
    navigate(term.trim() ? `${base}${sep}q=${encodeURIComponent(term.trim())}` : base);
    setOpen(false);
  };
  const wa = waLink(tenant);
  return (
    <header className="tg-scope tg-header" style={vars}>
      <div className="tg-ticker">
        <div className="tg-wrap">
          <span>{sf.segment_label || "Autopeças & Acessórios"} · confirme a compatibilidade antes de comprar</span>
          {wa && <a href={wa} target="_blank" rel="noreferrer">Falar com a equipe</a>}
        </div>
      </div>
      <div className="tg-wrap tg-bar">
        <Link className="tg-brand" to={path()} aria-label={`${tenant.name} - página inicial`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="tg-brand-mark"><Cog size={22} /></span>}
          <b>{tenant.name}</b>
        </Link>
        <form className="tg-search" role="search" onSubmit={submit}>
          <SearchBar value={term} onChange={setTerm} placeholder="Buscar peça, código ou SKU" />
          <button type="submit">Buscar</button>
        </form>
        <div className="tg-actions">
          <button className="tg-icon-btn" aria-label={`Abrir carrinho, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`} onClick={openCart}>
            <ShoppingCart size={21} />
            {cartCount > 0 && <span className="tg-count">{cartCount}</span>}
          </button>
          <button className="tg-icon-btn tg-menu-btn" aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>
      <nav className="tg-nav" aria-label="Navegação principal">
        <div className="tg-wrap">
          {links.map((l) => (
            <Link key={l.name} to={l.to} aria-current={pathname === l.to.split("?")[0] ? "page" : undefined}>{l.name}</Link>
          ))}
        </div>
      </nav>
      {open && (
        <nav className="tg-drawer" aria-label="Menu">
          {links.map((l) => <Link key={l.name} to={l.to} onClick={() => setOpen(false)}>{l.name}</Link>)}
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant, categories, path, vars, sf } = useShop();
  const hours = hoursList(tenant);
  const wa = waLink(tenant);
  return (
    <footer className="tg-scope tg-footer" style={vars}>
      <div className="tg-wrap">
        <div className="tg-foot-grid">
          <div>
            <p className="tg-foot-name">{tenant.name}</p>
            <p>{tenant.footer_text || tenant.hero_tagline || sf.segment_label || "Peças, acessórios e ferramentas com atendimento técnico."}</p>
            {tenant.show_address && tenant.address && <p>{tenant.address}</p>}
          </div>
          <div>
            <h3>Navegação</h3>
            <ul>
              <li><Link to={path()}>Início</Link></li>
              <li><Link to={path("/catalogo")}>Catálogo de peças</Link></li>
              <li><Link to={path("/sobre")}>Sobre a garagem</Link></li>
              {categories.slice(0, 4).map((c) => <li key={c.id}><Link to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link></li>)}
            </ul>
          </div>
          <div>
            <h3>Contato</h3>
            <ul>
              {wa && <li><a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={15} style={{ marginRight: 8 }} />WhatsApp</a></li>}
              {tenant.instagram_url && <li><a href={tenant.instagram_url} target="_blank" rel="noreferrer"><Instagram size={15} style={{ marginRight: 8 }} />Instagram</a></li>}
              {tenant.facebook_url && <li><a href={tenant.facebook_url} target="_blank" rel="noreferrer"><Facebook size={15} style={{ marginRight: 8 }} />Facebook</a></li>}
            </ul>
          </div>
          <div>
            <h3>Horário</h3>
            {hours.length > 0 ? (
              <ul className="tg-hours">{hours.map((h) => <li key={h.day}><span>{h.day.slice(0, 3)}</span><span>{h.text}</span></li>)}</ul>
            ) : <p>Consulte nossos horários pelo WhatsApp.</p>}
          </div>
        </div>
        <p className="tg-foot-bottom">© {new Date().getFullYear()} {tenant.name} · Powered by <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a></p>
      </div>
    </footer>
  );
}
