import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Clock, Facebook, Hammer, Instagram, MapPin, Menu, MessageCircle, ShoppingCart, Truck, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { hoursRows, useKit } from "./kit";
import "./styles.css";

export function Header() {
  const { tenant, categories, cartCount, openCart, path, waLink } = useKit();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [mega, setMega] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setMenu(false);
    setMega(false);
  }, [pathname]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(path(q ? `/catalogo?q=${encodeURIComponent(q)}` : "/catalogo"));
    setMenu(false);
  };
  const is = (to: string) => pathname === to.split("?")[0];
  const links = [
    { name: "Início", to: path() },
    { name: "Catálogo", to: path("/catalogo") },
    { name: "Sobre a loja", to: path("/sobre") },
  ];

  return (
    <header className="hm-header">
      <div className="hm-strip">
        <div className="hm-wrap hm-strip-in">
          <span><Truck size={14} aria-hidden="true" /> Retirada na loja e entrega sob consulta</span>
          {tenant.whatsapp && (
            <a href={waLink()} target="_blank" rel="noreferrer"><MessageCircle size={14} aria-hidden="true" /> Falar com a loja</a>
          )}
        </div>
      </div>
      <div className="hm-wrap hm-main">
        <button className="hm-iconbtn hm-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          {menu ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Link className="hm-brand" to={path()}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="hm-brand-mark"><Hammer size={20} aria-hidden="true" /></span>}
          <span className="hm-brand-name">{tenant.name}</span>
        </Link>
        <form className="hm-search" onSubmit={submit} role="search">
          <SearchBar value={query} onChange={setQuery} placeholder="Busque produto, medida ou código" />
          <button type="submit" className="hm-btn hm-btn-accent">Buscar</button>
        </form>
        <button className="hm-cart" onClick={openCart} aria-label={`Abrir carrinho, ${cartCount} itens`}>
          <ShoppingCart size={22} aria-hidden="true" />
          <span className="hm-cart-count">{cartCount}</span>
          <span className="hm-cart-label">Carrinho</span>
        </button>
      </div>
      <nav className="hm-depts" aria-label="Principal">
        <div className="hm-wrap hm-depts-in">
          <button className="hm-dept-btn" aria-expanded={mega} onClick={() => setMega((v) => !v)}>
            <Menu size={16} aria-hidden="true" /> Departamentos <ChevronDown size={14} aria-hidden="true" />
          </button>
          {links.map((l) => (
            <Link key={l.name} to={l.to} aria-current={is(l.to) ? "page" : undefined}>{l.name}</Link>
          ))}
          <span className="hm-depts-sep" aria-hidden="true" />
          {categories.slice(0, 6).map((c) => (
            <Link key={c.id} className="hm-dept-cat" to={path(`/catalogo?categoria=${c.id}`)}>{c.name}</Link>
          ))}
        </div>
        {mega && (
          <div className="hm-mega">
            <div className="hm-wrap">
              <p className="hm-mega-title">Compre por cômodo e departamento</p>
              <div className="hm-mega-grid">
                {categories.map((c) => (
                  <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>{c.name}</Link>
                ))}
                {!categories.length && <Link to={path("/catalogo")}>Ver todos os produtos</Link>}
              </div>
            </div>
          </div>
        )}
      </nav>
      {menu && (
        <div className="hm-drawer" role="dialog" aria-label="Menu">
          <form className="hm-search hm-search-m" onSubmit={submit} role="search">
            <SearchBar value={query} onChange={setQuery} placeholder="Produto, medida ou código" />
            <button type="submit" className="hm-btn hm-btn-accent">Ir</button>
          </form>
          {links.map((l) => (
            <Link key={l.name} to={l.to}>{l.name}</Link>
          ))}
          <p className="hm-drawer-title">Departamentos</p>
          {categories.map((c) => (
            <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>{c.name}</Link>
          ))}
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant, categories, path, waLink } = useKit();
  const hours = hoursRows(tenant);
  return (
    <footer className="hm-footer">
      <div className="hm-wrap hm-footer-grid">
        <div>
          <p className="hm-footer-brand">{tenant.name}</p>
          <p className="hm-footer-text">{tenant.footer_text || tenant.about_text || "Tudo para a sua casa, da obra ao acabamento."}</p>
          <div className="hm-social">
            {tenant.whatsapp && <a href={waLink()} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={18} /></a>}
            {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>}
            {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={18} /></a>}
          </div>
        </div>
        <div>
          <h3>Departamentos</h3>
          {categories.slice(0, 7).map((c) => (
            <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>{c.name}</Link>
          ))}
          {!categories.length && <Link to={path("/catalogo")}>Catálogo completo</Link>}
        </div>
        <div>
          <h3>A loja</h3>
          <Link to={path()}>Início</Link>
          <Link to={path("/catalogo")}>Catálogo</Link>
          <Link to={path("/sobre")}>Sobre a loja</Link>
          {tenant.show_address && tenant.address && <p className="hm-line"><MapPin size={14} aria-hidden="true" /> {tenant.address}</p>}
        </div>
        <div>
          <h3>Horários</h3>
          {hours.length ? hours.map((h) => (
            <p key={h.day} className="hm-hours"><Clock size={13} aria-hidden="true" /> <span>{h.day}</span> <b>{h.text}</b></p>
          )) : <p className="hm-footer-text">Fale com a loja para confirmar o horário.</p>}
        </div>
      </div>
      <div className="hm-footer-bottom">
        <div className="hm-wrap">
          <span>© {new Date().getFullYear()} {tenant.name}</span>
          <span>Feito com BoxSys</span>
        </div>
      </div>
    </footer>
  );
}
