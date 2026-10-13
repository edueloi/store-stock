import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Menu, MessageCircle, ShoppingBag, X } from "lucide-react";
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = query.trim();
    navigate(path(term ? `/catalogo?q=${encodeURIComponent(term)}` : "/catalogo"));
    setMenuOpen(false);
  };

  useEffect(() => setMenuOpen(false), [pathname, search]);

  const navLinks = [
    { label: "Início", to: path() },
    { label: "Catálogo", to: path("/catalogo") },
    { label: "Sobre", to: path("/sobre") },
  ];

  return (
    <header className="sw-header">
      <div className="sw-header-inner">
        {/* Logo */}
        <Link to={path()} className="sw-logo" aria-label={`${tenant.name} - início`}>
          <div className="sw-logo-mark">
            {tenant.logo_url
              ? <img src={tenant.logo_url} alt={tenant.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }} />
              : tenant.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="sw-logo-text">
            <span className="sw-logo-name">
              {tenant.name.split(" ").slice(0, -1).join(" ") || tenant.name}{" "}
              <span>{tenant.name.split(" ").slice(-1)}</span>
            </span>
            <span className="sw-logo-sub">{tenant.hero_tagline || "Streetwear & Skate"}</span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="sw-nav" aria-label="Navegação principal">
          {navLinks.map((link) => (
            <Link key={link.label} to={link.to}>{link.label}</Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="sw-actions">
          {/* Desktop search */}
          <form className="sw-search-wrap" role="search" onSubmit={submit}>
            <SearchBar value={query} onChange={setQuery} placeholder="Buscar produto..." />
            <i className="fa-solid fa-magnifying-glass sw-search-icon" aria-hidden="true" />
          </form>

          {/* Cart */}
          <button type="button" className="sw-cart-btn" onClick={openCart} aria-label={`Carrinho, ${count} ${count === 1 ? "item" : "itens"}`}>
            <ShoppingBag size={20} />
            <span className="sw-cart-count">{count}</span>
          </button>

          {/* Mobile menu toggle */}
          <button type="button" className="sw-menu-btn" onClick={() => setMenuOpen((v) => !v)} aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`sw-mobile-menu${menuOpen ? " open" : ""}`} id="sw-mobile-menu">
        <div className="sw-mobile-search">
          <form role="search" onSubmit={submit}>
            <SearchBar value={query} onChange={setQuery} placeholder="Buscar produto..." />
          </form>
        </div>
        {navLinks.map((link) => (
          <Link key={link.label} to={link.to} onClick={() => setMenuOpen(false)}>{link.label}</Link>
        ))}
        {tenant.whatsapp && (
          <a href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)}>
            <MessageCircle size={14} style={{ display: "inline", marginRight: 6 }} />
            WhatsApp
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

  return (
    <footer className="sw-footer">
      <div className="sw-footer-inner">
        <div className="sw-footer-grid">
          {/* Brand */}
          <div>
            <div className="sw-footer-brand-logo">
              <div className="sw-footer-brand-mark">
                {tenant.logo_url
                  ? <img src={tenant.logo_url} alt={tenant.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 4 }} />
                  : tenant.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="sw-footer-brand-name">
                {tenant.name.split(" ").slice(0, -1).join(" ") || tenant.name}{" "}
                <span>{tenant.name.split(" ").slice(-1)}</span>
              </span>
            </div>
            <p>{tenant.footer_text || tenant.about_text || "O e-commerce definitivo para quem vive a cultura urbana, streetwear e o skate com estilo inconfundível."}</p>
            <div className="sw-footer-socials">
              <a href="#" aria-label="Instagram"><i className="fa-brands fa-instagram" /></a>
              <a href="#" aria-label="TikTok"><i className="fa-brands fa-tiktok" /></a>
              <a href="#" aria-label="YouTube"><i className="fa-brands fa-youtube" /></a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4>Navegação</h4>
            <ul className="sw-footer-links">
              <li><Link to={path()}>Início</Link></li>
              <li><Link to={path("/catalogo")}>Catálogo</Link></li>
              <li><Link to={path("/sobre")}>Sobre a Marca</Link></li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4>Categorias</h4>
            <ul className="sw-footer-links">
              {categories.slice(0, 6).map((cat) => (
                <li key={cat.id}><Link to={path(`/catalogo?cat=${cat.id}`)}>{cat.name}</Link></li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4>Pagamento & Segurança</h4>
            <p className="sw-footer-payments">Aceitamos Pix, Cartões de Crédito e Boleto com segurança criptografada.</p>
            <div className="sw-footer-payment-icons">
              <i className="fa-brands fa-cc-visa" title="Visa" />
              <i className="fa-brands fa-cc-mastercard" title="Mastercard" />
              <i className="fa-solid fa-shield-halved" title="Site Seguro" style={{ color: "var(--sw-accent)" }} />
            </div>
            {whatsapp && (
              <div style={{ marginTop: "1rem" }}>
                <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" style={{ color: "#a1a1aa", textDecoration: "none", fontSize: ".75rem" }}>
                  <i className="fa-brands fa-whatsapp" style={{ marginRight: 6, color: "var(--sw-accent)" }} />
                  WhatsApp da loja
                </a>
              </div>
            )}
            {tenant.show_address && tenant.address && (
              <p style={{ marginTop: ".5rem" }}>
                <i className="fa-solid fa-location-dot" style={{ marginRight: 6, color: "var(--sw-accent)" }} />
                {tenant.address}
              </p>
            )}
          </div>
        </div>

        <div className="sw-footer-bottom">
          <p>© {new Date().getFullYear()} {tenant.name}. Todos os direitos reservados.</p>
          <div className="sw-footer-bottom-links">
            <a href="#">Termos de Uso</a>
            <a href="#">Privacidade</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
