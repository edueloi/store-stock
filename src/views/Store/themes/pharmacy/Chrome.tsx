import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Clock, Facebook, Instagram, MapPin, Menu, MessageCircle, ShoppingBag, Store, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { hoursRows, useShop, whatsappLink } from "./core";
import { Cross, T } from "./parts";
import "./styles.css";

export function Header() {
  const { tenant, categories, count, openCart, path, config } = useShop();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setMenu(false);
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
      <div className="ph-util">
        <div className="ph-wrap ph-util-in">
          <span><Store size={14} aria-hidden="true" /> {config.segment_label || T.tag}: retirada na loja</span>
          {tenant.whatsapp && (
            <a href={whatsappLink(tenant)} target="_blank" rel="noreferrer">
              <MessageCircle size={14} aria-hidden="true" /> Atendimento pelo WhatsApp
            </a>
          )}
          {tenant.show_address && tenant.address && (
            <span className="ph-util-addr"><MapPin size={14} aria-hidden="true" /> {tenant.address}</span>
          )}
        </div>
      </div>
      <div className="ph-wrap ph-main">
        <Link className="ph-brand" to={path()} aria-label={`${tenant.name} - início`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="ph-brand-mark"><Cross size={20} /></span>}
          <span>{tenant.name}</span>
        </Link>
        <form className="ph-search" onSubmit={submit} role="search">
          <SearchBar value={q} onChange={setQ} placeholder="Busque por nome ou código do produto" />
          <button type="submit" className="ph-btn">Buscar</button>
        </form>
        <button type="button" className="ph-cart" onClick={openCart} aria-label={`Abrir carrinho, ${count} itens`}>
          <ShoppingBag size={22} aria-hidden="true" />
          <span className="ph-cart-label">Pedido</span>
          <b>{count}</b>
        </button>
        <button type="button" className="ph-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          {menu ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      <nav className={`ph-nav ${menu ? "is-open" : ""}`} aria-label="Principal">
        <div className="ph-wrap ph-nav-in">
          <div className="ph-nav-main">
            {links.map((l) => (
              <Link key={l.name} to={l.to} aria-current={current(l.match)} onClick={() => setMenu(false)}>{l.name}</Link>
            ))}
          </div>
          {categories.length > 0 && (
            <div className="ph-nav-cats">
              {categories.slice(0, 8).map((c) => (
                <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} onClick={() => setMenu(false)}>{c.name}</Link>
              ))}
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}

export function Footer() {
  const { tenant, categories, path } = useShop();
  const hours = hoursRows(tenant);
  return (
    <footer className="ph ph-footer">
      <div className="ph-wrap ph-trust">
        <div><Cross size={22} /><span><b>Retirada na loja</b> Reserve online e retire com praticidade.</span></div>
        <div><MessageCircle size={22} aria-hidden="true" /><span><b>Atendimento próximo</b> Tire dúvidas antes de decidir.</span></div>
        <div><Clock size={22} aria-hidden="true" /><span><b>Informação clara</b> Preços e disponibilidade à vista.</span></div>
      </div>
      <div className="ph-wrap ph-foot-grid">
        <div>
          <p className="ph-foot-brand">{tenant.name}</p>
          <p>{tenant.footer_text || tenant.about_text || T.sub}</p>
          <div className="ph-social">
            {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={20} /></a>}
            {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={20} /></a>}
            {tenant.whatsapp && <a href={whatsappLink(tenant)} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={20} /></a>}
          </div>
        </div>
        <div>
          <h3>Departamentos</h3>
          <ul>
            {categories.slice(0, 6).map((c) => (
              <li key={c.id}><Link to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link></li>
            ))}
            <li><Link to={path("/catalogo")}>Todo o catálogo</Link></li>
          </ul>
        </div>
        <div>
          <h3>Atendimento</h3>
          <ul>
            <li><Link to={path("/sobre")}>Nossa loja</Link></li>
            {tenant.whatsapp && <li><a href={whatsappLink(tenant)} target="_blank" rel="noreferrer">WhatsApp {tenant.whatsapp}</a></li>}
            {tenant.show_address && tenant.address && <li>{tenant.address}</li>}
          </ul>
        </div>
        {hours.length > 0 && (
          <div>
            <h3>Horários</h3>
            <ul className="ph-hours">
              {hours.map((h) => (
                <li key={h.day}><span>{h.day}</span><span>{h.text}</span></li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <p className="ph-credit">
        © {new Date().getFullYear()} {tenant.name} · Powered by{" "}
        <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a>
      </p>
    </footer>
  );
}
