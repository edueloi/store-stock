import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Menu, MessageCircle, Search, ShoppingBag, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import "./styles.css";

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
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);

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

  const brandParts = (tenant.name || "Vitra Vidraçaria").split(" ");
  const mainName = brandParts[0];
  const restName = brandParts.slice(1).join(" ") || "Vidraçaria & Design";

  return (
    <>
      {/* ── TOPBAR ── */}
      <div className="vitra-topbar">
        <div className="vitra-topbar-inner">
          <span>Projetos sob medida • Qualidade em cada detalhe</span>
          <span className="hidden sm:inline" style={{ opacity: 0.85 }}>
            {tenant.whatsapp ? `Atendimento: ${tenant.whatsapp}  |  ` : ""}Seg–Sex, 8h às 18h
          </span>
        </div>
      </div>

      {/* ── MAIN HEADER ── */}
      <header className="vitra-header">
        <div className="vitra-header-inner">
          {/* Brand */}
          <Link to={path()} className="vitra-brand" aria-label={`${tenant.name} - Início`}>
            <div className="vitra-brand-name">
              {mainName}
              <span>.</span>
            </div>
            <div className="vitra-brand-sub">{tenant.hero_tagline || restName}</div>
          </Link>

          {/* Desktop Navigation — strictly Início, Catálogo, Sobre */}
          <nav className="vitra-nav" aria-label="Navegação principal">
            {navLinks.map((link) => {
              const active =
                link.to === path()
                  ? pathname === path() || pathname === `${path()}/`
                  : pathname.startsWith(link.to);
              return (
                <Link key={link.label} to={link.to} className={active ? "active" : ""}>
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Actions (Search, Cart, Mobile Toggle) */}
          <div className="vitra-tools">
            <button
              type="button"
              className="vitra-icon-btn"
              onClick={() => setSearchOpen((prev) => !prev)}
              aria-label="Pesquisar produtos"
            >
              <Search size={18} />
            </button>

            <button
              type="button"
              className="vitra-icon-btn"
              onClick={openCart}
              aria-label={`Carrinho, ${count} itens`}
            >
              <ShoppingBag size={18} />
              {count > 0 && <span className="vitra-cart-badge">{count}</span>}
            </button>

            <button
              type="button"
              className="vitra-icon-btn vitra-mobile-btn"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Search Bar Dropdown */}
        {searchOpen && (
          <div style={{ background: "#ffffff", borderTop: "1px solid var(--vitra-line)", padding: "16px 1.5rem" }}>
            <form onSubmit={submit} style={{ maxWidth: 800, margin: "0 auto", position: "relative" }}>
              <SearchBar
                value={query}
                onChange={setQuery}
                placeholder="Busque por box, espelhos, portas de vidro, esquadrias..."
              />
            </form>
          </div>
        )}

        {/* Mobile Menu Dropdown */}
        <div className={`vitra-mobile-menu${menuOpen ? " open" : ""}`}>
          {navLinks.map((link) => (
            <Link key={link.label} to={link.to} onClick={() => setMenuOpen(false)}>
              {link.label}
            </Link>
          ))}
          {tenant.whatsapp && (
            <a
              href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => setMenuOpen(false)}
            >
              <MessageCircle size={14} style={{ display: "inline", marginRight: 8, color: "var(--vitra-accent)" }} />
              Falar no WhatsApp
            </a>
          )}
        </div>
      </header>
    </>
  );
}

export function Footer() {
  const { slug: routeSlug } = useParams();
  const { tenant, categories } = useStore();
  const path = (suffix = "") => buildStorePath(resolveStoreSlug(routeSlug), suffix);
  const whatsapp = tenant.whatsapp?.replace(/\D/g, "");

  const brandParts = (tenant.name || "Vitra Vidraçaria").split(" ");
  const mainName = brandParts[0];

  return (
    <footer className="vitra-footer">
      <div className="vitra-footer-inner">
        <div className="vitra-footer-grid">
          {/* Brand info */}
          <div>
            <div style={{ marginBottom: "1rem" }}>
              <span className="vitra-brand-name" style={{ color: "#ffffff", fontSize: 26 }}>
                {mainName}
                <span style={{ color: "var(--vitra-accent)" }}>.</span>
              </span>
              <span className="vitra-brand-sub" style={{ display: "block", color: "#8ca2a6" }}>
                VIDRAÇARIA & DESIGN
              </span>
            </div>
            <p style={{ lineHeight: 1.8, fontSize: 13, margin: "0 0 1rem" }}>
              {tenant.footer_text ||
                tenant.about_text ||
                "Soluções que refletem seu estilo. Projetos com elegância, segurança e atenção aos detalhes."}
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4>Navegação</h4>
            <Link className="link" to={path()}>Início</Link>
            <Link className="link" to={path("/catalogo")}>Catálogo</Link>
            <Link className="link" to={path("/sobre")}>Sobre nós</Link>
          </div>

          {/* Categories */}
          <div>
            <h4>Linhas & Produtos</h4>
            {categories.slice(0, 5).map((cat) => (
              <Link key={cat.id} className="link" to={path(`/catalogo?cat=${cat.id}`)}>
                {cat.name}
              </Link>
            ))}
          </div>

          {/* Contact */}
          <div>
            <h4>Fale conosco</h4>
            {tenant.show_address && tenant.address && (
              <p style={{ margin: "0 0 8px", fontSize: 13 }}>📍 {tenant.address}</p>
            )}
            {tenant.whatsapp && (
              <p style={{ margin: "0 0 8px", fontSize: 13 }}>
                ☎ {tenant.whatsapp}
              </p>
            )}
            <p style={{ margin: "0 0 8px", fontSize: 13 }}>Segunda a sexta: 8h às 18h</p>
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  color: "var(--vitra-accent)",
                  fontWeight: 700,
                  fontSize: 12,
                  textDecoration: "none",
                  marginTop: 6,
                }}
              >
                <MessageCircle size={14} /> Atendimento via WhatsApp
              </a>
            )}
          </div>
        </div>

        {/* Bottom */}
        <div
          style={{
            borderTop: "1px solid rgba(255, 255, 255, 0.12)",
            paddingTop: "24px",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: "1rem",
            fontSize: 12,
            color: "#8ca2a6",
          }}
        >
          <span>© {new Date().getFullYear()} {tenant.name}. Todos os direitos reservados.</span>
          <span>Projetos sob medida em vidros temperados, laminados e espelhos.</span>
        </div>
      </div>
    </footer>
  );
}
