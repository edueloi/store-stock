import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, ShoppingBag, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { hoursLines, useShop, whatsappHref } from "./kit";
import "./styles.css";

function HeaderSearch({ className }: { className: string }) {
  const { path } = useShop();
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(path("/catalogo", { q: value.trim() }));
  };
  return (
    <form className={className} role="search" onSubmit={submit}>
      <SearchBar value={value} onChange={setValue} placeholder="Buscar uma peça" />
    </form>
  );
}

export function Header() {
  const { tenant, categories, openCart, cartCount, path, config } = useShop();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const links = [
    { name: "Início", to: path() },
    { name: "A coleção", to: path("/catalogo") },
    ...categories.slice(0, 4).map((c) => ({ name: c.name, to: path("/catalogo", { categoria: String(c.id) }) })),
    { name: "Nossa casa", to: path("/sobre") },
  ];
  const here = (to: string) => !to.includes("?") && pathname === to;
  return (
    <header className="lx-scope">
      <div className="lx-notice">{config.segment_label || "Joias & Seleções Especiais"}</div>
      <div className="lx-head">
        <div className="lx-wrap lx-head-main">
          <div className="lx-head-side">
            <button type="button" className="lx-ibtn lx-menu-btn" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
              {menu ? <X size={22} strokeWidth={1.3} /> : <Menu size={22} strokeWidth={1.3} />}
            </button>
            <HeaderSearch className="lx-head-search" />
          </div>
          <Link className="lx-brand" to={path()} aria-label={`${tenant.name} - início`}>
            {tenant.logo_url ? <img src={tenant.logo_url} alt={tenant.name} /> : <b>{tenant.name}</b>}
          </Link>
          <div className="lx-head-side end">
            <button type="button" className="lx-ibtn" aria-label={`Abrir sacola, ${cartCount} itens`} onClick={openCart}>
              <ShoppingBag size={22} strokeWidth={1.3} />
              <sup>{cartCount}</sup>
            </button>
          </div>
        </div>
        <nav className="lx-wrap lx-nav" aria-label="Principal">
          {links.map((l) => (
            <Link key={l.name + l.to} to={l.to} aria-current={here(l.to) ? "page" : undefined}>{l.name}</Link>
          ))}
        </nav>
        {menu && (
          <div className="lx-drawer">
            <HeaderSearch className="lx-drawer-search" />
            {links.map((l) => (
              <Link key={l.name + l.to} to={l.to} onClick={() => setMenu(false)}>{l.name}</Link>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

export function Footer() {
  const { tenant, categories, path } = useShop();
  const hours = hoursLines(tenant);
  return (
    <footer className="lx-scope lx-foot">
      <div className="lx-wrap lx-foot-top">
        <div className="lx-rule"><span /></div>
        <div className="lx-foot-brand">{tenant.name}</div>
        <p>{tenant.footer_text || tenant.about_text || "Uma seleção para marcar seus momentos."}</p>
      </div>
      <div className="lx-wrap lx-foot-cols">
        <div>
          <h3>A casa</h3>
          <ul>
            <li><Link to={path("/catalogo")}>A coleção</Link></li>
            <li><Link to={path("/sobre")}>Nossa história</Link></li>
            {categories.slice(0, 3).map((c) => <li key={c.id}><Link to={path("/catalogo", { categoria: String(c.id) })}>{c.name}</Link></li>)}
          </ul>
        </div>
        <div>
          <h3>Atendimento</h3>
          <ul>
            {tenant.show_address && tenant.address && <li><p>{tenant.address}</p></li>}
            {tenant.whatsapp && <li><a href={whatsappHref(tenant)} target="_blank" rel="noreferrer">WhatsApp</a></li>}
            {tenant.instagram_url && <li><a href={tenant.instagram_url} target="_blank" rel="noreferrer">Instagram</a></li>}
            {tenant.facebook_url && <li><a href={tenant.facebook_url} target="_blank" rel="noreferrer">Facebook</a></li>}
          </ul>
        </div>
        <div>
          <h3>Horários</h3>
          {hours.length ? <ul>{hours.map((h) => <li key={h.day}>{h.day}: {h.text}</li>)}</ul> : <p>Consulte nosso atendimento.</p>}
        </div>
      </div>
      <div className="lx-foot-end">
        <div className="lx-wrap">© {new Date().getFullYear()} {tenant.name} · Powered by{" "}
          <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a></div>
      </div>
    </footer>
  );
}
