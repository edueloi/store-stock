import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, ShoppingCart, Tractor, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { hoursLines, useKit } from "./kit";
import "./styles.css";

export function Header() {
  const { tenant, categories, cart, openCart, path, config } = useKit();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  const activeCat = new URLSearchParams(search).get("cat");
  useEffect(() => setMenu(false), [pathname, search]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const links = [
    { name: "Início", to: path(), match: path().split("?")[0] },
    { name: "Catálogo", to: path("/catalogo"), match: path("/catalogo").split("?")[0] },
    { name: "Nossa loja", to: path("/sobre"), match: path("/sobre").split("?")[0] },
  ];
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(path("/catalogo", q.trim() ? { q: q.trim() } : undefined));
  };
  return (
    <header className="agro-header">
      <div className="agro-strip">
        <div className="agro-wrap">
          <span>{config.segment_label || "Agropecuária & Campo"}</span>
          <Link to={path("/sobre")}>Conheça a loja</Link>
        </div>
      </div>
      <div className="agro-wrap agro-bar">
        <Link className="agro-brand" to={path()} aria-label={`${tenant.name} - página inicial`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="agro-brand-mark"><Tractor size={26} aria-hidden /></span>}
          <span className="agro-slab">{tenant.name}</span>
        </Link>
        <form className="agro-search" role="search" onSubmit={submit}>
          <SearchBar value={q} onChange={setQ} placeholder="Buscar produto ou código" />
        </form>
        <div className="agro-actions">
          <button className="agro-btn-cart" onClick={openCart} aria-label={`Abrir pedido, ${count} ${count === 1 ? "item" : "itens"}`}>
            <ShoppingCart size={20} aria-hidden /> <span className="agro-lbl">Pedido</span> <b>{count}</b>
          </button>
          <button className="agro-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} aria-controls="agro-drawer" onClick={() => setMenu((v) => !v)}>
            {menu ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      <nav className="agro-depts" aria-label="Departamentos">
        <div className="agro-wrap">
          {links.map((l) => (
            <Link key={l.to} to={l.to} aria-current={pathname === l.match && !activeCat ? "page" : undefined}>{l.name}</Link>
          ))}
          {categories.map((c) => (
            <Link key={c.id} to={path("/catalogo", { cat: String(c.id) })} aria-current={activeCat === String(c.id) ? "page" : undefined}>{c.name}</Link>
          ))}
        </div>
      </nav>
      {menu && (
        <nav id="agro-drawer" className="agro-drawer" aria-label="Menu">
          {links.map((l) => <Link key={l.to} to={l.to}>{l.name}</Link>)}
          {categories.map((c) => <Link key={c.id} to={path("/catalogo", { cat: String(c.id) })}>{c.name}</Link>)}
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant, categories, path, config } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = tenant.whatsapp?.replace(/\D/g, "");
  return (
    <footer className="agro-footer">
      <div className="agro-footer-stripe" aria-hidden />
      <div className="agro-wrap agro-footer-grid">
        <div>
          <h2>{tenant.name}</h2>
          <p>{tenant.footer_text || tenant.hero_tagline || "Produtos e atendimento para a sua propriedade."}</p>
          {tenant.show_address && tenant.address && <p>{tenant.address}</p>}
        </div>
        <div>
          <h3>{config.home_categories_title || "Departamentos"}</h3>
          <ul>
            {categories.slice(0, 6).map((c) => <li key={c.id}><Link to={path("/catalogo", { cat: String(c.id) })}>{c.name}</Link></li>)}
            <li><Link to={path("/catalogo")}>Ver tudo</Link></li>
          </ul>
        </div>
        <div>
          <h3>Fale com a gente</h3>
          <ul>
            <li><Link to={path("/sobre")}>Nossa loja</Link></li>
            {wa && <li><a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">WhatsApp</a></li>}
            {tenant.instagram_url && <li><a href={tenant.instagram_url} target="_blank" rel="noreferrer">Instagram</a></li>}
            {tenant.facebook_url && <li><a href={tenant.facebook_url} target="_blank" rel="noreferrer">Facebook</a></li>}
          </ul>
        </div>
        <div>
          <h3>Horário</h3>
          {hours.length ? (
            <ul className="agro-footer-hours">{hours.map((h) => <li key={h.label}><span>{h.label}</span><span>{h.text}</span></li>)}</ul>
          ) : <p>Consulte o atendimento pelo WhatsApp.</p>}
        </div>
      </div>
      <p className="agro-footer-credit">
        © {new Date().getFullYear()} {tenant.name} · Powered by{" "}
        <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a>
      </p>
    </footer>
  );
}
