import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Facebook, Instagram, Menu, MessageCircle, Search, ShoppingBag, X } from "lucide-react";
import { useKit } from "./lib";
import "./styles.css";

const DAYS: Record<string, string> = { seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb", dom: "Dom" };

export function Header() {
  const { tenant, usedCategories, cart, openCart, path } = useKit();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);
  const [q, setQ] = useState("");
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const pages = [
    { name: "Início", to: path() },
    { name: "Catálogo", to: path("/catalogo") },
    { name: "Nossa loja", to: path("/sobre") },
  ];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    navigate(path(term ? `/catalogo?q=${encodeURIComponent(term)}` : "/catalogo"));
    setDrawer(false);
  };
  useEffect(() => setDrawer(false), [pathname, search]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  return (
    <header className="sp-header">
      <div className="sp-wrap sp-head-main">
        <button className="sp-icon sp-burger" type="button" onClick={() => setDrawer(true)} aria-label="Abrir menu" aria-expanded={drawer}><Menu size={22} /></button>
        <Link to={path()} className="sp-logo" aria-label={`${tenant.name} - início`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="sp-logo-mark">{tenant.name.slice(0, 1)}</span>}
          <strong>{tenant.name}</strong>
        </Link>
        <form className="sp-search" role="search" onSubmit={submit}>
          <Search size={19} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="O que você procura?" aria-label="Buscar produtos" />
          <button type="submit">Buscar</button>
        </form>
        <button className="sp-cart" type="button" onClick={openCart} aria-label={`Abrir carrinho com ${count} itens`}>
          <ShoppingBag size={21} /><span>Carrinho</span><b>{count}</b>
        </button>
      </div>
      <div className="sp-subnav">
        <nav className="sp-wrap" aria-label="Navegação principal">
          {pages.map((p) => <Link key={p.name} to={p.to} aria-current={pathname === p.to.split("?")[0] ? "page" : undefined}>{p.name}</Link>)}
          {usedCategories.length > 0 && <span className="sp-subnav-sep" aria-hidden="true" />}
          {usedCategories.slice(0, 6).map((c) => <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link>)}
        </nav>
      </div>
      {drawer && (
        <div className="sp-backdrop" onClick={() => setDrawer(false)}>
          <aside className="sp-drawer" role="dialog" aria-modal="true" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
            <div className="sp-drawer-head"><strong>{tenant.name}</strong><button className="sp-icon" onClick={() => setDrawer(false)} aria-label="Fechar menu"><X size={22} /></button></div>
            <form onSubmit={submit} className="sp-search sp-search--drawer">
              <Search size={18} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produtos" aria-label="Buscar produtos" />
            </form>
            <nav aria-label="Navegação móvel">{pages.map((p) => <Link key={p.name} to={p.to}>{p.name}<ArrowRight size={18} /></Link>)}</nav>
            {usedCategories.length > 0 && (
              <>
                <h3>Esportes e categorias</h3>
                <nav aria-label="Categorias">{usedCategories.slice(0, 10).map((c) => <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>{c.name}<ArrowRight size={18} /></Link>)}</nav>
              </>
            )}
          </aside>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant, usedCategories, path, sf } = useKit();
  const wa = (tenant.whatsapp || "").replace(/\D/g, "");
  const hours = Object.entries(tenant.business_hours || {}).filter(([, h]) => !!h);
  return (
    <footer className="sp-footer">
      <div className="sp-wrap">
        <div className="sp-fgrid">
          <section className="sp-fcard sp-fcard--brand">
            <h3>{tenant.name}</h3>
            <p>{tenant.footer_text || tenant.about_text || "Tudo para acompanhar seu movimento."}</p>
            {tenant.show_address && tenant.address && <p>{tenant.address}</p>}
            <Link to={path("/catalogo")} className="sp-btn">{sf.hero_button_label || "Explorar catálogo"} <ArrowRight size={18} /></Link>
          </section>
          <section className="sp-fcard">
            <h3>Navegação</h3>
            <Link to={path()}>Início</Link><Link to={path("/catalogo")}>Catálogo</Link><Link to={path("/sobre")}>Nossa loja</Link>
          </section>
          {usedCategories.length > 0 && (
            <section className="sp-fcard">
              <h3>Categorias</h3>
              {usedCategories.slice(0, 5).map((c) => <Link to={path(`/catalogo?cat=${c.id}`)} key={c.id}>{c.name}</Link>)}
            </section>
          )}
          <section className="sp-fcard">
            <h3>Atendimento</h3>
            {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a>}
            {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer"><Instagram size={16} /> Instagram</a>}
            {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer"><Facebook size={16} /> Facebook</a>}
            {hours.length > 0 && <div className="sp-hours">{hours.map(([d, h]) => <p key={d}><span>{DAYS[d] || d}</span><span>{h.closed ? "Fechado" : `${h.open}–${h.close}`}</span></p>)}</div>}
          </section>
        </div>
        <div className="sp-fbottom"><span>© {new Date().getFullYear()} {tenant.name}</span><span>Powered by <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a></span></div>
      </div>
    </footer>
  );
}
