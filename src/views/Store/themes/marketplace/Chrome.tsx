import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Facebook, Instagram, Menu, MessageCircle, Search, ShoppingCart, Store, X } from "lucide-react";
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
  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const links = [
    { label: "Início", to: path() },
    { label: "Produtos", to: path("/catalogo") },
    { label: "Sobre a loja", to: path("/sobre") },
  ];
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    navigate(path(term ? `/catalogo?q=${encodeURIComponent(term)}` : "/catalogo"));
    setMenuOpen(false);
  };

  useEffect(() => setMenuOpen(false), [pathname, search]);

  return (
    <header className="market-header">
      <div className="market-wrap market-mainbar">
        <button type="button" className="market-menu" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <Link to={path()} className="market-brand" aria-label={`${tenant.name} - início`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="market-brand-mark"><Store size={21} /></span>}
          <span>{tenant.name}</span>
        </Link>
        <form className="market-search" role="search" onSubmit={submit}>
          <SearchBar value={query} onChange={setQuery} placeholder="Buscar produtos e ofertas" />
          <button type="submit" aria-label="Buscar"><Search size={18} /><span>Buscar</span></button>
        </form>
        <button type="button" className="market-cart" onClick={openCart} aria-label={`Abrir carrinho, ${count} ${count === 1 ? "item" : "itens"}`}>
          <ShoppingCart size={20} /><span className="market-cart-label">Carrinho</span><b>{count}</b>
        </button>
      </div>
      <nav className={`market-nav ${menuOpen ? "is-open" : ""}`} aria-label="Navegação da loja">
        <div className="market-wrap market-nav-inner">
          {links.map((link) => <Link key={link.label} to={link.to} aria-current={pathname === link.to.split("?")[0] ? "page" : undefined}>{link.label}</Link>)}
          {categories.slice(0, 8).map((category) => <Link key={category.id} to={path(`/catalogo?cat=${category.id}`)}>{category.name}</Link>)}
        </div>
      </nav>
    </header>
  );
}

export function Footer() {
  const { slug: routeSlug } = useParams();
  const { tenant, categories } = useStore();
  const path = (suffix = "") => buildStorePath(resolveStoreSlug(routeSlug), suffix);
  const whatsapp = tenant.whatsapp?.replace(/\D/g, "");
  return (
    <footer className="market-footer">
      <div className="market-wrap market-footer-grid">
        <div className="market-footer-about">
          <span className="market-footer-kicker">Loja oficial</span>
          <h2>{tenant.name}</h2>
          <p>{tenant.footer_text || tenant.about_text || "Produtos selecionados, compra simples e atendimento direto com a loja."}</p>
          <div className="market-socials">
            {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>}
            {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={18} /></a>}
            {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={18} /></a>}
          </div>
        </div>
        <div><h3>Institucional</h3><Link to={path()}>Início</Link><Link to={path("/catalogo")}>Todos os produtos</Link><Link to={path("/sobre")}>Sobre a loja</Link></div>
        <div><h3>Categorias</h3>{categories.slice(0, 7).map((category) => <Link key={category.id} to={path(`/catalogo?cat=${category.id}`)}>{category.name}</Link>)}</div>
        <div>
          <h3>Atendimento</h3>
          {tenant.show_address && tenant.address && <p>{tenant.address}</p>}
          {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">Fale com a loja pelo WhatsApp</a>}
        </div>
      </div>
      <div className="market-footer-bottom">© {new Date().getFullYear()} {tenant.name} · Powered by <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a></div>
    </footer>
  );
}