import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, Facebook, Instagram, MessageCircle, Search, ShoppingBag, X } from "lucide-react";
import { hoursRows, useKit, useUsedCategories } from "./kit";
import "./styles.css";

function Wordmark() {
  const { tenant, path } = useKit();
  return (
    <Link to={path()} className="atl-logo" aria-label={`${tenant.name} - página inicial`}>
      {tenant.logo_url ? <img src={tenant.logo_url} alt={tenant.name} /> : <span>{tenant.name}</span>}
    </Link>
  );
}

export function Header() {
  const { cartCount, openCart, path } = useKit();
  const cats = useUsedCategories();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<"" | "menu" | "search">("");
  const [query, setQuery] = useState("");

  useEffect(() => setPanel(""), [pathname, search]);
  useEffect(() => {
    if (!panel) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setPanel("");
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [panel]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(path(q ? `/catalogo?q=${encodeURIComponent(q)}` : "/catalogo"));
  };
  const cur = (to: string): "page" | undefined => (pathname === to.split("?")[0] ? "page" : undefined);

  return (
    <div className="atl-header" role="banner">
      <div className="atl-bar">
        <div className="atl-bar-left">
          <button type="button" className="atl-menu-btn" aria-expanded={panel === "menu"} aria-controls="atl-panel" onClick={() => setPanel((p) => (p === "menu" ? "" : "menu"))}>
            <span className="atl-burger" aria-hidden="true"><i /><i /></span>
            <span>Menu</span>
          </button>
          <nav className="atl-nav" aria-label="Principal">
            <Link to={path("/catalogo")} aria-current={cur(path("/catalogo"))}>Coleção</Link>
            <Link to={path("/sobre")} aria-current={cur(path("/sobre"))}>Ateliê</Link>
          </nav>
        </div>
        <Wordmark />
        <div className="atl-bar-right">
          <button type="button" className="atl-icon" aria-label={panel === "search" ? "Fechar busca" : "Buscar"} aria-expanded={panel === "search"} onClick={() => setPanel((p) => (p === "search" ? "" : "search"))}>
            {panel === "search" ? <X size={21} strokeWidth={1.5} /> : <Search size={21} strokeWidth={1.5} />}
          </button>
          <button type="button" className="atl-icon" onClick={openCart} aria-label={`Abrir sacola, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`}>
            <ShoppingBag size={21} strokeWidth={1.5} />
            {cartCount > 0 && <span className="atl-count">{cartCount}</span>}
          </button>
        </div>
      </div>

      {panel === "search" && (
        <form className="atl-searchpanel" role="search" onSubmit={submit}>
          <Search size={20} strokeWidth={1.5} aria-hidden="true" />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="O que você procura?" aria-label="Buscar peças" />
          <button type="submit" className="atl-btn">Buscar</button>
        </form>
      )}

      {panel === "menu" && (
        <div className="atl-panel" id="atl-panel" role="dialog" aria-label="Menu">
          <div className="atl-panel-in">
            <nav className="atl-panel-main" aria-label="Menu">
              <Link to={path()} aria-current={cur(path())}>Início</Link>
              <Link to={path("/catalogo")}>Coleção</Link>
              <Link to={path("/sobre")}>Ateliê</Link>
            </nav>
            {cats.length > 0 && (
              <div className="atl-panel-cats">
                <p>Categorias</p>
                <ul>
                  {cats.slice(0, 12).map((c) => (
                    <li key={c.id}>
                      <Link to={path(`/catalogo?categoria=${c.id}`)}>{c.name} <ArrowUpRight size={15} aria-hidden="true" /></Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Footer() {
  const { tenant, path, waLink } = useKit();
  const cats = useUsedCategories();
  const hours = hoursRows(tenant);
  const wa = waLink(`Olá! Vim pela loja ${tenant.name}.`);
  return (
    <div className="atl-footer" role="contentinfo">
      <div className="atl-foot-grid">
        <section className="atl-foot-card atl-foot-brand">
          <span className="atl-foot-name">{tenant.name}</span>
          <p>{tenant.footer_text || tenant.about_text || "Peças com assinatura própria, feitas para durar."}</p>
          <div className="atl-social">
            {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={19} strokeWidth={1.5} /></a>}
            {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={19} strokeWidth={1.5} /></a>}
            {wa && <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={19} strokeWidth={1.5} /></a>}
          </div>
        </section>
        <section className="atl-foot-card">
          <h2>Coleção</h2>
          {cats.slice(0, 6).map((c) => <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>{c.name}</Link>)}
          <Link to={path("/catalogo")}>Ver tudo</Link>
        </section>
        <section className="atl-foot-card">
          <h2>Ateliê</h2>
          <Link to={path("/sobre")}>Nossa história</Link>
          {wa && <a href={wa} target="_blank" rel="noreferrer">{tenant.whatsapp}</a>}
          {tenant.show_address && tenant.address && <p>{tenant.address}</p>}
          {hours.length > 0 && (
            <ul className="atl-hours">
              {hours.map((h) => <li key={h.day}><span>{h.day}</span> {h.text}</li>)}
            </ul>
          )}
        </section>
      </div>
      <p className="atl-credit">
        © {new Date().getFullYear()} {tenant.name} · Desenvolvido por{" "}
        <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a>
      </p>
    </div>
  );
}
