import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Clock, Facebook, Instagram, MapPin, Menu, MessageCircle, Search, ShoppingBag, X } from "lucide-react";
import { categoryImage, hoursRows, useKit, useUsedCategories } from "./kit";
import "./styles.css";

function Logo({ className = "" }: { className?: string }) {
  const { tenant, path } = useKit();
  return (
    <Link to={path()} className={`hm-brand ${className}`} aria-label={`${tenant.name} - página inicial`}>
      {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="hm-brand-mark" aria-hidden="true">{tenant.name.slice(0, 1)}</span>}
      <span className="hm-brand-name">{tenant.name}</span>
    </Link>
  );
}

export function Header() {
  const { cartCount, openCart, path, active } = useKit();
  const rooms = useUsedCategories();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [mega, setMega] = useState(false);
  const [query, setQuery] = useState("");
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenu(false);
    setMega(false);
  }, [pathname, search]);
  useEffect(() => {
    if (!mega) return;
    const close = (e: MouseEvent) => {
      if (holder.current && !holder.current.contains(e.target as Node)) setMega(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMega(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [mega]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(path(q ? `/catalogo?q=${encodeURIComponent(q)}` : "/catalogo"));
  };
  const cur = (to: string): "page" | undefined => (pathname === to.split("?")[0] ? "page" : undefined);

  return (
    <div className="hm-header" role="banner" ref={holder}>
      <div className="hm-bar">
        <Logo />
        <nav className="hm-nav" aria-label="Principal">
          <Link to={path()} aria-current={cur(path())}>Início</Link>
          {rooms.length > 0 && (
            <button type="button" className="hm-nav-btn" aria-expanded={mega} aria-controls="hm-mega" onClick={() => setMega((v) => !v)}>
              Cômodos <ChevronDown size={16} aria-hidden="true" />
            </button>
          )}
          <Link to={path("/catalogo")} aria-current={cur(path("/catalogo"))}>Catálogo</Link>
          <Link to={path("/sobre")} aria-current={cur(path("/sobre"))}>Sobre</Link>
        </nav>
        <form className="hm-search" role="search" onSubmit={submit}>
          <Search size={17} aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar para sua casa" aria-label="Buscar produtos" />
        </form>
        <button type="button" className="hm-cart" onClick={openCart} aria-label={`Abrir carrinho, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`}>
          <ShoppingBag size={20} />
          <span className="hm-cart-count">{cartCount}</span>
        </button>
        <button type="button" className="hm-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          {menu ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mega && rooms.length > 0 && (
        <div className="hm-mega" id="hm-mega">
          <div className="hm-mega-in">
            {rooms.slice(0, 8).map((c) => {
              const img = categoryImage(c, active);
              return (
                <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)} className="hm-mega-item">
                  <span className="hm-mega-img">{img && <img src={img} alt="" loading="lazy" />}</span>
                  <span>
                    <strong>{c.name}</strong>
                    <small>{c.count} {c.count === 1 ? "peça" : "peças"}</small>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {menu && (
        <div className="hm-drawer" role="dialog" aria-label="Menu">
          <form className="hm-search" role="search" onSubmit={submit}>
            <Search size={17} aria-hidden="true" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar para sua casa" aria-label="Buscar produtos" />
          </form>
          <nav aria-label="Menu" className="hm-drawer-links">
            <Link to={path()}>Início</Link>
            <Link to={path("/catalogo")}>Catálogo</Link>
            <Link to={path("/sobre")}>Sobre</Link>
          </nav>
          {rooms.length > 0 && (
            <>
              <p className="hm-drawer-title">Cômodos</p>
              <div className="hm-drawer-rooms">
                {rooms.slice(0, 12).map((c) => (
                  <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>{c.name}</Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function Footer() {
  const { tenant, path, waLink } = useKit();
  const rooms = useUsedCategories();
  const hours = hoursRows(tenant);
  const wa = waLink(`Olá! Vim pela loja ${tenant.name}.`);
  return (
    <div className="hm-footer" role="contentinfo">
      <div className="hm-foot-grid">
        <section className="hm-foot-card hm-foot-about">
          <Logo />
          <p>{tenant.footer_text || tenant.about_text || "Peças escolhidas para deixar cada cômodo mais aconchegante."}</p>
          <div className="hm-social">
            {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={19} /></a>}
            {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={19} /></a>}
            {wa && <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={19} /></a>}
          </div>
        </section>
        <section className="hm-foot-card">
          <h2>Cômodos</h2>
          {rooms.slice(0, 6).map((c) => (
            <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>{c.name}</Link>
          ))}
          <Link to={path("/catalogo")}>Ver tudo</Link>
        </section>
        <section className="hm-foot-card">
          <h2>Fale com a gente</h2>
          {wa && <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={16} /> {tenant.whatsapp}</a>}
          {tenant.show_address && tenant.address && <p><MapPin size={16} /> {tenant.address}</p>}
          <Link to={path("/sobre")}>Sobre a loja</Link>
        </section>
        {hours.length > 0 && (
          <section className="hm-foot-card">
            <h2><Clock size={14} /> Horários</h2>
            <ul className="hm-hours">
              {hours.map((h) => (
                <li key={h.day}><span>{h.day}</span> {h.text}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <p className="hm-credit">
        © {new Date().getFullYear()} {tenant.name} · Desenvolvido por{" "}
        <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a>
      </p>
    </div>
  );
}
