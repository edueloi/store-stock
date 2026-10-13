import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Clock, Facebook, Instagram, Menu, MessageCircle, ShieldCheck, ShoppingBag, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { hoursList, useShop, waLink } from "./lib";
import "./styles.css";

export function Header() {
  const { tenant, categories, active, openCart, cartCount, path, vars, sf } = useShop();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const links = [
    { name: "Início", to: path() },
    { name: "Catálogo", to: path("/catalogo") },
    { name: "Sobre nós", to: path("/sobre") },
  ];
  const specs = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 5);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const base = path("/catalogo");
    navigate(term.trim() ? `${base}${base.includes("?") ? "&" : "?"}q=${encodeURIComponent(term.trim())}` : base);
    setOpen(false);
  };
  const wa = waLink(tenant);
  const cartLabel = sf.cart_title || "Pedido de suprimentos";
  return (
    <header className="ms-scope ms-header" style={vars}>
      <div className="ms-util">
        <div className="ms-wrap">
          <span><ShieldCheck size={16} />Atendimento profissional</span>
          <span className="ms-hide-m"><Clock size={15} />{sf.segment_label || "Materiais hospitalares"}</span>
          {wa ? <a href={wa} target="_blank" rel="noreferrer">Falar com a equipe</a> : <span />}
        </div>
      </div>
      <div className="ms-wrap">
        <div className="ms-top">
          <button className="ms-menubtn" aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
          <form className="ms-search" role="search" onSubmit={(e) => { const s = (e.nativeEvent as SubmitEvent).submitter; if (s && s.getAttribute("type") !== "submit") { e.preventDefault(); return; } submit(e); }}>
            <SearchBar value={term} onChange={setTerm} placeholder="Buscar material ou código" />
          </form>
          <Link className="ms-brand" to={path()} aria-label={`${tenant.name} - início`}>
            {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : null}
            <b>{tenant.name}</b>
            <small>{sf.segment_label || "Materiais hospitalares"}</small>
          </Link>
          <div className="ms-right">
            <button className="ms-cart" onClick={openCart} aria-label={`Abrir ${cartLabel}, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`}>
              <ShoppingBag size={19} />
              <span>{cartLabel}</span>
              <em>{cartCount}</em>
            </button>
          </div>
        </div>
        <nav className="ms-nav" aria-label="Navegação principal">
          {links.map((l) => (
            <Link key={l.name} to={l.to} aria-current={pathname === l.to.split("?")[0] ? "page" : undefined}>{l.name}</Link>
          ))}
          {specs.length > 0 && <i />}
          {specs.map((c) => <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link>)}
        </nav>
      </div>
      {open && (
        <nav className="ms-drawer" aria-label="Menu">
          {links.map((l) => <Link key={l.name} to={l.to} onClick={() => setOpen(false)}>{l.name}</Link>)}
          {specs.length > 0 && <small>Especialidades</small>}
          {specs.map((c) => <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} onClick={() => setOpen(false)}>{c.name}</Link>)}
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
    <footer className="ms-scope ms-footer" style={vars}>
      <div className="ms-wrap">
        <div className="ms-foot-top">
          <div>
            <p className="ms-serif">{tenant.name}</p>
            <p>{tenant.footer_text || tenant.hero_tagline || "Materiais, utensílios e equipamentos organizados para sua compra profissional."}</p>
          </div>
          <Link className="ms-btn" to={path("/catalogo")}>{sf.hero_button_label || "Ver catálogo"}</Link>
        </div>
        <div className="ms-foot-grid">
          <div>
            <h3>Institucional</h3>
            <ul>
              <li><Link to={path()}>Início</Link></li>
              <li><Link to={path("/catalogo")}>Catálogo</Link></li>
              <li><Link to={path("/sobre")}>Sobre nós</Link></li>
            </ul>
          </div>
          <div>
            <h3>Especialidades</h3>
            <ul>{categories.slice(0, 6).map((c) => <li key={c.id}><Link to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link></li>)}</ul>
          </div>
          <div>
            <h3>Atendimento</h3>
            <ul>
              {wa && <li><a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={15} />WhatsApp</a></li>}
              {tenant.instagram_url && <li><a href={tenant.instagram_url} target="_blank" rel="noreferrer"><Instagram size={15} />Instagram</a></li>}
              {tenant.facebook_url && <li><a href={tenant.facebook_url} target="_blank" rel="noreferrer"><Facebook size={15} />Facebook</a></li>}
            </ul>
            {tenant.show_address && tenant.address && <p style={{ marginTop: 10 }}>{tenant.address}</p>}
          </div>
          <div>
            <h3>Horários</h3>
            {hours.length ? <ul className="ms-hours">{hours.map((h) => <li key={h.day}><span>{h.day}</span><span>{h.text}</span></li>)}</ul> : <p>Consulte os horários pelo WhatsApp.</p>}
          </div>
        </div>
        <p className="ms-foot-bottom">© {new Date().getFullYear()} {tenant.name} · Powered by <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a></p>
      </div>
    </footer>
  );
}
