import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Facebook, Instagram, Menu, MessageCircle, Search, ShoppingBasket, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { hoursRows, useShop, whatsappLink } from "./core";
import { Leaf, Sprig, T } from "./parts";
import "./styles.css";

export function Header() {
  const { tenant, categories, count, openCart, path, config } = useShop();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const here = (m: string) => (pathname.replace(/\/$/, "") === m.split("?")[0].replace(/\/$/, "") ? ("page" as const) : undefined);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(false);
    setMenu(false);
    navigate(path(q.trim() ? `/catalogo?q=${encodeURIComponent(q.trim())}` : "/catalogo"));
  };
  const Brand = (
    <Link className="or-brand" to={path()} aria-label={`${tenant.name} - início`}>
      {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <Leaf size={26} />}
      <span>{tenant.name}</span>
    </Link>
  );
  return (
    <header className="or or-header">
      <div className="or-strip">{config.segment_label || T.tag} · 100% natural</div>
      <div className="or-bar">
        <nav className="or-side or-left" aria-label="Principal">
          <Link to={path()} aria-current={here(path())}>Início</Link>
          <Link to={path("/catalogo")} aria-current={here(path("/catalogo"))}>Catálogo</Link>
        </nav>
        <button type="button" className="or-iconbtn or-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          {menu ? <X size={24} /> : <Menu size={24} />}
        </button>
        {Brand}
        <div className="or-side or-right">
          <Link className="or-about-link" to={path("/sobre")} aria-current={here(path("/sobre"))}>Nossa loja</Link>
          <button type="button" className="or-iconbtn" aria-label="Buscar produtos" aria-expanded={searching} onClick={() => setSearching((v) => !v)}>
            <Search size={21} />
          </button>
          <button type="button" className="or-iconbtn or-basket" aria-label={`Abrir carrinho, ${count} itens`} onClick={openCart}>
            <ShoppingBasket size={22} />
            <b>{count}</b>
          </button>
        </div>
      </div>
      {categories.length > 0 && (
        <nav className="or-cats" aria-label="Coleções">
          {categories.slice(0, 7).map((c) => (
            <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link>
          ))}
        </nav>
      )}
      {searching && (
        <form className="or-searchrow" role="search" onSubmit={submit}>
          <SearchBar value={q} onChange={setQ} placeholder="Procure por um produto" />
          <button type="submit" className="or-btn">Buscar</button>
        </form>
      )}
      {menu && (
        <nav className="or-sheet" aria-label="Menu">
          <Link to={path()} aria-current={here(path())} onClick={() => setMenu(false)}>Início</Link>
          <Link to={path("/catalogo")} aria-current={here(path("/catalogo"))} onClick={() => setMenu(false)}>Catálogo</Link>
          <Link to={path("/sobre")} aria-current={here(path("/sobre"))} onClick={() => setMenu(false)}>Nossa loja</Link>
          {categories.slice(0, 8).map((c) => (
            <Link key={c.id} className="or-sheet-cat" to={path(`/catalogo?cat=${c.id}`)} onClick={() => setMenu(false)}>{c.name}</Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant, categories, path } = useShop();
  const hours = hoursRows(tenant);
  return (
    <footer className="or or-footer">
      <div className="or-foot-top">
        <Sprig className="or-sprig" />
        <p className="or-foot-name">{tenant.name}</p>
        <p className="or-foot-text">{tenant.footer_text || tenant.hero_tagline || T.hero}</p>
        <div className="or-social">
          {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={20} /></a>}
          {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={20} /></a>}
          {tenant.whatsapp && <a href={whatsappLink(tenant)} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={20} /></a>}
        </div>
      </div>
      <div className="or-foot-cols">
        <div>
          <h3>Coleções</h3>
          <ul>
            {categories.slice(0, 6).map((c) => (<li key={c.id}><Link to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link></li>))}
            <li><Link to={path("/catalogo")}>Ver tudo</Link></li>
          </ul>
        </div>
        <div>
          <h3>A loja</h3>
          <ul>
            <li><Link to={path("/sobre")}>Nossa história</Link></li>
            {tenant.whatsapp && <li><a href={whatsappLink(tenant)} target="_blank" rel="noreferrer">WhatsApp {tenant.whatsapp}</a></li>}
            {tenant.show_address && tenant.address && <li>{tenant.address}</li>}
          </ul>
        </div>
        {hours.length > 0 && (
          <div>
            <h3>Horários</h3>
            <ul className="or-hours">
              {hours.map((h) => (<li key={h.day}><span>{h.day}</span><i /><span>{h.text}</span></li>))}
            </ul>
          </div>
        )}
      </div>
      <p className="or-credit">
        © {new Date().getFullYear()} {tenant.name} · Powered by{" "}
        <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a>
      </p>
    </footer>
  );
}
