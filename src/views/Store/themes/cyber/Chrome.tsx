import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, ShoppingCart, X } from "lucide-react";
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
      <SearchBar value={value} onChange={setValue} placeholder="> buscar_produto" />
    </form>
  );
}

export function Header() {
  const { tenant, categories, openCart, cartCount, path, config } = useShop();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const links = [
    { name: "inicio", to: path() },
    { name: "catalogo", to: path("/catalogo") },
    { name: "sobre", to: path("/sobre") },
  ];
  const here = (to: string) => pathname === to.split("?")[0];
  return (
    <header className="cy-scope">
      <div className="cy-top">
        <div className="cy-wrap">
          <span><i aria-hidden="true" />sistema online</span>
          <span><b>{config.segment_label || "Games & Cultura Digital"}</b></span>
        </div>
      </div>
      <div className="cy-bar">
        <div className="cy-wrap cy-bar-row">
          <Link className="cy-prompt" to={path()} aria-label={`${tenant.name} - início`}>
            {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="gt" aria-hidden="true">&gt;</span>}
            <span className="nm">{tenant.name}</span>
            <span className="caret" aria-hidden="true" />
          </Link>
          <nav className="cy-nav" aria-label="Principal">
            {links.map((l) => (
              <Link key={l.name} to={l.to} aria-current={here(l.to) ? "page" : undefined}>{l.name}</Link>
            ))}
          </nav>
          <HeaderSearch className="cy-search" />
          <div className="cy-bar-end">
            <button type="button" className="cy-icon-btn" aria-label={`Abrir carrinho, ${cartCount} itens`} onClick={openCart}>
              <ShoppingCart size={18} />
              <span className="cy-cart-count">[{cartCount}]</span>
            </button>
            <button type="button" className="cy-icon-btn cy-menu-btn" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
              {menu ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        {categories.length > 0 && (
          <nav className="cy-cats" aria-label="Categorias">
            <div className="cy-wrap">
              {categories.slice(0, 10).map((c) => (
                <Link key={c.id} to={path("/catalogo", { categoria: String(c.id) })}>{c.name}</Link>
              ))}
            </div>
          </nav>
        )}
        {menu && (
          <div className="cy-drawer">
            <HeaderSearch className="cy-drawer-search" />
            {links.map((l) => (
              <Link key={l.name} to={l.to} onClick={() => setMenu(false)}>{l.name}</Link>
            ))}
            {categories.slice(0, 8).map((c) => (
              <Link key={c.id} to={path("/catalogo", { categoria: String(c.id) })} onClick={() => setMenu(false)}>{c.name}</Link>
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
    <footer className="cy-scope cy-foot">
      <div className="cy-wrap cy-foot-grid">
        <div>
          <p className="brand">{tenant.name}</p>
          <p>{tenant.footer_text || tenant.about_text || "Setup, acessórios e novidades para o seu espaço."}</p>
        </div>
        <div>
          <h3>modulos</h3>
          <ul>
            <li><Link to={path()}>Início</Link></li>
            <li><Link to={path("/catalogo")}>Catálogo</Link></li>
            <li><Link to={path("/sobre")}>Sobre a loja</Link></li>
            {categories.slice(0, 4).map((c) => (
              <li key={c.id}><Link to={path("/catalogo", { categoria: String(c.id) })}>{c.name}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h3>contato</h3>
          <ul>
            {tenant.show_address && tenant.address && <li><p>{tenant.address}</p></li>}
            {tenant.whatsapp && <li><a href={whatsappHref(tenant)} target="_blank" rel="noreferrer">WhatsApp</a></li>}
            {tenant.instagram_url && <li><a href={tenant.instagram_url} target="_blank" rel="noreferrer">Instagram</a></li>}
            {tenant.facebook_url && <li><a href={tenant.facebook_url} target="_blank" rel="noreferrer">Facebook</a></li>}
          </ul>
        </div>
        <div>
          <h3>horarios</h3>
          {hours.length ? (
            <table className="cy-hours"><tbody>
              {hours.map((h) => <tr key={h.day}><td>{h.day.slice(0, 3)}</td><td>{h.text}</td></tr>)}
            </tbody></table>
          ) : <p>Consulte o atendimento.</p>}
        </div>
      </div>
      <div className="cy-foot-end">
        <div className="cy-wrap">© {new Date().getFullYear()} {tenant.name} · Powered by{" "}
          <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a></div>
      </div>
    </footer>
  );
}
