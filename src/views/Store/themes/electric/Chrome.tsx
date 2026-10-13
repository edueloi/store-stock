import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Clock, Facebook, Heart, Instagram, Menu, Phone, ShoppingCart, X, Zap } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { useStore } from "../../StoreLayout";
import { hoursRows, useTheme, waLink } from "./lib";
import "./styles.css";

export function Header() {
  const { tenant, categories, products, cart, openCart, wishlist } = useStore();
  const { path } = useTheme();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  const cats = categories.filter((c) => products.some((p) => p.is_active && p.category_id === c.id));

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate(path(`/catalogo?q=${encodeURIComponent(q)}`));
    setQuery("");
    setOpen(false);
  };
  const links = [
    { name: "Início", to: path() },
    { name: "Catálogo completo", to: path("/catalogo") },
    { name: "Sobre a loja", to: path("/sobre") },
  ];

  return (
    <header className="ep-header">
      <div className="ep-util">
        <div className="ep-wrap ep-util-in">
          <span>
            <Zap size={13} aria-hidden="true" /> Material técnico para obra e instalação
          </span>
          {tenant.whatsapp && (
            <a href={waLink(tenant, "Olá! Preciso de um orçamento.")} target="_blank" rel="noreferrer">
              <Phone size={13} aria-hidden="true" /> Orçamento pelo WhatsApp
            </a>
          )}
        </div>
      </div>
      <div className="ep-main">
        <div className="ep-wrap ep-main-in">
          <button type="button" className="ep-icon ep-burger" aria-label="Abrir menu" aria-expanded={open} onClick={() => setOpen(true)}>
            <Menu size={22} />
          </button>
          <Link to={path()} className="ep-brand">
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt="" />
            ) : (
              <span className="ep-brand-mark">
                <Zap size={20} />
              </span>
            )}
            <span className="ep-brand-name">{tenant.name}</span>
          </Link>
          <form onSubmit={submit} className="ep-search" role="search">
            <SearchBar value={query} onChange={setQuery} placeholder="Busque por nome ou código do material" />
            <button type="submit" className="ep-search-go">
              Buscar
            </button>
          </form>
          <div className="ep-actions">
            <Link to={path("/catalogo")} className="ep-icon ep-fav" aria-label={`Favoritos: ${wishlist.length}`}>
              <Heart size={20} />
              {wishlist.length > 0 && <b>{wishlist.length}</b>}
            </Link>
            <button type="button" className="ep-cart" aria-label={`Abrir carrinho, ${count} itens`} onClick={openCart}>
              <ShoppingCart size={20} />
              <span className="ep-cart-txt">Carrinho</span>
              <b>{count}</b>
            </button>
          </div>
        </div>
      </div>
      <nav className="ep-cats" aria-label="Categorias">
        <div className="ep-wrap ep-cats-in">
          <Link to={path("/catalogo")} className="ep-cats-all">
            Todos os materiais
          </Link>
          {cats.map((c) => (
            <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>
              {c.name}
            </Link>
          ))}
          <Link to={path("/sobre")} className="ep-cats-end">
            Sobre
          </Link>
        </div>
      </nav>

      {open && (
        <div className="ep-drawer" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="ep-drawer-bg" aria-label="Fechar menu" onClick={() => setOpen(false)} />
          <div className="ep-drawer-panel">
            <div className="ep-drawer-top">
              <strong>Menu</strong>
              <button type="button" className="ep-icon" aria-label="Fechar menu" onClick={() => setOpen(false)}>
                <X size={22} />
              </button>
            </div>
            <form onSubmit={submit} className="ep-search ep-search-m" role="search">
              <SearchBar value={query} onChange={setQuery} placeholder="Nome ou código" />
            </form>
            <div className="ep-drawer-links">
              {links.map((l) => (
                <Link key={l.name} to={l.to}>
                  {l.name}
                </Link>
              ))}
            </div>
            {cats.length > 0 && <p className="ep-drawer-h">Por tipo de material</p>}
            <div className="ep-drawer-links ep-drawer-cats">
              {cats.map((c) => (
                <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant, categories, products } = useStore();
  const { path } = useTheme();
  const hours = hoursRows(tenant);
  const cats = categories.filter((c) => products.some((p) => p.is_active && p.category_id === c.id)).slice(0, 6);
  return (
    <footer className="ep-footer">
      <div className="ep-hazard" aria-hidden="true" />
      <div className="ep-wrap ep-foot-grid">
        <div>
          <p className="ep-foot-brand">{tenant.name}</p>
          <p className="ep-foot-txt">
            {tenant.footer_text || tenant.about_text || "Materiais e atendimento técnico para a sua obra, reforma ou instalação."}
          </p>
          <div className="ep-foot-social">
            {tenant.instagram_url && (
              <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram">
                <Instagram size={18} />
              </a>
            )}
            {tenant.facebook_url && (
              <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook">
                <Facebook size={18} />
              </a>
            )}
          </div>
        </div>
        <div>
          <h3>Materiais</h3>
          {cats.map((c) => (
            <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>
              {c.name}
            </Link>
          ))}
          <Link to={path("/catalogo")}>Ver tudo</Link>
        </div>
        <div>
          <h3>Atendimento</h3>
          <Link to={path("/sobre")}>Sobre a loja</Link>
          {tenant.whatsapp && (
            <a href={waLink(tenant)} target="_blank" rel="noreferrer">
              WhatsApp: {tenant.whatsapp}
            </a>
          )}
          {tenant.show_address && tenant.address && <p>{tenant.address}</p>}
        </div>
        <div>
          <h3>
            <Clock size={14} aria-hidden="true" /> Horários
          </h3>
          {hours.length ? (
            hours.map((h) => (
              <p key={h.day} className="ep-foot-hour">
                <span>{h.day}</span>
                <span>{h.text}</span>
              </p>
            ))
          ) : (
            <p>Consulte o horário pelo WhatsApp.</p>
          )}
        </div>
      </div>
      <div className="ep-foot-bottom">
        <div className="ep-wrap">
          <span>
            © {new Date().getFullYear()} {tenant.name}
          </span>
          <span>Desenvolvido por BoxSys</span>
        </div>
      </div>
    </footer>
  );
}
