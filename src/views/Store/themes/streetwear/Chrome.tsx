import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import { useKit } from "../street/kit";
import "./styles.css";

export function Header() {
  const { tenant, path, cartCount, openCart } = useKit();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  const navLinks = [
    { label: "Início", to: path() },
    { label: "Shop", to: path("/catalogo") },
    { label: "Nossa rua", to: path("/sobre") },
  ];

  const isActive = (to: string) => {
    if (to === path()) return pathname === path() || pathname === `${path()}/`;
    return pathname.startsWith(to);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(path(`/catalogo?q=${encodeURIComponent(searchTerm.trim())}`));
      setSearchOpen(false);
      setSearchTerm("");
    }
  };

  const announcementText =
    tenant.policies?.storefront?.hero_tagline ||
    "Frete grátis nas compras acima de R$ 299 · Streetwear de verdade";

  return (
    <>
      <div className="rua-announcement">{announcementText}</div>
      <header className="rua-header">
        <div className="rua-header-inner">
          <button
            type="button"
            className="rua-icon-btn rua-mobile-menu-btn"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <Link to={path()} className="rua-logo" aria-label={`${tenant.name} - Início`}>
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name} />
            ) : (
              <>
                {tenant.name ? (
                  <>
                    {tenant.name.toUpperCase()}
                    <span>.</span>
                  </>
                ) : (
                  <>
                    RUA<span>013</span>.
                  </>
                )}
              </>
            )}
          </Link>

          <nav className="rua-nav" aria-label="Navegação principal">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className={isActive(link.to) ? "active" : ""}
                aria-current={isActive(link.to) ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="rua-tools">
            <button
              type="button"
              className="rua-icon-btn"
              aria-label="Buscar produtos"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              <Search size={22} />
            </button>
            <button
              type="button"
              className="rua-icon-btn"
              aria-label={`Abrir carrinho com ${cartCount} itens`}
              onClick={openCart}
            >
              <ShoppingBag size={22} />
              <span className="rua-count">{cartCount}</span>
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="rua-container" style={{ paddingBottom: 16 }}>
            <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 8 }}>
              <input
                type="search"
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por produto, marca ou estilo..."
                className="rua-search-input"
                style={{ marginBottom: 0 }}
              />
              <button type="submit" className="rua-btn" style={{ padding: "12px 20px" }}>
                Buscar
              </button>
            </form>
          </div>
        )}

        {menuOpen && (
          <nav className="rua-mobile-nav" aria-label="Menu mobile">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
    </>
  );
}

export function Footer() {
  const { tenant, path } = useKit();
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    setSubscribed(true);
    setTimeout(() => setSubscribed(false), 4000);
  };

  return (
    <>
      <section className="rua-newsletter">
        <div className="rua-container inner">
          <div>
            <div className="rua-eyebrow" style={{ color: "#141414" }}>Não perde o próximo drop</div>
            <h2>ENTRA PRA CREW.</h2>
          </div>
          <form className="rua-newsletter-form" onSubmit={handleSubscribe}>
            <input
              type="email"
              required
              placeholder="Seu melhor e-mail"
              aria-label="Seu e-mail"
            />
            <button type="submit">
              {subscribed ? "INSCRITO! ↗" : "ME INSCREVER ↗"}
            </button>
          </form>
        </div>
      </section>

      <footer className="rua-footer">
        <div className="rua-container">
          <div className="rua-footer-grid">
            <div>
              <Link to={path()} className="rua-logo" style={{ color: "white" }}>
                {tenant.logo_url ? (
                  <img src={tenant.logo_url} alt={tenant.name} style={{ filter: "brightness(0) invert(1)" }} />
                ) : (
                  <>
                    {(tenant.name || "RUA013").toUpperCase()}
                    <span style={{ color: "var(--rua-acid)" }}>.</span>
                  </>
                )}
              </Link>
              <p style={{ marginTop: 20, maxWidth: 280 }}>
                {tenant.about_text || "Na pista, na calçada, no corre. Streetwear e skate são parte da nossa história."}
              </p>
            </div>

            <div>
              <h4>Navegação</h4>
              <Link to={path()}>Início</Link>
              <Link to={path("/catalogo")}>Shop / Catálogo</Link>
              <Link to={path("/sobre")}>Nossa rua / Sobre</Link>
            </div>

            <div>
              <h4>Atendimento</h4>
              {tenant.whatsapp && (
                <a
                  href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp: {tenant.whatsapp}
                </a>
              )}
              {tenant.email && <a href={`mailto:${tenant.email}`}>{tenant.email}</a>}
              <Link to={path("/sobre")}>Trocas e devoluções</Link>
            </div>

            <div>
              <h4>Seu corre começa aqui</h4>
              <p>
                {tenant.address_city && tenant.address_state
                  ? `${tenant.address_city} - ${tenant.address_state}`
                  : "Entregamos para todo o Brasil com estilo e atitude."}
              </p>
            </div>
          </div>

          <div className="rua-footer-bottom">
            <span>© {new Date().getFullYear()} {tenant.name || "RUA013"}. Streetwear & Skate Shop.</span>
            <span>Todos os direitos reservados.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
