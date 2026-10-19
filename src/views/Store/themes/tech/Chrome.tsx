import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Clock, Facebook, Instagram, LayoutGrid, MapPin, Menu, MessageCircle, ShoppingBag, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { hoursLines, useShop, whatsappHref } from "./kit";
import "./styles.css";

function HeaderSearch({ className, onDone }: { className: string; onDone?: () => void }) {
  const { path } = useShop();
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onDone?.();
    navigate(path("/catalogo", { q: value.trim() }));
  };
  return (
    <form className={className} role="search" onSubmit={submit}>
      <SearchBar value={value} onChange={setValue} placeholder="O que você procura hoje?" />
    </form>
  );
}

export function Header() {
  const { tenant, categories, active, openCart, cartCount, path } = useShop();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const [mega, setMega] = useState(false);
  const used = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 12);
  const links = [
    { name: "Início", to: path(), on: !/catalogo|sobre|produto/.test(pathname) },
    { name: "Catálogo", to: path("/catalogo"), on: /catalogo|produto/.test(pathname) },
    { name: "Sobre", to: path("/sobre"), on: /sobre/.test(pathname) },
  ];

  useEffect(() => {
    setMenu(false);
    setMega(false);
  }, [pathname]);
  useEffect(() => {
    if (!mega) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMega(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mega]);

  return (
    <header className="tp-scope tp-head">
      <div className="tp-wrap tp-head-main">
        <Link className="tp-brand" to={path()} aria-label={`${tenant.name} - início`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="mark" aria-hidden="true">{tenant.name.slice(0, 1).toUpperCase()}</span>}
          <span className="nm">{tenant.name}</span>
        </Link>

        {used.length > 0 && (
          <button type="button" className="tp-mega-btn" aria-expanded={mega} aria-controls="tp-mega" onClick={() => setMega((v) => !v)}>
            <LayoutGrid size={17} /> Categorias <ChevronDown size={15} className="chev" />
          </button>
        )}
        <HeaderSearch className="tp-head-search" />
        <nav className="tp-links" aria-label="Principal">
          {links.map((l) => (
            <Link key={l.name} to={l.to} aria-current={l.on ? "page" : undefined}>{l.name}</Link>
          ))}
        </nav>
        <button type="button" className="tp-cart" aria-label={`Abrir carrinho, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`} onClick={openCart}>
          <ShoppingBag size={20} />
          <span className="n">{cartCount}</span>
        </button>
        <button type="button" className="tp-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          {menu ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mega && used.length > 0 && (
        <>
          <button type="button" className="tp-scrim" aria-label="Fechar categorias" onClick={() => setMega(false)} />
          <div className="tp-mega" id="tp-mega">
            <div className="tp-wrap">
              <p className="tp-mega-title">Navegue por categoria</p>
              <div className="tp-mega-grid">
                {used.map((c, i) => (
                  <Link key={c.id} className={`tp-mega-item t${i % 4}`} to={path("/catalogo", { categoria: String(c.id) })}>
                    <strong>{c.name}</strong>
                    <small>{active.filter((p) => p.category_id === c.id).length} produtos</small>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {menu && (
        <div className="tp-drawer">
          <HeaderSearch className="tp-drawer-search" onDone={() => setMenu(false)} />
          <nav aria-label="Menu">
            {links.map((l) => (
              <Link key={l.name} to={l.to} aria-current={l.on ? "page" : undefined}>{l.name}</Link>
            ))}
          </nav>
          {used.length > 0 && (
            <>
              <p className="tp-drawer-title">Categorias</p>
              <div className="tp-drawer-cats">
                {used.map((c) => (
                  <Link key={c.id} to={path("/catalogo", { categoria: String(c.id) })}>{c.name}</Link>
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
  const { tenant, categories, active, path } = useShop();
  const hours = hoursLines(tenant);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 6);
  const wa = tenant.whatsapp ? whatsappHref(tenant, `Olá! Vim pela loja ${tenant.name}.`) : "";
  return (
    <footer className="tp-scope tp-foot">
      <div className="tp-wrap tp-foot-grid">
        <section className="tp-foot-card tp-foot-about">
          <p className="brand">{tenant.name}</p>
          <p>{tenant.footer_text || tenant.about_text || "Tecnologia que acompanha você."}</p>
          <div className="tp-social">
            {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>}
            {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={18} /></a>}
            {wa && <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={18} /></a>}
          </div>
        </section>
        <section className="tp-foot-card">
          <h3>Loja</h3>
          <ul>
            <li><Link to={path()}>Início</Link></li>
            <li><Link to={path("/catalogo")}>Todos os produtos</Link></li>
            <li><Link to={path("/sobre")}>Sobre a loja</Link></li>
          </ul>
        </section>
        {cats.length > 0 && (
          <section className="tp-foot-card">
            <h3>Categorias</h3>
            <ul>
              {cats.map((c) => <li key={c.id}><Link to={path("/catalogo", { categoria: String(c.id) })}>{c.name}</Link></li>)}
            </ul>
          </section>
        )}
        <section className="tp-foot-card">
          <h3>Contato</h3>
          <ul>
            {wa && <li><a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={15} /> {tenant.whatsapp}</a></li>}
            {tenant.show_address && tenant.address && <li><p><MapPin size={15} /> {tenant.address}</p></li>}
            {hours.length > 0 && <li className="hrs"><p><Clock size={15} /> Horários</p></li>}
            {hours.map((h) => <li key={h.day} className="hr"><span>{h.day}</span><span>{h.text}</span></li>)}
          </ul>
        </section>
      </div>
      <div className="tp-wrap tp-foot-end">
        © {new Date().getFullYear()} {tenant.name} · Powered by <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a>
      </div>
    </footer>
  );
}
