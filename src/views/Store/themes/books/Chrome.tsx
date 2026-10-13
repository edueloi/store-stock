import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { BookOpen, Facebook, Instagram, Menu, MessageCircle, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { hoursLines, useKit, whatsappLink } from "./kit";
import { Ornament, Spine } from "./parts";
import "./styles.css";

export function Header() {
  const { tenant, categories, openCart, cartCount, path, active, sf } = useKit();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [term, setTerm] = useState("");
  const onCatalog = pathname.includes("/catalogo");
  const activeCat = Number(params.get("cat") || params.get("categoria") || 0) || null;
  const nav = [
    { name: "Início", to: path(), on: !/catalogo|sobre|produto/.test(pathname) },
    { name: "Catálogo", to: path("/catalogo"), on: /catalogo|produto/.test(pathname) },
    { name: "Nossa loja", to: path("/sobre"), on: pathname.includes("/sobre") },
  ];
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setMenu(false);
    navigate(path(`/catalogo${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ""}`));
  };
  return (
    <header className="bk-header">
      <div className="bk-topbar">
        <div className="bk-topbar-in">
          <button className="bk-icon bk-menu-btn" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
            {menu ? <X size={22} /> : <Menu size={22} />}
          </button>
          <Link className="bk-brand" to={path()}>
            {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <BookOpen size={26} aria-hidden="true" />}
            <span>
              <b>{tenant.name}</b>
              <small>{sf.segment_label || "Livraria & Cultura"}</small>
            </span>
          </Link>
          <nav className="bk-nav" aria-label="Principal">
            {nav.map((l) => (
              <Link key={l.to} to={l.to} aria-current={l.on ? "page" : undefined}>
                {l.name}
              </Link>
            ))}
          </nav>
          <form className="bk-search" role="search" onSubmit={submit}>
            <SearchBar value={term} onChange={setTerm} placeholder="Título, autor ou código" />
          </form>
          <button className="bk-pile" aria-label={`Abrir pilha de leituras, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`} onClick={openCart}>
            <span className="bk-pile-books" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="bk-pile-count">{cartCount}</span>
          </button>
        </div>
      </div>
      {menu && (
        <div className="bk-drawer">
          <form role="search" onSubmit={submit} className="bk-search bk-search-m">
            <SearchBar value={term} onChange={setTerm} placeholder="Título, autor ou código" />
          </form>
          <nav aria-label="Menu">
            {nav.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setMenu(false)} aria-current={l.on ? "page" : undefined}>
                {l.name}
              </Link>
            ))}
          </nav>
        </div>
      )}
      {cats.length > 0 && (
        <nav className="bk-shelf" aria-label="Seções da livraria">
          <div className="bk-shelf-row">
            <span className="bk-shelf-label">Seções</span>
            <Spine to={path("/catalogo")} name="Todos" index={6} active={onCatalog && !activeCat} />
            {cats.slice(0, 14).map((c, i) => (
              <Spine key={c.id} to={path(`/catalogo?cat=${c.id}`)} name={c.name} index={i} count={active.filter((p) => p.category_id === c.id).length} active={onCatalog && activeCat === c.id} />
            ))}
          </div>
          <div className="bk-plank" aria-hidden="true" />
        </nav>
      )}
      <Ornament className="bk-header-orn" />
    </header>
  );
}

export function Footer() {
  const { tenant, categories, path, active } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = whatsappLink(tenant.whatsapp);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 6);
  return (
    <footer className="bk-footer">
      <div className="bk-footer-in">
        <div className="bk-colophon">
          <Ornament className="bk-orn" />
          <h2>{tenant.name}</h2>
          <p>{tenant.footer_text || tenant.about_text || tenant.hero_tagline || "Histórias para levar com você."}</p>
          <div className="bk-socials">
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" aria-label="Conversar pelo WhatsApp">
                <MessageCircle size={20} />
              </a>
            )}
            {tenant.instagram_url && (
              <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram">
                <Instagram size={20} />
              </a>
            )}
            {tenant.facebook_url && (
              <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook">
                <Facebook size={20} />
              </a>
            )}
          </div>
        </div>
        <nav className="bk-index" aria-label="Índice">
          <h3>Índice</h3>
          <ol>
            <li>
              <Link to={path()}>Início</Link>
            </li>
            <li>
              <Link to={path("/catalogo")}>Catálogo</Link>
            </li>
            <li>
              <Link to={path("/sobre")}>Nossa loja</Link>
            </li>
            {cats.map((c) => (
              <li key={c.id}>
                <Link to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link>
              </li>
            ))}
          </ol>
        </nav>
        <div className="bk-visit">
          <h3>Visite a livraria</h3>
          {tenant.show_address && tenant.address && <p>{tenant.address}</p>}
          {wa && (
            <p>
              <a href={wa} target="_blank" rel="noreferrer">
                WhatsApp {tenant.whatsapp}
              </a>
            </p>
          )}
          {hours.length > 0 && (
            <dl>
              {hours.map((h) => (
                <div key={h.day}>
                  <dt>{h.day}</dt>
                  <dd>{h.text}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
      <p className="bk-credit">
        © {new Date().getFullYear()} {tenant.name} · Powered by{" "}
        <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">
          BoxSys
        </a>
      </p>
    </footer>
  );
}
