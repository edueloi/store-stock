import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Clock, Facebook, Home, Info, Instagram, LayoutGrid, MapPin, Menu, MessageCircle, Search, ShoppingCart, X, Zap } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { hoursLines, useShop, whatsappHref } from "./kit";
import "./styles.css";

function HeaderSearch({ className, onDone }: { className: string; onDone?: () => void }) {
  const { path } = useShop();
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onDone?.();
    navigate(path("/catalogo", { q: value.trim() }));
  };
  return (
    <form className={className} role="search" onSubmit={submit}>
      <SearchBar value={value} onChange={setValue} placeholder="Buscar produtos" />
    </form>
  );
}

export function Header() {
  const { tenant, categories, active, openCart, cartCount, path } = useShop();
  const { pathname } = useLocation();
  const [side, setSide] = useState(false);
  const [find, setFind] = useState(false);
  const used = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 14);
  const links = [
    { name: "Início", to: path(), icon: Home, on: !/catalogo|sobre|produto/.test(pathname) },
    { name: "Catálogo", to: path("/catalogo"), icon: LayoutGrid, on: /catalogo|produto/.test(pathname) },
    { name: "Sobre a loja", to: path("/sobre"), icon: Info, on: /sobre/.test(pathname) },
  ];

  useEffect(() => {
    setSide(false);
    setFind(false);
  }, [pathname]);
  useEffect(() => {
    if (!side) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSide(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [side]);

  return (
    <header className="cy-scope cy-head">
      <div className="cy-wrap cy-pill">
        <button type="button" className="cy-round cy-menu" aria-label="Abrir menu e categorias" aria-expanded={side} onClick={() => setSide(true)}>
          <Menu size={20} />
        </button>
        <nav className="cy-nav" aria-label="Principal">
          {links.map((l) => (
            <Link key={l.name} to={l.to} aria-current={l.on ? "page" : undefined}>{l.name}</Link>
          ))}
        </nav>
        <Link className="cy-logo" to={path()} aria-label={`${tenant.name} - início`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="bolt" aria-hidden="true"><Zap size={16} /></span>}
          <span className="nm">{tenant.name}</span>
        </Link>
        <HeaderSearch className="cy-search" />
        <button type="button" className="cy-round cy-find" aria-label="Buscar" aria-expanded={find} onClick={() => setFind((v) => !v)}>
          <Search size={19} />
        </button>
        <button type="button" className="cy-round cy-cart" aria-label={`Abrir carrinho, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`} onClick={openCart}>
          <ShoppingCart size={19} />
          <span className="n">{cartCount}</span>
        </button>
      </div>
      {find && (
        <div className="cy-wrap cy-find-row">
          <HeaderSearch className="cy-search-mobile" onDone={() => setFind(false)} />
        </div>
      )}

      {side && (
        <div className="cy-side-wrap">
          <button type="button" className="cy-scrim" aria-label="Fechar menu" onClick={() => setSide(false)} />
          <aside className="cy-side" role="dialog" aria-modal="true" aria-label="Menu e categorias">
            <div className="cy-side-top">
              <strong>{tenant.name}</strong>
              <button type="button" className="cy-round" aria-label="Fechar menu" onClick={() => setSide(false)}><X size={19} /></button>
            </div>
            <nav className="cy-side-nav" aria-label="Menu">
              {links.map((l) => (
                <Link key={l.name} to={l.to} aria-current={l.on ? "page" : undefined}><l.icon size={18} /> {l.name}</Link>
              ))}
            </nav>
            {used.length > 0 && (
              <>
                <p className="cy-side-title">Categorias</p>
                <div className="cy-side-cats">
                  {used.map((c) => (
                    <Link key={c.id} to={path("/catalogo", { categoria: String(c.id) })}>
                      {c.name}<small>{active.filter((p) => p.category_id === c.id).length}</small>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant, categories, active, path } = useShop();
  const hours = hoursLines(tenant);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 6);
  const wa = tenant.whatsapp ? whatsappHref(tenant, `Olá! Vim pela loja ${tenant.name}.`) : "";
  return (
    <footer className="cy-scope cy-foot">
      <div className="cy-wrap cy-foot-grid">
        <section className="cy-foot-card cy-foot-about">
          <p className="brand">{tenant.name}</p>
          <p>{tenant.footer_text || tenant.about_text || "Setup, acessórios e novidades para o seu espaço."}</p>
          <div className="cy-social">
            {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>}
            {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={18} /></a>}
            {wa && <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={18} /></a>}
          </div>
        </section>
        <section className="cy-foot-card">
          <h3>Navegar</h3>
          <ul>
            <li><Link to={path()}>Início</Link></li>
            <li><Link to={path("/catalogo")}>Todos os produtos</Link></li>
            <li><Link to={path("/sobre")}>Sobre a loja</Link></li>
          </ul>
        </section>
        {cats.length > 0 && (
          <section className="cy-foot-card">
            <h3>Categorias</h3>
            <ul>{cats.map((c) => <li key={c.id}><Link to={path("/catalogo", { categoria: String(c.id) })}>{c.name}</Link></li>)}</ul>
          </section>
        )}
        <section className="cy-foot-card">
          <h3>Contato</h3>
          <ul>
            {wa && <li><a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={15} /> {tenant.whatsapp}</a></li>}
            {tenant.show_address && tenant.address && <li><p><MapPin size={15} /> {tenant.address}</p></li>}
            {hours.length > 0 && <li><p className="hh"><Clock size={15} /> Horários</p></li>}
            {hours.map((h) => <li key={h.day} className="hr"><span>{h.day}</span><span>{h.text}</span></li>)}
          </ul>
        </section>
      </div>
      <div className="cy-wrap cy-foot-end">
        © {new Date().getFullYear()} {tenant.name} · Powered by <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a>
      </div>
    </footer>
  );
}
