import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Clock, Coffee, Facebook, Instagram, MapPin, Menu, MessageCircle, Search, ShoppingBag, X } from "lucide-react";
import { hoursLines, useKit, whatsappLink } from "./kit";
import "./styles.css";

function Brand({ foot = false }: { foot?: boolean }) {
  const { tenant, path } = useKit();
  return (
    <Link className={`cf-brand ${foot ? "cf-brand-foot" : ""}`} to={path()} aria-label={`${tenant.name} - página inicial`}>
      {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <Coffee size={26} aria-hidden="true" />}
      <span>{tenant.name}</span>
    </Link>
  );
}

export function Header() {
  const { categories, active, openCart, cartCount, path } = useKit();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [mega, setMega] = useState(false);
  const [term, setTerm] = useState("");
  const used = categories
    .map((c) => ({ ...c, total: active.filter((p) => p.category_id === c.id).length }))
    .filter((c) => c.total > 0)
    .slice(0, 12);
  const close = () => {
    setMenu(false);
    setMega(false);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    close();
    navigate(path(`/catalogo${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ""}`));
  };
  return (
    <header className="cf-header">
      <div className="cf-bar">
        <Brand />
        <nav className="cf-nav" aria-label="Principal">
          <Link to={path()} aria-current={!/catalogo|sobre|produto/.test(pathname) ? "page" : undefined}>
            Início
          </Link>
          <button type="button" aria-expanded={mega} aria-controls="cf-mega" onClick={() => setMega((v) => !v)}>
            Cardápio <ChevronDown size={16} aria-hidden="true" />
          </button>
          <Link to={path("/sobre")} aria-current={/sobre/.test(pathname) ? "page" : undefined}>
            Nossa casa
          </Link>
        </nav>
        <form className="cf-search" role="search" onSubmit={submit}>
          <Search size={18} aria-hidden="true" />
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="O que você quer hoje?" aria-label="Buscar no cardápio" />
        </form>
        <button type="button" className="cf-cart" aria-label={`Abrir sacola, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`} onClick={openCart}>
          <ShoppingBag size={21} />
          <span>{cartCount}</span>
        </button>
        <button type="button" className="cf-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          {menu ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      {mega && (
        <div id="cf-mega" className="cf-mega">
          <div className="cf-mega-inner">
            <p>O cardápio por seção</p>
            <div className="cf-mega-grid">
              <Link to={path("/catalogo")} onClick={close}>
                <strong>Tudo</strong>
                <span>{active.length} itens</span>
              </Link>
              {used.map((c) => (
                <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)} onClick={close}>
                  <strong>{c.name}</strong>
                  <span>{c.total} {c.total === 1 ? "item" : "itens"}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
      {menu && (
        <div className="cf-drawer">
          <form className="cf-search" role="search" onSubmit={submit}>
            <Search size={18} aria-hidden="true" />
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="O que você quer hoje?" aria-label="Buscar no cardápio" />
          </form>
          <nav aria-label="Menu">
            <Link to={path()} onClick={close}>
              Início
            </Link>
            <Link to={path("/catalogo")} onClick={close}>
              Todo o cardápio
            </Link>
            <Link to={path("/sobre")} onClick={close}>
              Nossa casa
            </Link>
          </nav>
          {used.length > 0 && (
            <>
              <p className="cf-drawer-title">Seções do cardápio</p>
              <div className="cf-drawer-grid">
                {used.map((c) => (
                  <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)} onClick={close}>
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
    <footer className="cf-footer">
      <div className="cf-footer-inner">
        <section className="cf-foot-card cf-foot-about">
          <Brand foot />
          <p>{tenant.footer_text || tenant.about_text || "Sabores feitos com calma, para você aproveitar sem pressa."}</p>
          <div className="cf-social">
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
        <section className="cf-foot-card">
          <h2>Cardápio</h2>
          <Link to={path("/catalogo")}>Ver tudo</Link>
          {cats.map((c) => (
            <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>
              {c.name}
            </Link>
          ))}
        </section>
        <section className="cf-foot-card">
          <h2>Visite a gente</h2>
          {tenant.show_address && tenant.address && (
            <p>
              <MapPin size={16} /> {tenant.address}
            </p>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer">
              <MessageCircle size={16} /> {tenant.whatsapp}
            </a>
          )}
          {hours.length > 0 && (
            <dl className="cf-hours">
              <dt className="cf-hours-title">
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
      <p className="cf-credit">
        © {new Date().getFullYear()} {tenant.name} · Desenvolvido por{" "}
        <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">
          BoxSys
        </a>
      </p>
    </footer>
  );
}
