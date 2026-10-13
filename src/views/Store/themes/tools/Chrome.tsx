import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ClipboardList, Facebook, Grid3x3, Hammer, Instagram, Menu, MessageCircle, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { hoursList, useShop, waLink } from "./lib";
import "./styles.css";

export function Header() {
  const { tenant, categories, active, openCart, cartCount, path, vars, sf } = useShop();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [mega, setMega] = useState(false);
  const [term, setTerm] = useState("");
  const links = [
    { name: "Início", to: path() },
    { name: "Catálogo", to: path("/catalogo") },
    { name: "Nossa oficina", to: path("/sobre") },
  ];
  const depts = categories.filter((c) => active.some((p) => p.category_id === c.id));
  const search = (e: FormEvent) => {
    e.preventDefault();
    const sub = (e.nativeEvent as SubmitEvent).submitter;
    if (sub && sub.getAttribute("type") !== "submit") return;
    const base = path("/catalogo");
    navigate(term.trim() ? `${base}${base.includes("?") ? "&" : "?"}q=${encodeURIComponent(term.trim())}` : base);
    setOpen(false);
  };
  const wa = waLink(tenant);
  const cartLabel = sf.cart_title || "Lista de materiais";
  return (
    <header className="op-scope op-header" style={vars}>
      <div className="op-topbar">
        <div className="op-wrap">
          <span>{sf.segment_label || "Ferramentas & Construção"} · orçamento de materiais online</span>
          {wa && <a href={wa} target="_blank" rel="noreferrer">Atendimento no WhatsApp</a>}
        </div>
      </div>
      <div className="op-wrap op-main">
        <Link className="op-brand" to={path()} aria-label={`${tenant.name} - início`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="op-brand-mark"><Hammer size={24} /></span>}
          <b>{tenant.name}</b>
        </Link>
        <form className="op-search" role="search" onSubmit={search}>
          <SearchBar value={term} onChange={setTerm} placeholder="Buscar ferramenta, material ou referência" />
          <button type="submit" hidden>Buscar</button>
        </form>
        <button className="op-cartbtn" onClick={openCart} aria-label={`Abrir ${cartLabel}, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`}>
          <ClipboardList size={20} />
          <span>{cartLabel}</span>
          <em>{cartCount}</em>
        </button>
        <button className="op-menubtn" aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      <div className="op-subnav">
        <div className="op-wrap">
          <button className="op-deptbtn" aria-expanded={mega} aria-haspopup="true" onClick={() => setMega((v) => !v)}>
            <Grid3x3 size={17} /> Departamentos
          </button>
          <nav aria-label="Navegação principal">
            {links.map((l) => (
              <Link key={l.name} to={l.to} aria-current={pathname === l.to.split("?")[0] ? "page" : undefined}>{l.name}</Link>
            ))}
          </nav>
          {mega && (
            <div className="op-mega" role="menu">
              {depts.length === 0 && <span style={{ padding: 14, fontSize: 14 }}>Sem departamentos cadastrados.</span>}
              {depts.map((c) => (
                <Link key={c.id} role="menuitem" to={path(`/catalogo?cat=${c.id}`)} onClick={() => setMega(false)}>
                  {c.name}<small>{active.filter((p) => p.category_id === c.id).length}</small>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      {open && (
        <nav className="op-drawer" aria-label="Menu">
          <h4>Menu</h4>
          {links.map((l) => <Link key={l.name} to={l.to} onClick={() => setOpen(false)}>{l.name}</Link>)}
          {depts.length > 0 && <h4>Departamentos</h4>}
          {depts.map((c) => <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} onClick={() => setOpen(false)}>{c.name}</Link>)}
        </nav>
      )}
      <div className="op-stripe" aria-hidden="true" />
    </header>
  );
}

export function Footer() {
  const { tenant, categories, path, vars, sf } = useShop();
  const hours = hoursList(tenant);
  const wa = waLink(tenant);
  return (
    <footer className="op-scope op-footer" style={vars}>
      <div className="op-stripe" aria-hidden="true" />
      <div className="op-wrap">
        <div className="op-foot-grid">
          <div>
            <p className="op-foot-name">{tenant.name}</p>
            <p>{tenant.footer_text || tenant.hero_tagline || sf.segment_label || "Ferramentas, materiais e acessórios para tirar projetos do papel."}</p>
            {tenant.show_address && tenant.address && <p>{tenant.address}</p>}
          </div>
          <div>
            <h3>Loja</h3>
            <ul>
              <li><Link to={path()}>Início</Link></li>
              <li><Link to={path("/catalogo")}>Catálogo</Link></li>
              <li><Link to={path("/sobre")}>Nossa oficina</Link></li>
            </ul>
          </div>
          <div>
            <h3>Departamentos</h3>
            <ul>{categories.slice(0, 6).map((c) => <li key={c.id}><Link to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link></li>)}</ul>
          </div>
          <div>
            <h3>Atendimento</h3>
            <ul>
              {wa && <li><a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={15} />WhatsApp</a></li>}
              {tenant.instagram_url && <li><a href={tenant.instagram_url} target="_blank" rel="noreferrer"><Instagram size={15} />Instagram</a></li>}
              {tenant.facebook_url && <li><a href={tenant.facebook_url} target="_blank" rel="noreferrer"><Facebook size={15} />Facebook</a></li>}
            </ul>
            {hours.length > 0 && <ul className="op-hours" style={{ marginTop: 12 }}>{hours.map((h) => <li key={h.day}><span>{h.day.slice(0, 3)}</span><span>{h.text}</span></li>)}</ul>}
          </div>
        </div>
        <p className="op-foot-bottom">© {new Date().getFullYear()} {tenant.name} · Powered by <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a></p>
      </div>
    </footer>
  );
}
