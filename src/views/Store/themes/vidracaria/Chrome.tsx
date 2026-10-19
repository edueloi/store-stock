import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ChevronDown, Menu, MessageCircle, Search, ShoppingBag, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import "./styles.css";

export function Header() {
  const { slug: routeSlug } = useParams();
  const { tenant, cart, categories, products, openCart } = useStore();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [linesOpen, setLinesOpen] = useState(false);

  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const lines = categories.filter((c) => products.some((p) => p.is_active && p.category_id === c.id));

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
    setLinesOpen(false);
  }, [pathname, search]);

  const navLinks = [
    { label: "Início", to: path() },
    { label: "Catálogo", to: path("/catalogo") },
    { label: "Sobre", to: path("/sobre") },
  ];
  const isActive = (to: string) => (to === path() ? pathname === path() || pathname === `${path()}/` : pathname.startsWith(to));

  const brandParts = (tenant.name || "Vitra Vidraçaria").split(" ");
  const mainName = brandParts[0];
  const restName = brandParts.slice(1).join(" ") || "Vidraçaria & Design";
  const wa = tenant.whatsapp ? `https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}` : "";

  return (
    <header className="vitra-header vitra-root">
      <div className="vitra-bar">
        <nav className="vitra-nav" aria-label="Navegação principal">
          {navLinks.map((link) => (
            <Link key={link.label} to={link.to} className={isActive(link.to) ? "active" : ""}>{link.label}</Link>
          ))}
          {lines.length > 0 && (
            <button type="button" className="vitra-lines-btn" aria-expanded={linesOpen} onClick={() => setLinesOpen((v) => !v)}>
              Linhas <ChevronDown size={14} />
            </button>
          )}
        </nav>

        <Link to={path()} className="vitra-brand" aria-label={`${tenant.name} - Início`}>
          {tenant.logo_url ? (
            <img src={tenant.logo_url} alt="" className="vitra-logo" />
          ) : (
            <span className="vitra-brand-name">{mainName}<span>.</span></span>
          )}
          <span className="vitra-brand-sub">{tenant.hero_tagline || restName}</span>
        </Link>

        <div className="vitra-tools">
          <button type="button" className="vitra-icon-btn" onClick={() => setSearchOpen((prev) => !prev)} aria-expanded={searchOpen} aria-label="Pesquisar produtos">
            <Search size={18} />
          </button>
          <button type="button" className="vitra-icon-btn" onClick={openCart} aria-label={`Carrinho, ${count} itens`}>
            <ShoppingBag size={18} />
            {count > 0 && <span className="vitra-cart-badge">{count}</span>}
          </button>
          <button type="button" className="vitra-icon-btn vitra-mobile-btn" onClick={() => setMenuOpen((prev) => !prev)} aria-expanded={menuOpen} aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {linesOpen && (
        <div className="vitra-pop vitra-lines" role="menu">
          {lines.map((c) => (
            <Link key={c.id} role="menuitem" to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link>
          ))}
        </div>
      )}

      {searchOpen && (
        <form className="vitra-pop vitra-searchpop" onSubmit={submit} role="search">
          <SearchBar value={query} onChange={setQuery} placeholder="Busque por box, espelhos, portas de vidro, esquadrias..." />
        </form>
      )}

      <div className={`vitra-mobile-menu${menuOpen ? " open" : ""}`}>
        {navLinks.map((link) => (
          <Link key={link.label} to={link.to} onClick={() => setMenuOpen(false)}>{link.label}</Link>
        ))}
        {lines.length > 0 && <h4>Linhas</h4>}
        {lines.map((c) => (
          <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} onClick={() => setMenuOpen(false)}>{c.name}</Link>
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
  const mainName = (tenant.name || "Vitra Vidraçaria").split(" ")[0];

  return (
    <footer className="vitra-footer vitra-root">
      <div className="vitra-footer-inner">
        <div className="vitra-footer-grid">
          <div className="vitra-fcard vitra-fcard-brand">
            <span className="vitra-brand-name">{mainName}<span>.</span></span>
            <span className="vitra-brand-sub">Vidraçaria & Design</span>
            <p>{tenant.footer_text || tenant.about_text || "Soluções que refletem seu estilo. Projetos com elegância, segurança e atenção aos detalhes."}</p>
          </div>
          <div className="vitra-fcard">
            <h4>Navegação</h4>
            <Link className="link" to={path()}>Início</Link>
            <Link className="link" to={path("/catalogo")}>Catálogo</Link>
            <Link className="link" to={path("/sobre")}>Sobre nós</Link>
          </div>
          <div className="vitra-fcard">
            <h4>Linhas & produtos</h4>
            {categories.slice(0, 5).map((cat) => (
              <Link key={cat.id} className="link" to={path(`/catalogo?cat=${cat.id}`)}>{cat.name}</Link>
            ))}
          </div>
          <div className="vitra-fcard">
            <h4>Fale conosco</h4>
            {tenant.show_address && tenant.address && <p className="small">{tenant.address}</p>}
            {tenant.whatsapp && <p className="small">{tenant.whatsapp}</p>}
            {whatsapp && (
              <a className="vitra-wa" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">
                <MessageCircle size={15} /> Atendimento via WhatsApp
              </a>
            )}
          </div>
        </div>
        <div className="vitra-footer-bottom">
          <span>© {new Date().getFullYear()} {tenant.name}. Todos os direitos reservados.</span>
          <span>Projetos sob medida em vidros temperados, laminados e espelhos.</span>
        </div>
      </div>
    </footer>
  );
}
