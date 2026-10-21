import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ClipboardList, Menu, MessageCircle, Search, ShoppingBag, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import "./styles.css";
import { useGlassProject } from "./project";
import { vitraContent } from "./content";

export function Header() {
  const { slug: routeSlug } = useParams();
  const { tenant, cart, openCart } = useStore();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);
  const project = useGlassProject(slug);
  const quoteEnabled = tenant.policies?.storefront?.glass_quote_enabled === true;
  const count = (quoteEnabled ? project.pieces : cart).reduce((sum, item) => sum + item.quantity, 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = query.trim();
    navigate(path(term ? `/catalogo?q=${encodeURIComponent(term)}` : "/catalogo"));
    setSearchOpen(false);
    setMenuOpen(false);
  };

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname, search]);

  const navLinks = [
    { label: "Início", to: path() },
    { label: "Catálogo", to: path("/catalogo") },
    { label: "Sobre", to: path("/sobre") },
  ];
  const isActive = (to: string) => (to === path() ? pathname === path() || pathname === `${path()}/` : pathname.startsWith(to));

  const wa = tenant.whatsapp ? `https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}` : "";
  useEffect(() => {
    if (!menuOpen && !searchOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); setSearchOpen(false); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen, searchOpen]);

  return (
    <header className="vitra-header vitra-root">
      <div className="vitra-bar">
        <Link to={path()} className="vitra-brand vitra-header-brand" aria-label={`${tenant.name} - Início`}>
          {tenant.logo_url && <img src={tenant.logo_url} alt="" className="vitra-logo" />}
          <span className="vitra-header-brand-copy">
            <strong className="vitra-header-brand-name">{tenant.name || "Vitra Vidraçaria"}</strong>
            {tenant.hero_tagline && <small className="vitra-header-brand-tagline">{tenant.hero_tagline}</small>}
          </span>
        </Link>
        <nav className="vitra-nav" aria-label="Navegação principal">
          {navLinks.map((link) => (
            <Link key={link.label} to={link.to} aria-current={isActive(link.to) ? "page" : undefined} className={isActive(link.to) ? "active" : ""}>{link.label}</Link>
          ))}
        </nav>

        <div className="vitra-tools">
          <button type="button" className="vitra-icon-btn" onClick={() => { setSearchOpen((prev) => !prev); setMenuOpen(false); }} aria-controls="vitra-header-search" aria-expanded={searchOpen} aria-label="Pesquisar produtos">
            <Search size={18} />
          </button>
          {quoteEnabled ? <Link to={path("/orcamento")} className="vitra-icon-btn vitra-project-link" aria-label={`Meu projeto, ${count} peças`}>
            <ClipboardList size={18} /><span className="vitra-project-link-text">Meu projeto</span>
            {count > 0 && <span className="vitra-cart-badge">{count}</span>}
          </Link> : <button type="button" className="vitra-icon-btn" onClick={openCart} aria-label={`Carrinho, ${count} itens`}><ShoppingBag size={18}/>{count > 0 && <span className="vitra-cart-badge">{count}</span>}</button>}
          <button type="button" className="vitra-icon-btn vitra-mobile-btn" onClick={() => { setMenuOpen((prev) => !prev); setSearchOpen(false); }} aria-controls="vitra-header-menu" aria-expanded={menuOpen} aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>


      {searchOpen && (
        <form id="vitra-header-search" className="vitra-pop vitra-searchpop" onSubmit={submit} role="search">
          <SearchBar value={query} onChange={setQuery} placeholder="Busque no catálogo da loja..." />
        </form>
      )}

      <div id="vitra-header-menu" className={`vitra-mobile-menu${menuOpen ? " open" : ""}`}>
        {quoteEnabled && <Link to={path("/orcamento")}>Montar meu orçamento</Link>}
        {navLinks.map((link) => (
          <Link key={link.label} to={link.to} aria-current={isActive(link.to) ? "page" : undefined} onClick={() => setMenuOpen(false)}>{link.label}</Link>
        ))}
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)}>
            <MessageCircle size={14} style={{ display: "inline", marginRight: 8, color: "var(--vitra-accent)" }} />
            Falar no WhatsApp
          </a>
        )}
      </div>
    </header>
  );
}

export function Footer() {
  const { slug: routeSlug } = useParams();
  const { tenant, categories } = useStore();
  const path = (suffix = "") => buildStorePath(resolveStoreSlug(routeSlug), suffix);
  const whatsapp = tenant.whatsapp?.replace(/\D/g, "");
  const content = vitraContent(tenant);

  return (
    <footer className="vitra-footer vitra-root">
      <div className="vitra-footer-inner">
        <div className="vitra-footer-grid">
          <div className="vitra-fcard vitra-fcard-brand">
            <span className="vitra-brand-name">{tenant.name}</span>
            {content.footer_tagline && <span className="vitra-brand-sub">{content.footer_tagline}</span>}
            {content.footer_description && <p>{content.footer_description}</p>}
          </div>
          <div className="vitra-fcard">
            <h4>Navegação</h4>
            <Link className="link" to={path()}>Início</Link>
            <Link className="link" to={path("/catalogo")}>Catálogo</Link>
            <Link className="link" to={path("/sobre")}>Sobre nós</Link>
            {tenant.policies?.storefront?.glass_quote_enabled === true && <Link className="link" to={path("/orcamento")}>Solicitar orçamento</Link>}
          </div>
          {content.footer_show_categories && categories.length > 0 && <div className="vitra-fcard">
            <h4>Categorias</h4>
            {categories.slice(0, 5).map((cat) => (
              <Link key={cat.id} className="link" to={path(`/catalogo?cat=${cat.id}`)}>{cat.name}</Link>
            ))}
          </div>}
          {content.footer_show_contact && (whatsapp || (tenant.show_address && tenant.address)) && <div className="vitra-fcard">
            <h4>Fale conosco</h4>
            {tenant.show_address && tenant.address && <p className="small">{tenant.address}</p>}
            {tenant.whatsapp && <p className="small">{tenant.whatsapp}</p>}
            {whatsapp && (
              <a className="vitra-wa" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">
                <MessageCircle size={15} /> Atendimento via WhatsApp
              </a>
            )}
          </div>}
        </div>
        <div className="vitra-footer-bottom">
          <span>© {new Date().getFullYear()} {tenant.name}. Todos os direitos reservados.</span>
          {content.footer_note && <span>{content.footer_note}</span>}
          <span className="vitra-footer-credit">Desenvolvido por <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">boxsys.com.br</a></span>
        </div>
      </div>
    </footer>
  );
}
