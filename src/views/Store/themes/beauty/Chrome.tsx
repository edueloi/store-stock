import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Menu, MessageCircle, Search, ShoppingBag, Sparkles, X } from "lucide-react";
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
  const links = [{ label: "Início", to: path() }, { label: "Produtos", to: path("/catalogo") }, { label: "Nossa loja", to: path("/sobre") }];
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    navigate(path(term ? `/catalogo?q=${encodeURIComponent(term)}` : "/catalogo"));
    setMenuOpen(false);
  };
  useEffect(() => setMenuOpen(false), [pathname, search]);

  return (
    <header className="beauty-header">
      <div className="beauty-note"><div className="beauty-wrap"><span>{tenant.hero_tagline || "Sua rotina de cuidado, do seu jeito."}</span>{tenant.whatsapp && <a href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> Fale com uma consultora</a>}</div></div>
      <div className="beauty-wrap beauty-mainbar">
        <button type="button" className="beauty-menu" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
        <Link to={path()} className="beauty-brand" aria-label={`${tenant.name} - início`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="beauty-brand-mark"><Sparkles size={20} /></span>}
          <span>{tenant.name}</span>
        </Link>
        <form className="beauty-search" role="search" onSubmit={submit}><SearchBar value={query} onChange={setQuery} placeholder="Buscar cuidados, marcas e produtos" /><button type="submit" aria-label="Buscar"><Search size={18} /></button></form>
        <button type="button" className="beauty-cart" onClick={openCart} aria-label={`Abrir sacola, ${count} ${count === 1 ? "item" : "itens"}`}><ShoppingBag size={19} /><span>Sacola</span><b>{count}</b></button>
      </div>
      <nav className={`beauty-nav ${menuOpen ? "is-open" : ""}`} aria-label="Navegação da loja"><div className="beauty-wrap beauty-nav-inner">
        {links.map((link) => <Link key={link.label} to={link.to} aria-current={pathname === link.to.split("?")[0] ? "page" : undefined}>{link.label}</Link>)}
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
    <footer className="beauty-footer"><div className="beauty-wrap beauty-footer-grid">
      <div><span className="beauty-footer-label">Cuidado com intenção</span><h2>{tenant.name}</h2><p>{tenant.footer_text || tenant.about_text || "Uma curadoria para acompanhar a sua rotina, com atenção em cada escolha."}</p></div>
      <div><h3>Descubra</h3><Link to={path()}>Início</Link><Link to={path("/catalogo")}>Todos os produtos</Link><Link to={path("/sobre")}>Sobre a loja</Link></div>
      <div><h3>Categorias</h3>{categories.slice(0, 7).map((category) => <Link key={category.id} to={path(`/catalogo?cat=${category.id}`)}>{category.name}</Link>)}</div>
      <div><h3>Atendimento</h3>{tenant.show_address && tenant.address && <p>{tenant.address}</p>}{whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">Fale com a loja</a>}</div>
    </div><div className="beauty-footer-bottom">© {new Date().getFullYear()} {tenant.name} · Powered by <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a></div></footer>
  );
}