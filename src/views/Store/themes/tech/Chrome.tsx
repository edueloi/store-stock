import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Cpu, Menu, ShoppingCart, X } from "lucide-react";
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
      <SearchBar value={value} onChange={setValue} placeholder="Buscar dispositivos, acessórios e códigos" />
    </form>
  );
}

export function Header() {
  const { tenant, categories, openCart, cartCount, path, config } = useShop();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const links = [
    { name: "Início", to: path() },
    { name: "Catálogo", to: path("/catalogo") },
    { name: "Sobre a loja", to: path("/sobre") },
  ];
  const here = (to: string) => pathname === to;
  return (
    <header className="tp-scope">
      <div className="tp-util">
        <div className="tp-wrap">
          <span>{config.segment_label || "Eletrônicos & Conectividade"}</span>
          {tenant.whatsapp && <a className="hide-sm" href={whatsappHref(tenant)} target="_blank" rel="noreferrer">Suporte pelo WhatsApp</a>}
        </div>
      </div>
      <div className="tp-head">
        <div className="tp-wrap tp-head-main">
          <Link className="tp-brand" to={path()} aria-label={`${tenant.name} - início`}>
            {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="mark" aria-hidden="true"><Cpu size={17} /></span>}
            <span className="nm">{tenant.name}</span>
          </Link>
          <HeaderSearch className="tp-head-search" />
          <div className="tp-head-actions">
            <button type="button" className="tp-pill-btn cart-label" aria-label={`Abrir carrinho, ${cartCount} itens`} onClick={openCart}>
              <ShoppingCart size={18} /><span className="lbl">Carrinho</span><span className="n">{cartCount}</span>
            </button>
            <button type="button" className="tp-pill-btn tp-menu-btn" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
              {menu ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        <nav className="tp-tabs" aria-label="Principal">
          <div className="tp-wrap">
            {links.map((l) => <Link key={l.name} to={l.to} aria-current={here(l.to) ? "page" : undefined}>{l.name}</Link>)}
            {categories.length > 0 && <i aria-hidden="true" />}
            {categories.slice(0, 8).map((c) => <Link key={c.id} className="cat" to={path("/catalogo", { categoria: String(c.id) })}>{c.name}</Link>)}
          </div>
        </nav>
        {menu && (
          <div className="tp-drawer">
            <HeaderSearch className="tp-drawer-search" />
            {links.map((l) => <Link key={l.name} to={l.to} onClick={() => setMenu(false)}>{l.name}</Link>)}
            {categories.slice(0, 8).map((c) => <Link key={c.id} to={path("/catalogo", { categoria: String(c.id) })} onClick={() => setMenu(false)}>{c.name}</Link>)}
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
    <footer className="tp-scope tp-foot">
      <div className="tp-wrap tp-foot-grid">
        <div>
          <p className="brand">{tenant.name}</p>
          <p>{tenant.footer_text || tenant.about_text || "Tecnologia que acompanha você."}</p>
        </div>
        <div>
          <h3>Navegação</h3>
          <ul>
            <li><Link to={path()}>Início</Link></li>
            <li><Link to={path("/catalogo")}>Catálogo</Link></li>
            <li><Link to={path("/sobre")}>Sobre a loja</Link></li>
            {categories.slice(0, 3).map((c) => <li key={c.id}><Link to={path("/catalogo", { categoria: String(c.id) })}>{c.name}</Link></li>)}
          </ul>
        </div>
        <div>
          <h3>Contato</h3>
          <ul>
            {tenant.show_address && tenant.address && <li><p>{tenant.address}</p></li>}
            {tenant.whatsapp && <li><a href={whatsappHref(tenant)} target="_blank" rel="noreferrer">WhatsApp</a></li>}
            {tenant.instagram_url && <li><a href={tenant.instagram_url} target="_blank" rel="noreferrer">Instagram</a></li>}
            {tenant.facebook_url && <li><a href={tenant.facebook_url} target="_blank" rel="noreferrer">Facebook</a></li>}
          </ul>
        </div>
        <div>
          <h3>Horários</h3>
          {hours.length ? <ul>{hours.map((h) => <li key={h.day}>{h.day}: {h.text}</li>)}</ul> : <p>Consulte o atendimento.</p>}
        </div>
      </div>
      <div className="tp-foot-end">
        <div className="tp-wrap">© {new Date().getFullYear()} {tenant.name} · Powered by{" "}
          <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a></div>
      </div>
    </footer>
  );
}
