import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Heart, Menu, Search, ShoppingBag, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import "./styles.css";

export function Header() {
  const { slug: routeSlug } = useParams();
  const { tenant, categories, cart, openCart, wishlist } = useStore();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const path = (suffix = "") => buildStorePath(resolveStoreSlug(routeSlug), suffix);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = query.trim();
    navigate(path(term ? `/catalogo?q=${encodeURIComponent(term)}` : "/catalogo"));
    setMenuOpen(false);
    setMobileSearchOpen(false);
  };

  useEffect(() => {
    setMenuOpen(false);
    setMobileSearchOpen(false);
  }, [pathname, search]);

  return (
    <>
      {/* Top Announcement */}
      <div className="aura-announcement">
        <span>
          <i className="fa-solid fa-gift" style={{ color: "var(--aura-gold)", marginRight: "6px" }}></i>
          FRETE GRÁTIS EM COMPRAS ACIMA DE R$ 300
        </span>
        <span style={{ opacity: 0.4 }}>|</span>
        <span className="hidden md:inline">
          GANHE 10% OFF NO PIX OU 1ª COMPRA COM O CUPOM: <strong>AURA10</strong>
        </span>
      </div>

      <header className="aura-header">
        <div className="aura-header-inner">
          {/* Mobile hamburger & search */}
          <div className="flex items-center lg:hidden gap-2">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="aura-icon-btn text-xl"
              aria-label="Abrir menu"
            >
              <Menu size={22} />
            </button>
            <button
              type="button"
              onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
              className="aura-icon-btn text-lg"
              aria-label="Buscar"
            >
              <Search size={19} />
            </button>
          </div>

          {/* Logo / Brand */}
          <Link to={path()} className="aura-brand-link">
            <h1 className="aura-brand-title">{tenant.name || "Aura Feminina"}</h1>
            <span className="aura-brand-sub">{tenant.hero_tagline || "Moda & Sofisticação"}</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="aura-nav-desktop">
            <Link to={path()}>Início</Link>
            <Link to={path("/catalogo")}>Catálogo</Link>
            <Link to={path("/sobre")}>Sobre</Link>
          </nav>

          {/* Actions */}
          <div className="aura-header-actions">
            <form className="aura-search-wrap" role="search" onSubmit={submit}>
              <i className="fa-solid fa-magnifying-glass aura-search-icon"></i>
              <SearchBar value={query} onChange={setQuery} placeholder="Pesquisar peças..." />
            </form>

            <Link to={path("/catalogo")} className="aura-icon-btn" title="Favoritos">
              <Heart size={21} />
              {wishlist.length > 0 && <span className="aura-badge-wish">{wishlist.length}</span>}
            </Link>

            <button type="button" onClick={openCart} className="aura-icon-btn" title="Carrinho">
              <ShoppingBag size={21} />
              {count > 0 && <span className="aura-badge-cart">{count}</span>}
            </button>
          </div>
        </div>

        {/* Mobile Search Bar Expandable */}
        {mobileSearchOpen && (
          <div className="aura-mobile-search">
            <form role="search" onSubmit={submit}>
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-xs text-stone-500"></i>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="O que você está procurando?"
                  autoFocus
                />
              </div>
            </form>
          </div>
        )}
      </header>

      {/* Mobile Slide-Over Menu */}
      {menuOpen && (
        <>
          <div className="aura-mobile-overlay" onClick={() => setMenuOpen(false)} />
          <div className="aura-mobile-panel open">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-stone-200">
                <h2 className="aura-serif text-xl font-bold uppercase tracking-wider">Menu</h2>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="aura-icon-btn text-xl"
                >
                  <X size={22} />
                </button>
              </div>

              <nav className="pt-4">
                <Link to={path()} onClick={() => setMenuOpen(false)}>
                  Início
                </Link>
                <Link to={path("/catalogo")} onClick={() => setMenuOpen(false)}>
                  Catálogo
                </Link>
                <Link to={path("/sobre")} onClick={() => setMenuOpen(false)}>
                  Sobre
                </Link>
              </nav>
            </div>

            <div className="border-t border-stone-200 pt-4 text-xs text-stone-500 text-center">
              <p className="font-semibold text-stone-800">{tenant.name}</p>
              <p className="mt-1">Elegância em cada detalhe.</p>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export function Footer() {
  const { slug: routeSlug } = useParams();
  const { tenant, categories } = useStore();
  const path = (suffix = "") => buildStorePath(resolveStoreSlug(routeSlug), suffix);
  const whatsapp = tenant.whatsapp?.replace(/\D/g, "");

  return (
    <footer className="aura-footer">
      <div className="aura-footer-inner">
        <div className="aura-footer-grid">
          {/* Brand */}
          <div className="space-y-4">
            <h3 className="aura-serif text-2xl tracking-[0.2em] font-bold text-white uppercase">
              {tenant.name || "Aura Feminina"}
            </h3>
            <p className="text-xs text-stone-300 leading-relaxed font-light">
              {tenant.footer_text ||
                tenant.about_text ||
                "Moda feminina sofisticada que une a alfaiataria clássica às tendências contemporâneas da alta costura."}
            </p>
            <div className="flex space-x-4 text-lg text-stone-400">
              <a href="#" className="hover:text-amber-300 transition-colors">
                <i className="fa-brands fa-instagram"></i>
              </a>
              <a href="#" className="hover:text-amber-300 transition-colors">
                <i className="fa-brands fa-facebook-f"></i>
              </a>
              <a href="#" className="hover:text-amber-300 transition-colors">
                <i className="fa-brands fa-pinterest-p"></i>
              </a>
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-amber-300 transition-colors"
                >
                  <i className="fa-brands fa-whatsapp"></i>
                </a>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4>Navegação</h4>
            <ul>
              <li>
                <Link to={path()}>Início</Link>
              </li>
              <li>
                <Link to={path("/catalogo")}>Coleção Completa</Link>
              </li>
              <li>
                <Link to={path("/sobre")}>Sobre a Marca</Link>
              </li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4>Categorias</h4>
            <ul>
              {categories.slice(0, 6).map((cat) => (
                <li key={cat.id}>
                  <Link to={path(`/catalogo?cat=${cat.id}`)}>{cat.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Payments & Security */}
          <div>
            <h4>Pagamento & Segurança</h4>
            <div className="flex flex-wrap gap-3 text-2xl text-stone-300 mb-4">
              <i className="fa-brands fa-cc-visa" title="Visa"></i>
              <i className="fa-brands fa-cc-mastercard" title="Mastercard"></i>
              <i className="fa-brands fa-pix" title="Pix"></i>
              <i className="fa-solid fa-qrcode" title="Pix QR"></i>
            </div>
            <h4>Garantia & Confiança</h4>
            <div className="space-y-2 text-xs text-stone-300">
              <p className="flex items-center gap-1.5">
                <i className="fa-solid fa-lock text-amber-400"></i> Compra 100% Segura
              </p>
              <p className="flex items-center gap-1.5">
                <i className="fa-solid fa-truck-fast text-amber-400"></i> Envio Rápido e Rastreado
              </p>
            </div>
          </div>
        </div>

        <div className="aura-footer-bottom">
          <p>© {new Date().getFullYear()} {tenant.name}. Todos os direitos reservados.</p>
          <p>Desenvolvido com sofisticação para mulheres autênticas.</p>
        </div>
      </div>
    </footer>
  );
}
