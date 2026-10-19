import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Facebook, Instagram, Menu, MessageCircle, Search, ShoppingBasket, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { StoreButton } from "../../../../components/store/StoreButton";
import { hoursRows, useShop, whatsappLink } from "./core";
import { Leaf, T, Wave } from "./parts";
import "./styles.css";

export function Header() {
  const { tenant, categories, count, openCart, path } = useShop();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);
  const [colls, setColls] = useState(false);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    setDrawer(false);
    setColls(false);
  }, [pathname, search]);

  const here = (m: string) => (pathname.replace(/\/$/, "") === m.split("?")[0].replace(/\/$/, "") ? ("page" as const) : undefined);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(false);
    setDrawer(false);
    navigate(path(q.trim() ? `/catalogo?q=${encodeURIComponent(q.trim())}` : "/catalogo"));
  };

  return (
    <header className="or or-header">
      <div className="or-bar">
        <Link className="or-brand" to={path()} aria-label={`${tenant.name} - início`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="or-brand-mark"><Leaf size={22} /></span>}
          <span className="or-brand-name">{tenant.name}</span>
        </Link>

        <nav className="or-pill" aria-label="Principal">
          <Link to={path()} aria-current={here(path())}>Início</Link>
          <Link to={path("/catalogo")} aria-current={here(path("/catalogo"))}>Catálogo</Link>
          {categories.length > 0 && (
            <div className="or-drop">
              <button type="button" aria-expanded={colls} onClick={() => setColls((v) => !v)}>
                Coleções <ChevronDown size={15} aria-hidden="true" />
              </button>
              {colls && (
                <div className="or-drop-panel">
                  {categories.slice(0, 8).map((c) => (
                    <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link>
                  ))}
                </div>
              )}
            </div>
          )}
          <Link to={path("/sobre")} aria-current={here(path("/sobre"))}>Nossa loja</Link>
        </nav>

        <div className="or-actions">
          <button type="button" className="or-iconbtn" aria-label="Buscar produtos" aria-expanded={searching} onClick={() => setSearching((v) => !v)}>
            <Search size={20} />
          </button>
          <button type="button" className="or-iconbtn or-basket" aria-label={`Abrir carrinho, ${count} itens`} onClick={openCart}>
            <ShoppingBasket size={21} />
            <b>{count}</b>
          </button>
          <button type="button" className="or-iconbtn or-burger" aria-label="Abrir menu" aria-expanded={drawer} onClick={() => setDrawer(true)}>
            <Menu size={22} />
          </button>
        </div>
      </div>

      {searching && (
        <form className="or-searchrow" role="search" onSubmit={submit}>
          <SearchBar value={q} onChange={setQ} placeholder="Procure por um produto" />
          <StoreButton type="submit" className="or-cta">Buscar</StoreButton>
        </form>
      )}

      {drawer && (
        <div className="or-drawer-wrap">
          <button type="button" className="or-scrim" aria-label="Fechar menu" onClick={() => setDrawer(false)} />
          <nav className="or-drawer" aria-label="Menu">
            <div className="or-drawer-head">
              <b>{tenant.name}</b>
              <button type="button" className="or-iconbtn" aria-label="Fechar menu" onClick={() => setDrawer(false)}><X size={22} /></button>
            </div>
            <Link to={path()} aria-current={here(path())}>Início</Link>
            <Link to={path("/catalogo")} aria-current={here(path("/catalogo"))}>Catálogo</Link>
            <Link to={path("/sobre")} aria-current={here(path("/sobre"))}>Nossa loja</Link>
            {categories.length > 0 && <p className="or-drawer-title">Coleções</p>}
            {categories.slice(0, 10).map((c) => (
              <Link key={c.id} className="or-drawer-cat" to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant, categories, path } = useShop();
  const hours = hoursRows(tenant);
  return (
    <footer className="or or-footer">
      <Wave fill="var(--or-sage)" />
      <div className="or-foot">
        <div className="or-foot-grid">
          <section className="or-fcard or-fcard-brand">
            <p className="or-foot-name">{tenant.name}</p>
            <p>{tenant.footer_text || tenant.hero_tagline || T.hero}</p>
            <div className="or-social">
              {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={20} /></a>}
              {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={20} /></a>}
              {tenant.whatsapp && <a href={whatsappLink(tenant)} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={20} /></a>}
            </div>
          </section>
          <section className="or-fcard">
            <h3>Coleções</h3>
            <ul>
              {categories.slice(0, 5).map((c) => (<li key={c.id}><Link to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link></li>))}
              <li><Link to={path("/catalogo")}>Ver tudo</Link></li>
            </ul>
          </section>
          <section className="or-fcard">
            <h3>A loja</h3>
            <ul>
              <li><Link to={path("/sobre")}>Nossa história</Link></li>
              {tenant.whatsapp && <li><a href={whatsappLink(tenant)} target="_blank" rel="noreferrer">WhatsApp {tenant.whatsapp}</a></li>}
              {tenant.show_address && tenant.address && <li>{tenant.address}</li>}
            </ul>
          </section>
          {hours.length > 0 && (
            <section className="or-fcard">
              <h3>Horários</h3>
              <ul className="or-hours">
                {hours.map((h) => (<li key={h.day}><span>{h.day}</span><i /><span>{h.text}</span></li>))}
              </ul>
            </section>
          )}
        </div>
        <p className="or-credit">
          © {new Date().getFullYear()} {tenant.name} · Powered by{" "}
          <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a>
        </p>
      </div>
    </footer>
  );
}
