import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Clock, Facebook, Instagram, LayoutGrid, MapPin, Menu, MessageCircle, Search, ShoppingBag, X } from "lucide-react";
import { hoursRows, useShop, whatsappLink } from "./core";
import { CatIcon, Cross, T } from "./parts";
import "./styles.css";

export function Header() {
  const { tenant, categories, count, openCart, path } = useShop();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);
  const [mega, setMega] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    setDrawer(false);
    setMega(false);
  }, [pathname, search]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMega(false);
        setDrawer(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(path(q.trim() ? `/catalogo?q=${encodeURIComponent(q.trim())}` : "/catalogo"));
  };
  const links = [
    { name: "Início", to: path(), match: path().split("?")[0] },
    { name: "Catálogo", to: path("/catalogo"), match: path("/catalogo").split("?")[0] },
    { name: "Nossa loja", to: path("/sobre"), match: path("/sobre").split("?")[0] },
  ];
  const current = (m: string) => (pathname.replace(/\/$/, "") === m.replace(/\/$/, "") ? ("page" as const) : undefined);

  return (
    <header className="ph ph-header">
      <div className="ph-wrap ph-main">
        <button type="button" className="ph-burger" aria-label="Abrir menu" aria-expanded={drawer} onClick={() => setDrawer(true)}>
          <Menu size={22} />
        </button>
        <Link className="ph-brand" to={path()} aria-label={`${tenant.name} - início`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="ph-brand-mark"><Cross size={20} /></span>}
          <span className="ph-brand-name">{tenant.name}</span>
        </Link>
        <form className="ph-search" onSubmit={submit} role="search">
          <label className="ph-sr" htmlFor="ph-head-q">Buscar produto</label>
          <Search size={18} aria-hidden="true" />
          <input id="ph-head-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busque por nome ou código do produto" />
          <button type="submit">Buscar</button>
        </form>
        <button type="button" className="ph-cart" onClick={openCart} aria-label={`Abrir carrinho, ${count} itens`}>
          <ShoppingBag size={22} aria-hidden="true" />
          <span className="ph-cart-label">Pedido</span>
          <b>{count}</b>
        </button>
      </div>

      <nav className="ph-nav" aria-label="Principal">
        <div className="ph-wrap ph-nav-in">
          {categories.length > 0 && (
            <div className="ph-mega">
              <button type="button" className="ph-mega-btn" aria-expanded={mega} aria-controls="ph-mega-panel" onClick={() => setMega((v) => !v)}>
                <LayoutGrid size={18} aria-hidden="true" /> Departamentos <ChevronDown size={16} aria-hidden="true" />
              </button>
              {mega && (
                <>
                  <button type="button" className="ph-mega-scrim" aria-label="Fechar departamentos" onClick={() => setMega(false)} />
                  <div id="ph-mega-panel" className="ph-mega-panel">
                    {categories.slice(0, 12).map((c, i) => (
                      <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>
                        <CatIcon index={i} size={22} /> <span>{c.name}</span>
                      </Link>
                    ))}
                    <Link to={path("/catalogo")} className="ph-mega-all">Ver todo o catálogo</Link>
                  </div>
                </>
              )}
            </div>
          )}
          {links.map((l) => (
            <Link key={l.name} to={l.to} aria-current={current(l.match)}>{l.name}</Link>
          ))}
          {tenant.whatsapp && (
            <a className="ph-nav-wpp" href={whatsappLink(tenant)} target="_blank" rel="noreferrer">
              <MessageCircle size={16} aria-hidden="true" /> Fale com a farmácia
            </a>
          )}
        </div>
      </nav>

      {drawer && (
        <div className="ph-drawer-root">
          <button type="button" className="ph-drawer-scrim" aria-label="Fechar menu" onClick={() => setDrawer(false)} />
          <aside className="ph-drawer" aria-label="Menu">
            <div className="ph-drawer-head">
              <b>{tenant.name}</b>
              <button type="button" aria-label="Fechar menu" onClick={() => setDrawer(false)}><X size={22} /></button>
            </div>
            <div className="ph-drawer-body">
              {links.map((l) => (
                <Link key={l.name} to={l.to} aria-current={current(l.match)}>{l.name}</Link>
              ))}
              {categories.length > 0 && <p className="ph-drawer-title">Departamentos</p>}
              {categories.map((c) => (
                <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link>
              ))}
            </div>
          </aside>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant, categories, path } = useShop();
  const hours = hoursRows(tenant);
  return (
    <footer className="ph ph-footer">
      <div className="ph-wrap">
        <div className="ph-trust">
          <div><Cross size={22} /><span><b>Retirada na loja</b> Reserve online e retire com praticidade.</span></div>
          <div><MessageCircle size={22} aria-hidden="true" /><span><b>Atendimento próximo</b> Tire dúvidas antes de decidir.</span></div>
          <div><Clock size={22} aria-hidden="true" /><span><b>Informação clara</b> Preços e disponibilidade à vista.</span></div>
        </div>
        <div className="ph-foot-grid">
          <section className="ph-foot-card ph-foot-about">
            <p className="ph-foot-brand">{tenant.name}</p>
            <p>{tenant.footer_text || tenant.about_text || T.sub}</p>
            <div className="ph-social">
              {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={20} /></a>}
              {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={20} /></a>}
              {tenant.whatsapp && <a href={whatsappLink(tenant)} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={20} /></a>}
            </div>
          </section>
          <section className="ph-foot-card">
            <h3>Departamentos</h3>
            <ul>
              {categories.slice(0, 6).map((c) => (
                <li key={c.id}><Link to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link></li>
              ))}
              <li><Link to={path("/catalogo")}>Todo o catálogo</Link></li>
            </ul>
          </section>
          <section className="ph-foot-card">
            <h3>Atendimento</h3>
            <ul>
              <li><Link to={path("/sobre")}>Nossa loja</Link></li>
              {tenant.whatsapp && <li><a href={whatsappLink(tenant)} target="_blank" rel="noreferrer">WhatsApp {tenant.whatsapp}</a></li>}
              {tenant.show_address && tenant.address && <li className="ph-foot-addr"><MapPin size={16} aria-hidden="true" /> {tenant.address}</li>}
            </ul>
          </section>
          {hours.length > 0 && (
            <section className="ph-foot-card">
              <h3>Horários</h3>
              <ul className="ph-hours">
                {hours.map((h) => (
                  <li key={h.day} className={h.closed ? "is-closed" : ""}><span>{h.day}</span><span>{h.text}</span></li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <p className="ph-credit">
          © {new Date().getFullYear()} {tenant.name} · Powered by{" "}
          <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a>
        </p>
      </div>
    </footer>
  );
}
