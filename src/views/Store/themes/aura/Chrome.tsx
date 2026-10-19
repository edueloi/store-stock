import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Clock, Facebook, Heart, Instagram, MapPin, Menu, MessageCircle, Search, ShoppingBag, X } from "lucide-react";
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
      <SearchBar value={value} onChange={setValue} placeholder="Buscar peças e novidades" />
    </form>
  );
}

export function Header() {
  const { tenant, categories, active, wishlist, openCart, cartCount, path } = useShop();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const [find, setFind] = useState(false);
  const used = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 12);
  const links = [
    { name: "Início", to: path(), on: !/catalogo|sobre|produto/.test(pathname) },
    { name: "Catálogo", to: path("/catalogo"), on: /catalogo|produto/.test(pathname) },
    { name: "Sobre", to: path("/sobre"), on: /sobre/.test(pathname) },
  ];

  useEffect(() => {
    setMenu(false);
    setFind(false);
  }, [pathname]);

  return (
    <header className="au-scope au-head">
      <div className="au-wrap au-glass-bar">
        <div className="au-bar-row">
          <button type="button" className="au-icon au-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
            {menu ? <X size={21} /> : <Menu size={21} />}
          </button>
          <Link className="au-brand" to={path()} aria-label={`${tenant.name} - início`}>
            {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="dot" aria-hidden="true" />}
            <span className="nm">{tenant.name}</span>
          </Link>
          <nav className="au-nav" aria-label="Principal">
            {links.map((l) => (
              <Link key={l.name} to={l.to} aria-current={l.on ? "page" : undefined}>{l.name}</Link>
            ))}
          </nav>
          <HeaderSearch className="au-search" />
          <div className="au-actions">
            <button type="button" className="au-icon au-find" aria-label="Buscar" aria-expanded={find} onClick={() => setFind((v) => !v)}>
              <Search size={20} />
            </button>
            <Link className="au-icon" to={path("/catalogo")} aria-label={`Favoritos, ${wishlist.length}`}>
              <Heart size={20} />
              {wishlist.length > 0 && <span className="n">{wishlist.length}</span>}
            </Link>
            <button type="button" className="au-icon au-bag" aria-label={`Abrir sacola, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`} onClick={openCart}>
              <ShoppingBag size={20} />
              {cartCount > 0 && <span className="n">{cartCount}</span>}
            </button>
          </div>
        </div>
        {used.length > 0 && (
          <nav className="au-rail" aria-label="Categorias">
            {used.map((c, i) => (
              <Link key={c.id} className={`au-pastel p${i % 4}`} to={path("/catalogo", { categoria: String(c.id) })}>{c.name}</Link>
            ))}
          </nav>
        )}
        {find && <HeaderSearch className="au-search-mobile" onDone={() => setFind(false)} />}
        {menu && (
          <div className="au-drawer">
            <nav aria-label="Menu">
              {links.map((l) => (
                <Link key={l.name} to={l.to} aria-current={l.on ? "page" : undefined}>{l.name}</Link>
              ))}
            </nav>
            {used.length > 0 && (
              <>
                <p className="au-drawer-title">Categorias</p>
                <div className="au-drawer-cats">
                  {used.map((c, i) => (
                    <Link key={c.id} className={`au-pastel p${i % 4}`} to={path("/catalogo", { categoria: String(c.id) })}>{c.name}</Link>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

export function Footer() {
  const { tenant, categories, active, path } = useShop();
  const hours = hoursLines(tenant);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 6);
  const wa = tenant.whatsapp ? whatsappHref(tenant, `Olá! Vim pela loja ${tenant.name}.`) : "";
  return (
    <footer className="au-scope au-foot">
      <div className="au-wrap">
        <div className="au-foot-panel">
          <section className="au-foot-col au-foot-about">
            <p className="brand">{tenant.name}</p>
            <p>{tenant.footer_text || tenant.about_text || "Peças com cuidado, cor e leveza para o seu dia a dia."}</p>
            <div className="au-social">
              {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>}
              {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={18} /></a>}
              {wa && <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={18} /></a>}
            </div>
          </section>
          <section className="au-foot-col">
            <h3>Loja</h3>
            <ul>
              <li><Link to={path()}>Início</Link></li>
              <li><Link to={path("/catalogo")}>Todas as peças</Link></li>
              <li><Link to={path("/sobre")}>Sobre nós</Link></li>
            </ul>
          </section>
          {cats.length > 0 && (
            <section className="au-foot-col">
              <h3>Categorias</h3>
              <ul>{cats.map((c) => <li key={c.id}><Link to={path("/catalogo", { categoria: String(c.id) })}>{c.name}</Link></li>)}</ul>
            </section>
          )}
          <section className="au-foot-col">
            <h3>Contato</h3>
            <ul>
              {wa && <li><a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={15} /> {tenant.whatsapp}</a></li>}
              {tenant.show_address && tenant.address && <li><p><MapPin size={15} /> {tenant.address}</p></li>}
              {hours.length > 0 && <li><p className="hh"><Clock size={15} /> Horários</p></li>}
              {hours.map((h) => <li key={h.day} className="hr"><span>{h.day}</span><span>{h.text}</span></li>)}
            </ul>
          </section>
        </div>
        <p className="au-foot-end">
          © {new Date().getFullYear()} {tenant.name} · Powered by <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a>
        </p>
      </div>
    </footer>
  );
}
