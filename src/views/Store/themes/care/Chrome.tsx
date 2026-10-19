import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BookHeart, Clock, Facebook, Home, Instagram, LayoutGrid, MapPin, Menu, MessageCircle, Search, ShoppingBag, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { StoreButton } from "../../../../components/store/StoreButton";
import { hoursRows, useShop, whatsappLink } from "./core";
import { categoryIcon, Drop, T } from "./parts";
import "./styles.css";

export function Header() {
  const { tenant, categories, count, openCart, path } = useShop();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const links = [
    { name: "Início", to: path(), match: path().split("?")[0], icon: Home },
    { name: "Catálogo", to: path("/catalogo"), match: path("/catalogo").split("?")[0], icon: LayoutGrid },
    { name: "Nossa história", to: path("/sobre"), match: path("/sobre").split("?")[0], icon: BookHeart },
  ];
  const current = (m: string) => (pathname.replace(/\/$/, "") === m.replace(/\/$/, "") ? ("page" as const) : undefined);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(false);
    setMenu(false);
    navigate(path(q.trim() ? `/catalogo?q=${encodeURIComponent(q.trim())}` : "/catalogo"));
  };
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);
  return (
    <header className="ca ca-header">
      <div className="ca-bar">
        <div className="ca-bar-l">
          <button type="button" className="ca-icon ca-burger" aria-label="Abrir menu" aria-expanded={menu} onClick={() => { setMenu(true); setSearching(false); }}>
            <Menu size={22} />
          </button>
          <nav className="ca-nav" aria-label="Principal">
            {links.map((l) => (
              <Link key={l.name} to={l.to} aria-current={current(l.match)}>{l.name}</Link>
            ))}
          </nav>
        </div>
        <Link className="ca-brand" to={path()} aria-label={`${tenant.name} - início`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="ca-brand-mark"><Drop /></span>}
          <span>{tenant.name}</span>
        </Link>
        <div className="ca-actions">
          <button type="button" className="ca-icon" aria-label="Buscar produtos" aria-expanded={searching} onClick={() => setSearching((v) => !v)}>
            <Search size={21} />
          </button>
          <button type="button" className="ca-icon ca-bag" aria-label={`Abrir carrinho, ${count} itens`} onClick={openCart}>
            <ShoppingBag size={21} />
            {count > 0 && <b>{count}</b>}
          </button>
        </div>
      </div>
      {searching && (
        <form className="ca-drawer ca-searchform" role="search" onSubmit={submit}>
          <SearchBar value={q} onChange={setQ} placeholder="O que você quer cuidar hoje?" />
          <StoreButton type="submit" className="ca-b ca-b-solid">Buscar</StoreButton>
        </form>
      )}
      {menu && (
        <div className="ca-overlay" onClick={() => setMenu(false)}>
          <div className="ca-side" role="dialog" aria-modal="true" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
            <div className="ca-side-head">
              <span className="ca-brand-mark"><Drop /></span>
              <b>{tenant.name}</b>
              <button type="button" className="ca-icon" aria-label="Fechar menu" onClick={() => setMenu(false)}><X size={22} /></button>
            </div>
            <nav className="ca-side-links" aria-label="Menu principal">
              {links.map((l) => (
                <Link key={l.name} to={l.to} aria-current={current(l.match)} onClick={() => setMenu(false)}>
                  <span><l.icon size={20} aria-hidden="true" /></span>{l.name}
                </Link>
              ))}
            </nav>
            {categories.length > 0 && <p className="ca-side-title">Explore os cuidados</p>}
            <div className="ca-side-cats">
              {categories.slice(0, 10).map((c, i) => {
                const Icon = categoryIcon(i);
                return (
                  <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} onClick={() => setMenu(false)}>
                    <Icon size={16} aria-hidden="true" /> {c.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant, categories, path } = useShop();
  const hours = hoursRows(tenant);
  return (
    <footer className="ca ca-footer">
      <div className="ca-foot-in">
        <section className="ca-fcard ca-fcard-lead">
          <span className="ca-fcard-ico"><Drop /></span>
          <p className="ca-foot-name">{tenant.name}</p>
          <p className="ca-foot-text">{tenant.footer_text || tenant.hero_tagline || T.hero}</p>
          <div className="ca-social">
            {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={20} /></a>}
            {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={20} /></a>}
            {tenant.whatsapp && <a href={whatsappLink(tenant)} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={20} /></a>}
          </div>
        </section>
        <section className="ca-fcard ca-fcard-peach">
          <h3><LayoutGrid size={18} aria-hidden="true" /> Explore</h3>
          <Link to={path("/catalogo")}>Todo o catálogo</Link>
          {categories.slice(0, 5).map((c) => (
            <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link>
          ))}
        </section>
        <section className="ca-fcard ca-fcard-blue">
          <h3><MessageCircle size={18} aria-hidden="true" /> Fale com a gente</h3>
          <Link to={path("/sobre")}>Nossa história</Link>
          {tenant.whatsapp && <a href={whatsappLink(tenant)} target="_blank" rel="noreferrer">WhatsApp {tenant.whatsapp}</a>}
          {tenant.show_address && tenant.address && <span><MapPin size={15} aria-hidden="true" /> {tenant.address}</span>}
        </section>
        {hours.length > 0 && (
          <section className="ca-fcard ca-fcard-mint">
            <h3><Clock size={18} aria-hidden="true" /> Horários</h3>
            {hours.map((h) => (
              <span key={h.day} className="ca-hrow"><em>{h.day}</em>{h.text}</span>
            ))}
          </section>
        )}
      </div>
      <p className="ca-credit">
        © {new Date().getFullYear()} {tenant.name} · Powered by{" "}
        <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a>
      </p>
    </footer>
  );
}
