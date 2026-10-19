import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Clock, Facebook, Gem, Instagram, MapPin, Menu, MessageCircle, Search, ShoppingBag, X } from "lucide-react";
import { hoursLines, useKit, whatsappLink } from "./kit";
import { SearchField } from "./parts";
import "./styles.css";

export function Header() {
  const { tenant, categories, active, openCart, cartCount, path } = useKit();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [mega, setMega] = useState(false);
  const [find, setFind] = useState(false);
  const [term, setTerm] = useState("");
  const used = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 9);
  const links = [
    { name: "Início", to: path(), on: !/catalogo|sobre|produto/.test(pathname) },
    { name: "Coleção", to: path("/catalogo"), on: /catalogo|produto/.test(pathname) },
    { name: "Maison", to: path("/sobre"), on: /sobre/.test(pathname) },
  ];
  useEffect(() => {
    setMenu(false);
    setMega(false);
    setFind(false);
  }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        setMega(false);
        setFind(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setMenu(false);
    setFind(false);
    navigate(path(`/catalogo${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ""}`));
  };
  return (
    <header className="lux-header">
      <div className="lux-pill">
        <button type="button" className="lux-icon lux-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          {menu ? <X size={21} /> : <Menu size={21} />}
        </button>
        <nav className="lux-nav" aria-label="Principal">
          {links.map((l) => (
            <Link key={l.to} to={l.to} aria-current={l.on ? "page" : undefined}>{l.name}</Link>
          ))}
          {used.length > 0 && (
            <button type="button" className="lux-nav-btn" aria-expanded={mega} aria-controls="lux-mega" onClick={() => { setMega((v) => !v); setFind(false); }}>
              Coleções <ChevronDown size={14} aria-hidden="true" />
            </button>
          )}
        </nav>
        <Link className="lux-brand" to={path()} aria-label={`${tenant.name} - página inicial`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <Gem size={18} aria-hidden="true" />}
          <span>{tenant.name}</span>
        </Link>
        <div className="lux-tools">
          <button type="button" className="lux-icon" aria-label="Buscar" aria-expanded={find} onClick={() => { setFind((v) => !v); setMega(false); }}>
            <Search size={19} />
          </button>
          <button type="button" className="lux-icon lux-cart" aria-label={`Abrir sacola, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`} onClick={openCart}>
            <ShoppingBag size={19} />
            <b>{cartCount}</b>
          </button>
        </div>
      </div>

      {find && (
        <form className="lux-panel lux-find" role="search" onSubmit={submit}>
          <SearchField value={term} onChange={setTerm} placeholder="O que você procura?" label="Buscar na coleção" autoFocus />
          <button type="submit" className="lux-find-go">Buscar</button>
        </form>
      )}

      {mega && (
        <>
          <button type="button" className="lux-scrim" aria-label="Fechar coleções" onClick={() => setMega(false)} />
          <div id="lux-mega" className="lux-panel lux-mega">
            <p className="lux-mega-title">Coleções</p>
            <ol>
              {used.map((c, i) => (
                <li key={c.id}>
                  <Link to={path(`/catalogo?categoria=${c.id}`)}><span>{String(i + 1).padStart(2, "0")}</span>{c.name}</Link>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}

      {menu && (
        <div className="lux-panel lux-drawer">
          <form role="search" onSubmit={submit}>
            <SearchField value={term} onChange={setTerm} placeholder="O que você procura?" />
          </form>
          <nav aria-label="Menu">
            {links.map((l) => (
              <Link key={l.to} to={l.to} aria-current={l.on ? "page" : undefined}>{l.name}</Link>
            ))}
          </nav>
          {used.length > 0 && (
            <>
              <p className="lux-drawer-title">Coleções</p>
              <div className="lux-drawer-chips">
                {used.map((c) => <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>{c.name}</Link>)}
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
    <footer className="lux-footer">
      <div className="lux-footer-box">
        <p className="lux-footer-mark">{tenant.name}</p>
        <div className="lux-footer-grid">
          <section className="lux-foot-col lux-foot-about">
            <p>{tenant.footer_text || tenant.about_text || "Peças selecionadas com o cuidado que cada detalhe merece."}</p>
            <div className="lux-social">
              {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>}
              {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={18} /></a>}
              {wa && <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={18} /></a>}
            </div>
          </section>
          <section className="lux-foot-col">
            <h2>Explore</h2>
            <Link to={path()}>Início</Link>
            <Link to={path("/catalogo")}>Toda a coleção</Link>
            <Link to={path("/sobre")}>Maison</Link>
          </section>
          {cats.length > 0 && (
            <section className="lux-foot-col">
              <h2>Coleções</h2>
              {cats.map((c) => <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>{c.name}</Link>)}
            </section>
          )}
          <section className="lux-foot-col">
            <h2>Atendimento</h2>
            {wa && <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={15} /> {tenant.whatsapp}</a>}
            {tenant.show_address && tenant.address && <p><MapPin size={15} /> {tenant.address}</p>}
            {hours.slice(0, 7).map((h) => <p key={h.day}><Clock size={14} /> {h.day}: {h.text}</p>)}
          </section>
        </div>
      </div>
      <p className="lux-credit">
        © {new Date().getFullYear()} {tenant.name} · Desenvolvido por <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a>
      </p>
    </footer>
  );
}
