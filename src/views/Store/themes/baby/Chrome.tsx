import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Facebook, Instagram, Menu, MessageCircle, ShoppingBag, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { hoursLines, useKit, whatsappLink } from "./kit";
import { Balloon, Cloud, Star, Wave } from "./parts";
import "./styles.css";

export function Header() {
  const { tenant, categories, openCart, cartCount, path, sf, active } = useKit();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [term, setTerm] = useState("");
  const nav = [
    { name: "Início", to: path(), match: (p: string) => !/catalogo|sobre|produto/.test(p) },
    { name: "Catálogo", to: path("/catalogo"), match: (p: string) => p.includes("/catalogo") || p.includes("/produto") },
    { name: "Nossa loja", to: path("/sobre"), match: (p: string) => p.includes("/sobre") },
  ];
  const usedCategories = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 8);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setMenu(false);
    navigate(path(`/catalogo${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ""}`));
  };
  return (
    <header className="bb-header">
      <div className="bb-topstrip">
        <Star className="bb-strip-star" />
        <span>{sf.segment_label || "Bebês & Enxoval"}</span>
        <Star className="bb-strip-star" />
      </div>
      <div className="bb-header-main">
        <button className="bb-icon-btn bb-menu-btn" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          {menu ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav className="bb-nav bb-nav-left" aria-label="Principal">
          {nav.map((l) => (
            <Link key={l.to} to={l.to} aria-current={l.match(pathname) ? "page" : undefined}>
              {l.name}
            </Link>
          ))}
        </nav>
        <Link className="bb-brand" to={path()}>
          <Cloud className="bb-brand-cloud" />
          <span className="bb-brand-inner">
            {tenant.logo_url && <img src={tenant.logo_url} alt="" />}
            <span className="bb-brand-name">{tenant.name}</span>
          </span>
        </Link>
        <form className="bb-search bb-nav-right" role="search" onSubmit={submit}>
          <SearchBar value={term} onChange={setTerm} placeholder="Buscar mimos..." />
        </form>
        <button className="bb-cart-btn" aria-label={`Abrir sacola, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`} onClick={openCart}>
          <Balloon className="bb-cart-balloon" />
          <ShoppingBag size={18} />
          <span className="bb-cart-count">{cartCount}</span>
        </button>
      </div>
      {menu && (
        <div className="bb-drawer">
          <form className="bb-search" role="search" onSubmit={submit}>
            <SearchBar value={term} onChange={setTerm} placeholder="Buscar mimos..." />
          </form>
          <nav aria-label="Menu">
            {nav.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setMenu(false)}>
                {l.name}
              </Link>
            ))}
          </nav>
          {usedCategories.length > 0 && (
            <>
              <p className="bb-drawer-title">Cada fase, um carinho</p>
              <div className="bb-drawer-bubbles">
                {usedCategories.map((c, i) => (
                  <Link key={c.id} className={`bb-chip bb-t${(i % 4) + 1}`} to={path(`/catalogo?cat=${c.id}`)} onClick={() => setMenu(false)}>
                    {c.name}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      <Wave className="bb-header-wave" />
    </header>
  );
}

export function Footer() {
  const { tenant, categories, path, active } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = whatsappLink(tenant.whatsapp);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 6);
  return (
    <footer className="bb-footer">
      <Wave className="bb-footer-wave" flip />
      <div className="bb-footer-inner">
        <section className="bb-foot-card bb-t1 bb-foot-about">
          <Cloud className="bb-foot-cloud" />
          <h2>{tenant.name}</h2>
          <p>{tenant.footer_text || tenant.about_text || tenant.hero_tagline || "Enxoval, presentes e cuidado em cada detalhe da infância."}</p>
          <div className="bb-socials">
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" aria-label="Conversar pelo WhatsApp">
                <MessageCircle size={20} />
              </a>
            )}
            {tenant.instagram_url && (
              <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram">
                <Instagram size={20} />
              </a>
            )}
            {tenant.facebook_url && (
              <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook">
                <Facebook size={20} />
              </a>
            )}
          </div>
        </section>
        <section className="bb-foot-card bb-t2">
          <h3>Passeie por aqui</h3>
          <Link to={path()}>Início</Link>
          <Link to={path("/catalogo")}>Catálogo</Link>
          <Link to={path("/sobre")}>Nossa loja</Link>
          {cats.map((c) => (
            <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>
              {c.name}
            </Link>
          ))}
        </section>
        <section className="bb-foot-card bb-t3">
          <h3>Visite e fale com a gente</h3>
          {tenant.show_address && tenant.address && <p>{tenant.address}</p>}
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer">
              WhatsApp: {tenant.whatsapp}
            </a>
          )}
          {hours.length > 0 && (
            <dl className="bb-hours">
              {hours.map((h) => (
                <div key={h.day}>
                  <dt>{h.day}</dt>
                  <dd>{h.text}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>
      <p className="bb-credit">
        © {new Date().getFullYear()} {tenant.name} · Powered by{" "}
        <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">
          BoxSys
        </a>
      </p>
    </footer>
  );
}
