import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, Clock, Facebook, Heart, Instagram, MapPin, Menu, MessageCircle, Search, ShoppingBag, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { useStore } from "../../StoreLayout";
import { hoursRows, useTheme, waLink } from "./lib";
import "./styles.css";

export function Header() {
  const { tenant, categories, products, cart, openCart, wishlist } = useStore();
  const { path } = useTheme();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  const cats = categories.filter((c) => products.some((p) => p.is_active && p.category_id === c.id));
  const current = pathname.replace(/\/$/, "");

  useEffect(() => {
    setMenu(false);
    setSearch(false);
  }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = menu ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menu]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate(path(`/catalogo?q=${encodeURIComponent(q)}`));
    setQuery("");
    setSearch(false);
    setMenu(false);
  };
  const links = [
    { name: "Início", to: path(), match: "" },
    { name: "Catálogo", to: path("/catalogo"), match: "/catalogo" },
    { name: "Sobre", to: path("/sobre"), match: "/sobre" },
  ];
  const active = (m: string) => (m === "" ? !/\/(catalogo|sobre|produto)/.test(current) : current.includes(m));

  return (
    <header className="nx-header">
      <div className="nx-top">
        <div className="nx-wrap nx-top-in">
          <span>{tenant.hero_tagline ? tenant.hero_tagline : "Showroom online · tecnologia selecionada"}</span>
          {tenant.whatsapp && (
            <a href={waLink(tenant, "Olá! Gostaria de atendimento.")} target="_blank" rel="noreferrer">
              <MessageCircle size={13} aria-hidden="true" /> Atendimento especializado
            </a>
          )}
        </div>
      </div>
      <div className="nx-bar">
        <div className="nx-wrap nx-bar-in">
          <button type="button" className="nx-ico nx-burger" aria-label="Abrir menu" aria-expanded={menu} onClick={() => setMenu(true)}>
            <Menu size={22} />
          </button>
          <Link to={path()} className="nx-brand">
            {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="nx-brand-dot" aria-hidden="true" />}
            <span>{tenant.name}</span>
          </Link>
          <nav className="nx-nav" aria-label="Principal">
            {links.map((l) => (
              <Link key={l.name} to={l.to} aria-current={active(l.match) ? "page" : undefined}>
                {l.name}
              </Link>
            ))}
            {cats.slice(0, 3).map((c) => (
              <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className="nx-nav-cat">
                {c.name}
              </Link>
            ))}
          </nav>
          <div className="nx-tools">
            <button type="button" className="nx-ico" aria-label="Buscar produtos" aria-expanded={search} onClick={() => setSearch((v) => !v)}>
              {search ? <X size={20} /> : <Search size={20} />}
            </button>
            <Link to={path("/catalogo")} className="nx-ico nx-fav" aria-label={`Favoritos: ${wishlist.length}`}>
              <Heart size={20} />
              {wishlist.length > 0 && <b>{wishlist.length}</b>}
            </Link>
            <button type="button" className="nx-bag" aria-label={`Abrir carrinho, ${count} itens`} onClick={openCart}>
              <ShoppingBag size={19} />
              <span>Carrinho</span>
              <b>{count}</b>
            </button>
          </div>
        </div>
        {search && (
          <form className="nx-searchpanel" onSubmit={submit} role="search">
            <div className="nx-wrap nx-searchpanel-in">
              <SearchBar value={query} onChange={setQuery} placeholder="O que você procura?" className="nx-sb" />
              <button type="submit" className="nx-btn">Buscar</button>
            </div>
          </form>
        )}
      </div>

      {menu && (
        <div className="nx-sheet" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="nx-sheet-top">
            <span className="nx-brand"><span>{tenant.name}</span></span>
            <button type="button" className="nx-ico" aria-label="Fechar menu" onClick={() => setMenu(false)}>
              <X size={24} />
            </button>
          </div>
          <form onSubmit={submit} role="search" className="nx-sheet-search">
            <SearchBar value={query} onChange={setQuery} placeholder="Buscar produtos" className="nx-sb" />
          </form>
          <nav className="nx-sheet-links">
            {links.map((l) => (
              <Link key={l.name} to={l.to}>
                {l.name} <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            ))}
          </nav>
          {cats.length > 0 && <p className="nx-sheet-h">Categorias</p>}
          <div className="nx-sheet-cats">
            {cats.map((c) => (
              <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>
                {c.name}
              </Link>
            ))}
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
    <footer className="nx-footer">
      <div className="nx-wrap nx-foot-hero">
        <div>
          <p className="nx-foot-kicker">{tenant.name}</p>
          <h2>{tenant.hero_tagline || "Tecnologia escolhida com cuidado, do catálogo à sua casa."}</h2>
        </div>
        <Link to={path("/catalogo")} className="nx-btn nx-btn-gold">
          Explorar catálogo <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </div>
      <div className="nx-wrap nx-foot-grid">
        <div>
          <h3>A loja</h3>
          <p>{tenant.footer_text || tenant.about_text || "Produtos selecionados, atendimento próximo e compra segura."}</p>
          <div className="nx-foot-social">
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
          <h3>Categorias</h3>
          {cats.map((c) => (
            <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>
              {c.name}
            </Link>
          ))}
          <Link to={path("/catalogo")}>Ver tudo</Link>
        </div>
        <div>
          <h3>Contato</h3>
          <Link to={path("/sobre")}>Sobre a loja</Link>
          {tenant.whatsapp && (
            <a href={waLink(tenant)} target="_blank" rel="noreferrer">
              <MessageCircle size={14} aria-hidden="true" /> {tenant.whatsapp}
            </a>
          )}
          {tenant.show_address && tenant.address && (
            <p className="nx-foot-addr">
              <MapPin size={14} aria-hidden="true" /> {tenant.address}
            </p>
          )}
        </div>
        <div>
          <h3>
            <Clock size={13} aria-hidden="true" /> Horários
          </h3>
          {hours.length ? (
            hours.map((h) => (
              <p key={h.day} className="nx-foot-hour">
                <span>{h.day}</span>
                <span>{h.text}</span>
              </p>
            ))
          ) : (
            <p>Consulte nossos horários pelo WhatsApp.</p>
          )}
        </div>
      </div>
      <div className="nx-foot-bottom">
        <div className="nx-wrap">
          <span>
            © {new Date().getFullYear()} {tenant.name}
          </span>
          <span>Desenvolvido por BoxSys</span>
        </div>
      </div>
    </footer>
  );
}
