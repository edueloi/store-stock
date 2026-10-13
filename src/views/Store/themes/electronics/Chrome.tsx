import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Clock, Facebook, Grid2x2, Instagram, MapPin, Menu, MessageCircle, Search, ShoppingCart, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { cartCount, hoursList, useKit, whatsappLink } from "./kit";
import { deptIcon } from "./parts";
import "./styles.css";

export function Header() {
  const { tenant, usedCategories, cart, openCart, path } = useKit();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const count = cartCount(cart);
  const wa = whatsappLink(tenant);

  useEffect(() => { setOpen(false); }, [pathname, search]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate(path(`/catalogo?q=${encodeURIComponent(q)}`));
    setQuery("");
  };

  return (
    <header className="elx-header">
      <div className="elx-ribbon">
        <div className="elx-wrap elx-ribbon-in">
          <span>{tenant.hero_tagline || "Tecnologia com garantia e atendimento especializado"}</span>
          <span className="elx-ribbon-links">
            {wa && <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={14} /> Falar com um especialista</a>}
            <Link to={path("/sobre")}>Sobre a loja</Link>
          </span>
        </div>
      </div>
      <div className="elx-wrap elx-top">
        <button type="button" className="elx-icon-btn elx-burger" aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
        <Link to={path()} className="elx-logo" aria-label={`${tenant.name} — página inicial`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="elx-logo-mark" aria-hidden="true">{tenant.name.slice(0, 1)}</span>}
          <span>{tenant.name}</span>
        </Link>
        <form className="elx-search" role="search" onSubmit={submit}>
          <SearchBar value={query} onChange={setQuery} placeholder="Busque por produto, marca ou código" />
          <button type="submit" className="elx-search-go"><Search size={19} /> <span>Buscar</span></button>
        </form>
        <button type="button" className="elx-cart" aria-label={`Abrir carrinho, ${count} ${count === 1 ? "item" : "itens"}`} onClick={openCart}>
          <ShoppingCart size={22} />
          <span className="elx-cart-text">Carrinho</span>
          <b>{count}</b>
        </button>
      </div>
      <nav className="elx-depts" aria-label="Departamentos">
        <div className="elx-wrap elx-depts-in">
          <button type="button" className="elx-all" aria-expanded={open} aria-controls="elx-mega" onClick={() => setOpen((v) => !v)}>
            <Grid2x2 size={18} /> Todos os departamentos
          </button>
          {usedCategories.slice(0, 8).map((c) => {
            const Icon = deptIcon(c.name);
            return <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}><Icon size={16} /> {c.name}</Link>;
          })}
          <Link to={path("/catalogo")} className="elx-depts-all">Ver tudo</Link>
        </div>
      </nav>
      {open && (
        <div className="elx-mega" id="elx-mega">
          <div className="elx-wrap">
            <div className="elx-mega-links">
              <Link to={path()}>Início</Link>
              <Link to={path("/catalogo")}>Catálogo completo</Link>
              <Link to={path("/sobre")}>Sobre a loja</Link>
            </div>
            <p className="elx-mega-title">Departamentos</p>
            <ul className="elx-mega-grid">
              {usedCategories.map((c) => {
                const Icon = deptIcon(c.name);
                return <li key={c.id}><Link to={path(`/catalogo?cat=${c.id}`)}><Icon size={20} /> {c.name}</Link></li>;
              })}
              {usedCategories.length === 0 && <li className="elx-mega-empty">Nenhum departamento cadastrado.</li>}
            </ul>
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant, categories, path } = useKit();
  const wa = whatsappLink(tenant);
  const hours = hoursList(tenant);
  return (
    <footer className="elx-footer">
      <div className="elx-foot-cta">
        <div className="elx-wrap elx-foot-cta-in">
          <div>
            <strong>Precisa de ajuda para escolher?</strong>
            <span>Nosso atendimento ajuda você a comparar e decidir.</span>
          </div>
          {wa ? <a className="elx-btn elx-btn-inline" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Chamar no WhatsApp</a> : <Link className="elx-btn elx-btn-inline" to={path("/sobre")}>Falar com a loja</Link>}
        </div>
      </div>
      <div className="elx-wrap elx-foot-grid">
        <div>
          <strong className="elx-foot-name">{tenant.name}</strong>
          <p>{tenant.footer_text || tenant.about_text || "Tecnologia selecionada, preço justo e suporte de verdade."}</p>
          <div className="elx-social">
            {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>}
            {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={18} /></a>}
          </div>
        </div>
        <div>
          <h3>Departamentos</h3>
          {categories.slice(0, 6).map((c) => <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link>)}
          <Link to={path("/catalogo")}>Todos os produtos</Link>
        </div>
        <div>
          <h3>Institucional</h3>
          <Link to={path()}>Início</Link>
          <Link to={path("/sobre")}>Sobre a loja</Link>
          <Link to={path("/sobre")}>Garantia, entrega e trocas</Link>
        </div>
        <div>
          <h3>Contato</h3>
          {wa && <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={14} /> {tenant.whatsapp}</a>}
          {tenant.show_address && tenant.address && <p><MapPin size={14} /> {tenant.address}</p>}
          {hours.length > 0 && (
            <ul className="elx-hours" aria-label="Horários de atendimento">
              {hours.map((h) => <li key={h.day}><Clock size={12} /><span>{h.day}</span>{h.text}</li>)}
            </ul>
          )}
        </div>
      </div>
      <div className="elx-foot-bottom">
        <div className="elx-wrap">
          <span>© {new Date().getFullYear()} {tenant.name}</span>
          <span>Loja criada com BoxSys</span>
        </div>
      </div>
    </footer>
  );
}
