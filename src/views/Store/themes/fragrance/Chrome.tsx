import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Instagram, Menu, MessageCircle, Search, ShoppingBag, Store, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { hoursLines, useKit, whatsappLink } from "./kit";
import "./styles.css";

export function Header() {
  const { tenant, categories, cart, openCart, path } = useKit();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const links = [
    { label: "Início", to: path() },
    { label: "Coleção", to: path("/catalogo") },
    { label: "Nossa loja", to: path("/sobre") },
  ];
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    navigate(path(term ? `/catalogo?q=${encodeURIComponent(term)}` : "/catalogo"));
    setMenuOpen(false);
  };

  useEffect(() => setMenuOpen(false), [pathname, search]);

  return (
    <header className="fr-header">
      <div className="fr-announcement">
        <div className="fr-wrap">
          <span>{tenant.hero_tagline || "Escolhas para os seus momentos."}</span>
          {tenant.whatsapp && <a href={whatsappLink(tenant.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle size={14} /> Atendimento pelo WhatsApp</a>}
        </div>
      </div>
      <div className="fr-wrap fr-mainbar">
        <button type="button" className="fr-icon-button fr-menu-button" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <Link className="fr-brand" to={path()} aria-label={`${tenant.name} - início`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="fr-brand-mark"><Store size={20} /></span>}
          <span>{tenant.name}</span>
        </Link>
        <form className="fr-search" role="search" onSubmit={submit}>
          <SearchBar value={query} onChange={setQuery} placeholder="Buscar na coleção" />
          <button type="submit" aria-label="Buscar"><Search size={18} /></button>
        </form>
        <button type="button" className="fr-cart" onClick={openCart} aria-label={`Abrir pedido, ${count} ${count === 1 ? "item" : "itens"}`}>
          <ShoppingBag size={19} /><span>Pedido</span><b>{count}</b>
        </button>
      </div>
      <nav className={`fr-nav ${menuOpen ? "is-open" : ""}`} aria-label="Navegação principal">
        <div className="fr-wrap fr-nav-inner">
          {links.map((link) => <Link key={link.label} to={link.to} aria-current={pathname === link.to.split("?")[0] ? "page" : undefined}>{link.label}</Link>)}
          {categories.slice(0, 6).map((category) => <Link key={category.id} to={path(`/catalogo?cat=${category.id}`)}>{category.name}</Link>)}
        </div>
      </nav>
    </header>
  );
}

export function Footer() {
  const { tenant, categories, path } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const whatsapp = whatsappLink(tenant.whatsapp);
  return (
    <footer className="fr-footer">
      <div className="fr-wrap fr-footer-main">
        <div className="fr-footer-about">
          <span className="fr-footer-label">Uma coleção de</span>
          <h2>{tenant.name}</h2>
          <p>{tenant.footer_text || tenant.about_text || "Produtos escolhidos com cuidado, atendimento próximo e um pedido simples."}</p>
          <div className="fr-socials">
            {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>}
            {whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={18} /></a>}
          </div>
        </div>
        <div><h3>Explore</h3><Link to={path()}>Início</Link><Link to={path("/catalogo")}>Toda a coleção</Link><Link to={path("/sobre")}>Nossa loja</Link></div>
        <div><h3>Categorias</h3>{categories.slice(0, 6).map((category) => <Link key={category.id} to={path(`/catalogo?cat=${category.id}`)}>{category.name}</Link>)}</div>
        <div>
          <h3>Atendimento</h3>
          {tenant.show_address && tenant.address && <p>{tenant.address}</p>}
          {whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer">Fale pelo WhatsApp</a>}
          {hours.map((hour) => <p key={hour.day}>{hour.day}: {hour.text}</p>)}
        </div>
      </div>
      <div className="fr-footer-bottom">© {new Date().getFullYear()} {tenant.name} · Powered by <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a></div>
    </footer>
  );
}