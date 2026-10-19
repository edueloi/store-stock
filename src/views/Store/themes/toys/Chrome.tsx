import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Clock, Facebook, Instagram, MapPin, Menu, MessageCircle, ShoppingBag, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { hoursLines, useKit, whatsappLink } from "./kit";
import { Brick } from "./parts";
import "./styles.css";

export function Header() {
  const { tenant, categories, active, openCart, cartCount, path } = useKit();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [term, setTerm] = useState("");
  const nav = [
    { name: "Início", to: path(), on: !/catalogo|sobre|produto/.test(pathname) },
    { name: "Brinquedos", to: path("/catalogo"), on: /catalogo|produto/.test(pathname) },
    { name: "Nossa loja", to: path("/sobre"), on: /sobre/.test(pathname) },
  ];
  const used = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 10);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setMenu(false);
    navigate(path(`/catalogo${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ""}`));
  };
  return (
    <header className="toys-header">
      <div className="toys-bar">
        <Link className="toys-brand" to={path()} aria-label={`${tenant.name} - página inicial`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <Brick />}
          <span>{tenant.name}</span>
        </Link>
        <nav className="toys-nav" aria-label="Principal">
          {nav.map((l) => (
            <Link key={l.to} to={l.to} aria-current={l.on ? "page" : undefined}>
              {l.name}
            </Link>
          ))}
        </nav>
        <form className="toys-search" role="search" onSubmit={submit}>
          <SearchBar value={term} onChange={setTerm} placeholder="Buscar brinquedo" />
        </form>
        <button type="button" className="toys-cart" aria-label={`Abrir sacola, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`} onClick={openCart}>
          <ShoppingBag size={22} />
          <span className="toys-cart-count">{cartCount}</span>
        </button>
        <button type="button" className="toys-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          {menu ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      {used.length > 0 && (
        <nav className="toys-rail" aria-label="Categorias">
          {used.map((c, i) => (
            <Link key={c.id} className={`toys-rail-chip toys-tint-${i % 4}`} to={path(`/catalogo?categoria=${c.id}`)}>
              {c.name}
            </Link>
          ))}
        </nav>
      )}
      {menu && (
        <div className="toys-drawer">
          <form className="toys-search" role="search" onSubmit={submit}>
            <SearchBar value={term} onChange={setTerm} placeholder="Buscar brinquedo" />
          </form>
          <nav aria-label="Menu">
            {nav.map((l, i) => (
              <Link key={l.to} className={`toys-tint-${i % 4}`} to={l.to} aria-current={l.on ? "page" : undefined} onClick={() => setMenu(false)}>
                {l.name}
              </Link>
            ))}
          </nav>
          {used.length > 0 && (
            <>
              <p className="toys-drawer-title">Escolha por categoria</p>
              <div className="toys-drawer-chips">
                {used.map((c, i) => (
                  <Link key={c.id} className={`toys-rail-chip toys-tint-${(i + 1) % 4}`} to={path(`/catalogo?categoria=${c.id}`)} onClick={() => setMenu(false)}>
                    {c.name}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant, categories, active, path } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 6);
  return (
    <footer className="toys-footer">
      <div className="toys-footer-inner">
        <section className="toys-foot-card toys-foot-about">
          <Link className="toys-brand toys-brand-foot" to={path()}>
            {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <Brick />}
            <span>{tenant.name}</span>
          </Link>
          <p>{tenant.footer_text || tenant.about_text || "Brinquedos para imaginar, montar e se divertir."}</p>
          <div className="toys-social">
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
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp">
                <MessageCircle size={20} />
              </a>
            )}
          </div>
        </section>
        <section className="toys-foot-card">
          <h2>Para brincar</h2>
          <Link to={path("/catalogo")}>Todos os brinquedos</Link>
          {cats.map((c) => (
            <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>
              {c.name}
            </Link>
          ))}
          <Link to={path("/sobre")}>Nossa loja</Link>
        </section>
        <section className="toys-foot-card">
          <h2>Fale com a gente</h2>
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer">
              <MessageCircle size={16} /> {tenant.whatsapp}
            </a>
          )}
          {tenant.show_address && tenant.address && (
            <p>
              <MapPin size={16} /> {tenant.address}
            </p>
          )}
          {hours.length > 0 && (
            <dl className="toys-hours">
              <dt className="toys-hours-title">
                <Clock size={15} /> Horários
              </dt>
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
      <p className="toys-credit">
        © {new Date().getFullYear()} {tenant.name} · Desenvolvido por{" "}
        <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">
          BoxSys
        </a>
      </p>
    </footer>
  );
}
