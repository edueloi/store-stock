import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Menu, MessageCircle, Search, ShoppingBag, X, Zap } from "lucide-react";
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
  const links = [{ label: "Início", to: path() }, { label: "Drops", to: path("/catalogo") }, { label: "Manifesto", to: path("/sobre") }];
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    navigate(path(term ? `/catalogo?q=${encodeURIComponent(term)}` : "/catalogo"));
    setMenuOpen(false);
  };
  useEffect(() => setMenuOpen(false), [pathname, search]);

  return (
    <header className="street-header">
      <div className="street-strip"><div className="street-wrap"><span>DROP ATUAL · {tenant.hero_tagline || "Feito para sair do padrão."}</span>{tenant.whatsapp && <a href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> Contato</a>}</div></div>
      <div className="street-wrap street-mainbar">
        <button type="button" className="street-menu" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
        <Link to={path()} className="street-brand" aria-label={`${tenant.name} - início`}><span className="street-brand-mark"><Zap size={20} fill="currentColor" /></span><span>{tenant.name}</span></Link>
        <form className="street-search" role="search" onSubmit={submit}><SearchBar value={query} onChange={setQuery} placeholder="Buscar peças e drops" /><button type="submit" aria-label="Buscar"><Search size={18} /><span>Buscar</span></button></form>
        <button type="button" className="street-cart" onClick={openCart} aria-label={`Abrir sacola, ${count} ${count === 1 ? "item" : "itens"}`}><ShoppingBag size={19} /><span>Sacola</span><b>{count}</b></button>
      </div>
      <nav className={`street-nav ${menuOpen ? "is-open" : ""}`} aria-label="Navegação streetwear"><div className="street-wrap street-nav-inner">
        {links.map((link) => <Link key={link.label} to={link.to} aria-current={pathname === link.to.split("?")[0] ? "page" : undefined}>{link.label}</Link>)}
        <span className="street-nav-mark" aria-hidden="true">///</span>
        {categories.slice(0, 7).map((category) => <Link key={category.id} to={path(`/catalogo?cat=${category.id}`)}>{category.name}</Link>)}
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
    <footer className="street-footer"><div className="street-wrap street-footer-grid">
      <div><span className="street-footer-mark"><Zap size={16} fill="currentColor" /> STREET GOODS</span><h2>{tenant.name}</h2><p>{tenant.footer_text || tenant.about_text || "Drops independentes, atitude diária e peças selecionadas pela loja."}</p></div>
      <div><h3>Navegue</h3><Link to={path()}>Início</Link><Link to={path("/catalogo")}>Todos os drops</Link><Link to={path("/sobre")}>Manifesto</Link></div>
      <div><h3>Categorias</h3>{categories.slice(0, 7).map((category) => <Link key={category.id} to={path(`/catalogo?cat=${category.id}`)}>{category.name}</Link>)}</div>
      <div><h3>Fale com a gente</h3>{tenant.show_address && tenant.address && <p>{tenant.address}</p>}{whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">WhatsApp da loja</a>}</div>
    </div><div className="street-footer-bottom">© {new Date().getFullYear()} {tenant.name} · Powered by <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a></div></footer>
  );
}