import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Clock, Instagram, Facebook, MapPin, Menu, MessageCircle, ShoppingBag, Sparkles, X } from "lucide-react";
import { hoursLines, productImage, useKit, whatsappLink } from "./kit";
import { SearchField } from "./ThemeParts";
import "./styles.css";

export function Header() {
  const { tenant, categories, active, openCart, cartCount, path } = useKit();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [mega, setMega] = useState(false);
  const [term, setTerm] = useState("");
  const used = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 8);
  const links = [
    { name: "Início", to: path(), on: !/catalogo|sobre|produto/.test(pathname) },
    { name: "Produtos", to: path("/catalogo"), on: /catalogo|produto/.test(pathname) },
    { name: "Nossa loja", to: path("/sobre"), on: /sobre/.test(pathname) },
  ];

  useEffect(() => {
    setMenu(false);
    setMega(false);
  }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        setMega(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setMenu(false);
    navigate(path(`/catalogo${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ""}`));
  };

  return (
    <header className="bty-header">
      <div className="bty-bar">
        <nav className="bty-nav" aria-label="Principal">
          {links.map((l) => (
            <Link key={l.to} to={l.to} aria-current={l.on ? "page" : undefined}>{l.name}</Link>
          ))}
          {used.length > 0 && (
            <button type="button" className="bty-nav-btn" aria-expanded={mega} aria-controls="bty-mega" onClick={() => setMega((v) => !v)}>
              Rituais <ChevronDown size={15} aria-hidden="true" />
            </button>
          )}
        </nav>
        <button type="button" className="bty-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          {menu ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Link className="bty-brand" to={path()} aria-label={`${tenant.name} - página inicial`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="bty-brand-mark"><Sparkles size={18} /></span>}
          <span>{tenant.name}</span>
        </Link>
        <div className="bty-tools">
          <form className="bty-search" role="search" onSubmit={submit}>
            <SearchField value={term} onChange={setTerm} placeholder="Buscar cuidados" />
          </form>
          <button type="button" className="bty-cart" aria-label={`Abrir sacola, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`} onClick={openCart}>
            <ShoppingBag size={20} />
            <b>{cartCount}</b>
          </button>
        </div>
      </div>

      {mega && (
        <>
          <button type="button" className="bty-scrim" aria-label="Fechar categorias" onClick={() => setMega(false)} />
          <div id="bty-mega" className="bty-mega">
            <p className="bty-mega-title">Escolha o seu ritual</p>
            <div className="bty-mega-grid">
              {used.map((c) => {
                const img = c.cover_url || productImage(active.find((p) => p.category_id === c.id));
                return (
                  <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>
                    <span className="bty-mega-arch">{img ? <img src={img} alt="" loading="lazy" /> : <Sparkles size={22} />}</span>
                    <span>{c.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}

      {menu && (
        <div className="bty-drawer">
          <form role="search" onSubmit={submit}>
            <SearchField value={term} onChange={setTerm} placeholder="Buscar cuidados" />
          </form>
          <nav aria-label="Menu">
            {links.map((l) => (
              <Link key={l.to} to={l.to} aria-current={l.on ? "page" : undefined}>{l.name}</Link>
            ))}
          </nav>
          {used.length > 0 && (
            <>
              <p className="bty-drawer-title">Rituais</p>
              <div className="bty-drawer-chips">
                {used.map((c) => (
                  <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>{c.name}</Link>
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
    <footer className="bty-footer">
      <div className="bty-footer-inner">
        <section className="bty-foot-card bty-foot-about">
          <Link className="bty-brand" to={path()}>
            {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="bty-brand-mark"><Sparkles size={18} /></span>}
            <span>{tenant.name}</span>
          </Link>
          <p>{tenant.footer_text || tenant.about_text || "Uma curadoria de beleza para acompanhar a sua rotina de autocuidado."}</p>
          <div className="bty-social">
            {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={19} /></a>}
            {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={19} /></a>}
            {wa && <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={19} /></a>}
          </div>
        </section>
        <section className="bty-foot-card">
          <h2>Descubra</h2>
          <Link to={path()}>Início</Link>
          <Link to={path("/catalogo")}>Todos os produtos</Link>
          <Link to={path("/sobre")}>Nossa loja</Link>
        </section>
        {cats.length > 0 && (
          <section className="bty-foot-card">
            <h2>Rituais</h2>
            {cats.map((c) => (
              <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>{c.name}</Link>
            ))}
          </section>
        )}
        <section className="bty-foot-card">
          <h2>Atendimento</h2>
          {wa && <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={15} /> {tenant.whatsapp}</a>}
          {tenant.show_address && tenant.address && <p><MapPin size={15} /> {tenant.address}</p>}
          {hours.slice(0, 7).map((h) => (
            <p key={h.day} className="bty-hour"><Clock size={14} /> <span>{h.day}</span> {h.text}</p>
          ))}
        </section>
      </div>
      <p className="bty-credit">
        © {new Date().getFullYear()} {tenant.name} · Desenvolvido por <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a>
      </p>
    </footer>
  );
}
