import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Instagram, Menu, MessageCircle, Search, ShoppingBag, Store, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import "./styles.css";

export function Header() {
  const { slug: routeSlug } = useParams();
  const { tenant, categories, cart, openCart } = useStore();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const path = (suffix = "") => buildStorePath(resolveStoreSlug(routeSlug), suffix);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const links = [{ label: "Início", to: path() }, { label: "Catálogo", to: path("/catalogo") }, { label: "Nossa loja", to: path("/sobre") }];
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    navigate(path(term ? `/catalogo?q=${encodeURIComponent(term)}` : "/catalogo"));
    setMenuOpen(false);
  };
  useEffect(() => setMenuOpen(false), [pathname, search]);

  return (
    <header className="variety-header">
      <div className="variety-strip"><div className="variety-wrap variety-strip-inner"><span>{tenant.hero_tagline || "Boas escolhas para todos os dias."}</span>{tenant.whatsapp && <a href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> Atendimento da loja</a>}</div></div>
      <div className="variety-wrap variety-mainbar">
        <button type="button" className="variety-menu" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
        <Link to={path()} className="variety-brand" aria-label={`${tenant.name} - início`}>{tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="variety-brand-mark"><Store size={21} /></span>}<span>{tenant.name}</span></Link>
        <form className="variety-search" role="search" onSubmit={submit}><SearchBar value={query} onChange={setQuery} placeholder="O que você está procurando?" /><button type="submit" aria-label="Buscar"><Search size={18} /><span>Buscar</span></button></form>
        <button type="button" className="variety-cart" onClick={openCart} aria-label={`Abrir pedido, ${count} ${count === 1 ? "item" : "itens"}`}><ShoppingBag size={20} /><span className="variety-cart-label">Meu pedido</span><b>{count}</b></button>
      </div>
      <nav className={`variety-nav ${menuOpen ? "is-open" : ""}`} aria-label="Departamentos e páginas"><div className="variety-wrap variety-nav-inner">
        {links.map((link) => <Link key={link.label} to={link.to} aria-current={pathname === link.to.split("?")[0] ? "page" : undefined}>{link.label}</Link>)}
        <span className="variety-nav-divider" aria-hidden="true" />
        {categories.slice(0, 8).map((category) => <Link key={category.id} to={path(`/catalogo?cat=${category.id}`)}>{category.name}</Link>)}
      </div></nav>
    </header>
  );
}

export function Footer() {
  const { slug: routeSlug } = useParams();
  const { tenant, categories } = useStore();
  const path = (suffix = "") => buildStorePath(resolveStoreSlug(routeSlug), suffix);
  const whatsapp = tenant.whatsapp?.replace(/\D/g, "");
  return (
    <footer className="variety-footer"><div className="variety-wrap variety-footer-grid">
      <div><span className="variety-footer-kicker">Um mundo de escolhas</span><h2>{tenant.name}</h2><p>{tenant.footer_text || tenant.about_text || "Utilidades, presentes e produtos para deixar o dia a dia mais fácil."}</p><div className="variety-socials">
        {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>}
        {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={18} /></a>}
      </div></div>
      <div><h3>Explore</h3><Link to={path()}>Início</Link><Link to={path("/catalogo")}>Todos os produtos</Link><Link to={path("/sobre")}>Nossa loja</Link></div>
      <div><h3>Departamentos</h3>{categories.slice(0, 7).map((category) => <Link key={category.id} to={path(`/catalogo?cat=${category.id}`)}>{category.name}</Link>)}</div>
      <div><h3>Fale com a loja</h3>{tenant.show_address && tenant.address && <p>{tenant.address}</p>}{whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">Atendimento pelo WhatsApp</a>}</div>
    </div><div className="variety-footer-bottom">© {new Date().getFullYear()} {tenant.name} · Powered by <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a></div></footer>
  );
}