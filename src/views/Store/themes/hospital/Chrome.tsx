import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Facebook, Instagram, LayoutGrid, Menu, MessageCircle, ShieldCheck, ShoppingBag, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { StoreButton } from "../../../../components/store/StoreButton";
import { hoursList, useShop, waLink } from "./lib";
import "./styles.css";

export function Header() {
  const { tenant, categories, active, openCart, cartCount, path, vars, sf } = useShop();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [mega, setMega] = useState(false);
  const [term, setTerm] = useState("");
  const navRef = useRef<HTMLDivElement>(null);
  const links = [
    { name: "Início", to: path() },
    { name: "Catálogo", to: path("/catalogo") },
    { name: "Sobre nós", to: path("/sobre") },
  ];
  const specs = categories
    .map((c) => ({ ...c, count: active.filter((p) => p.category_id === c.id).length }))
    .filter((c) => c.count > 0);

  useEffect(() => {
    setOpen(false);
    setMega(false);
  }, [pathname]);

  useEffect(() => {
    if (!mega) return;
    const onDoc = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setMega(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMega(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [mega]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const base = path("/catalogo");
    navigate(term.trim() ? `${base}${base.includes("?") ? "&" : "?"}q=${encodeURIComponent(term.trim())}` : base);
    setOpen(false);
  };
  const wa = waLink(tenant);
  const cartLabel = sf.cart_title || "Pedido";
  return (
    <header className="ms-scope ms-header" style={vars}>
      <div className="ms-wrap">
        <div className="ms-top">
          <button className="ms-menubtn" aria-label="Abrir menu" aria-expanded={open} onClick={() => setOpen(true)}>
            <Menu size={21} />
          </button>
          <Link className="ms-brand" to={path()} aria-label={`${tenant.name} - início`}>
            {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="ms-brand-mark"><ShieldCheck size={22} /></span>}
            <span className="ms-brand-text">
              <b>{tenant.name}</b>
              <small>{sf.segment_label || "Materiais hospitalares"}</small>
            </span>
          </Link>
          <form className="ms-search" role="search" onSubmit={(e) => { const s = (e.nativeEvent as SubmitEvent).submitter; if (s && s.getAttribute("type") !== "submit") { e.preventDefault(); return; } submit(e); }}>
            <SearchBar value={term} onChange={setTerm} placeholder="Buscar material, código ou especialidade" />
          </form>
          <button className="ms-cart" onClick={openCart} aria-label={`Abrir ${cartLabel}, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`}>
            <ShoppingBag size={19} />
            <span>{cartLabel}</span>
            <em>{cartCount}</em>
          </button>
        </div>
        <div className="ms-navbar" ref={navRef}>
          <nav className="ms-nav" aria-label="Navegação principal">
            {specs.length > 0 && (
              <button className="ms-mega-btn" aria-expanded={mega} aria-controls="ms-mega" onClick={() => setMega((v) => !v)}>
                <LayoutGrid size={17} />Especialidades<ChevronDown size={16} className="chev" />
              </button>
            )}
            {links.map((l) => (
              <Link key={l.name} to={l.to} aria-current={pathname === l.to.split("?")[0] ? "page" : undefined}>{l.name}</Link>
            ))}
          </nav>
          {wa && (
            <a className="ms-navwa" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={16} />Falar com a equipe</a>
          )}
          {mega && specs.length > 0 && (
            <div className="ms-mega" id="ms-mega">
              <div className="ms-mega-grid">
                {specs.slice(0, 12).map((c) => (
                  <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} onClick={() => setMega(false)}>
                    <b>{c.name}</b><small>{c.count} {c.count === 1 ? "item" : "itens"}</small>
                  </Link>
                ))}
              </div>
              <Link className="ms-mega-all" to={path("/catalogo")} onClick={() => setMega(false)}>Ver catálogo completo</Link>
            </div>
          )}
        </div>
      </div>
      {open && (
        <div className="ms-overlay" onClick={() => setOpen(false)}>
          <nav className="ms-drawer" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
            <div className="ms-drawer-head">
              <b>{tenant.name}</b>
              <button aria-label="Fechar menu" onClick={() => setOpen(false)}><X size={21} /></button>
            </div>
            <form className="ms-search" role="search" onSubmit={(e) => { const s = (e.nativeEvent as SubmitEvent).submitter; if (s && s.getAttribute("type") !== "submit") { e.preventDefault(); return; } submit(e); }}>
              <SearchBar value={term} onChange={setTerm} placeholder="Buscar material ou código" />
            </form>
            {links.map((l) => <Link key={l.name} to={l.to}>{l.name}</Link>)}
            {specs.length > 0 && <small>Especialidades</small>}
            {specs.map((c) => <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>{c.name}<em>{c.count}</em></Link>)}
          </nav>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant, categories, active, path, vars, sf } = useShop();
  const hours = hoursList(tenant);
  const wa = waLink(tenant);
  const specs = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 6);
  return (
    <footer className="ms-scope ms-footer" style={vars}>
      <div className="ms-wrap">
        <div className="ms-foot-cta">
          <div>
            <p className="ms-serif">{tenant.name}</p>
            <p>{tenant.footer_text || tenant.hero_tagline || "Materiais, utensílios e equipamentos organizados para sua compra profissional."}</p>
          </div>
          <StoreButton asChild shape="soft" size="md" className="ms-fbtn">
            <Link to={path("/catalogo")}>{sf.hero_button_label || "Ver catálogo"}</Link>
          </StoreButton>
        </div>
        <div className="ms-foot-grid">
          <div className="ms-foot-card">
            <h3>Institucional</h3>
            <ul>
              <li><Link to={path()}>Início</Link></li>
              <li><Link to={path("/catalogo")}>Catálogo</Link></li>
              <li><Link to={path("/sobre")}>Sobre nós</Link></li>
            </ul>
          </div>
          {specs.length > 0 && (
            <div className="ms-foot-card">
              <h3>Especialidades</h3>
              <ul>{specs.map((c) => <li key={c.id}><Link to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link></li>)}</ul>
            </div>
          )}
          <div className="ms-foot-card">
            <h3>Atendimento</h3>
            <ul>
              {wa && <li><a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={15} />WhatsApp</a></li>}
              {tenant.instagram_url && <li><a href={tenant.instagram_url} target="_blank" rel="noreferrer"><Instagram size={15} />Instagram</a></li>}
              {tenant.facebook_url && <li><a href={tenant.facebook_url} target="_blank" rel="noreferrer"><Facebook size={15} />Facebook</a></li>}
            </ul>
            {tenant.show_address && tenant.address && <p className="ms-addr">{tenant.address}</p>}
          </div>
          <div className="ms-foot-card">
            <h3>Horários</h3>
            {hours.length ? <ul className="ms-hours">{hours.map((h) => <li key={h.day}><span>{h.day}</span><span>{h.text}</span></li>)}</ul> : <p>Consulte os horários pelo WhatsApp.</p>}
          </div>
        </div>
        <p className="ms-foot-bottom">© {new Date().getFullYear()} {tenant.name} · Powered by <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a></p>
      </div>
    </footer>
  );
}
