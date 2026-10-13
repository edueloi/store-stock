import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Coffee, Facebook, Instagram, Menu, MessageCircle, Search, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { hoursLines, useKit, whatsappLink } from "./kit";
import "./styles.css";

export function Header() {
  const { tenant, openCart, cartCount, path, sf } = useKit();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [find, setFind] = useState(false);
  const [term, setTerm] = useState("");
  const nav = [
    { name: "Início", to: path(), on: !/catalogo|sobre|produto/.test(pathname) },
    { name: "Cardápio", to: path("/catalogo"), on: /catalogo|produto/.test(pathname) },
    { name: "Nossa casa", to: path("/sobre"), on: pathname.includes("/sobre") },
  ];
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setMenu(false);
    setFind(false);
    navigate(path(`/catalogo${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ""}`));
  };
  return (
    <header className="cf-header">
      <div className="cf-strip">
        <span>{sf.segment_label || "Cafés & Empório"}</span>
        <i aria-hidden="true" />
        <Link to={path("/catalogo")}>Ver o cardápio</Link>
      </div>
      <div className="cf-bar">
        <button className="cf-ico cf-menu-btn" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          {menu ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Link className="cf-brand" to={path()}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <Coffee size={24} aria-hidden="true" />}
          <span>{tenant.name}</span>
        </Link>
        <nav className="cf-nav" aria-label="Principal">
          {nav.map((l) => (
            <Link key={l.to} to={l.to} aria-current={l.on ? "page" : undefined}>
              {l.name}
            </Link>
          ))}
        </nav>
        <div className="cf-actions">
          <button className="cf-ico" aria-label="Buscar no cardápio" aria-expanded={find} onClick={() => setFind((v) => !v)}>
            <Search size={20} />
          </button>
          <button className="cf-tab" aria-label={`Abrir comanda, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`} onClick={openCart}>
            <span>Comanda</span>
            <b>{cartCount}</b>
          </button>
        </div>
      </div>
      {find && (
        <form className="cf-find" role="search" onSubmit={submit}>
          <SearchBar value={term} onChange={setTerm} placeholder="O que você procura hoje?" />
          <button type="submit" className="cf-btn">
            Buscar
          </button>
        </form>
      )}
      {menu && (
        <nav className="cf-mobile" aria-label="Menu">
          {nav.map((l) => (
            <Link key={l.to} to={l.to} onClick={() => setMenu(false)} aria-current={l.on ? "page" : undefined}>
              <span>{l.name}</span>
              <i aria-hidden="true" />
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant, categories, path, active, sf } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = whatsappLink(tenant.whatsapp);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 6);
  const now = new Date();
  return (
    <footer className="cf-footer">
      <div className="cf-ticket">
        <p className="cf-ticket-head">
          *** {tenant.name.toUpperCase()} ***
          <small>{sf.segment_label || "Cafés & Empório"}</small>
        </p>
        <p className="cf-ticket-meta">
          <span>Comanda nº {String(now.getFullYear()).slice(2)}{String(now.getMonth() + 1).padStart(2, "0")}{String(now.getDate()).padStart(2, "0")}</span>
          <span>{now.toLocaleDateString("pt-BR")}</span>
        </p>
        <p className="cf-ticket-text">{tenant.footer_text || tenant.about_text || tenant.hero_tagline || "Faça uma pausa. Descubra um sabor."}</p>
        <ul className="cf-ticket-list">
          <li>
            <Link to={path()}>Início</Link>
            <i aria-hidden="true" />
            <span>01</span>
          </li>
          <li>
            <Link to={path("/catalogo")}>Cardápio</Link>
            <i aria-hidden="true" />
            <span>02</span>
          </li>
          <li>
            <Link to={path("/sobre")}>Nossa casa</Link>
            <i aria-hidden="true" />
            <span>03</span>
          </li>
          {cats.map((c, i) => (
            <li key={c.id}>
              <Link to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link>
              <i aria-hidden="true" />
              <span>{String(i + 4).padStart(2, "0")}</span>
            </li>
          ))}
        </ul>
        <div className="cf-ticket-rule" aria-hidden="true" />
        {tenant.show_address && tenant.address && (
          <p className="cf-ticket-line">
            <b>Endereço</b>
            <i aria-hidden="true" />
            <span>{tenant.address}</span>
          </p>
        )}
        {wa && (
          <p className="cf-ticket-line">
            <b>WhatsApp</b>
            <i aria-hidden="true" />
            <a href={wa} target="_blank" rel="noreferrer">
              {tenant.whatsapp}
            </a>
          </p>
        )}
        {tenant.instagram_url && (
          <p className="cf-ticket-line">
            <b>Instagram</b>
            <i aria-hidden="true" />
            <a href={tenant.instagram_url} target="_blank" rel="noreferrer">
              <Instagram size={14} aria-hidden="true" /> Seguir
            </a>
          </p>
        )}
        {tenant.facebook_url && (
          <p className="cf-ticket-line">
            <b>Facebook</b>
            <i aria-hidden="true" />
            <a href={tenant.facebook_url} target="_blank" rel="noreferrer">
              <Facebook size={14} aria-hidden="true" /> Curtir
            </a>
          </p>
        )}
        {hours.length > 0 && (
          <>
            <div className="cf-ticket-rule" aria-hidden="true" />
            {hours.map((h) => (
              <p key={h.day} className="cf-ticket-line">
                <b>{h.day}</b>
                <i aria-hidden="true" />
                <span>{h.text}</span>
              </p>
            ))}
          </>
        )}
        <div className="cf-ticket-rule" aria-hidden="true" />
        <p className="cf-ticket-thanks">OBRIGADO, VOLTE SEMPRE</p>
        <div className="cf-barcode" aria-hidden="true" />
        {wa && (
          <a className="cf-ticket-wa" href={wa} target="_blank" rel="noreferrer">
            <MessageCircle size={16} aria-hidden="true" /> Fazer pedido pelo WhatsApp
          </a>
        )}
      </div>
      <p className="cf-credit">
        © {now.getFullYear()} {tenant.name} · Powered by{" "}
        <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">
          BoxSys
        </a>
      </p>
    </footer>
  );
}
