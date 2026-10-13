import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, ShoppingBasket, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { hoursLines, useKit } from "./kit";
import { Grain, Paw } from "./parts";
import "./styles.css";

export function Header() {
  const { tenant, categories, cart, openCart, path } = useKit();
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
    <header className="feed-header">
      <div className="feed-wrap feed-top">
        <form className="feed-search" role="search" onSubmit={submit}>
          <SearchBar value={q} onChange={setQ} placeholder="O que seu bichinho precisa?" />
        </form>
        <Link className="feed-brand" to={path()} aria-label={`${tenant.name} - página inicial`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="feed-brand-mark"><Paw size={28} /></span>}
          <strong>{tenant.name}</strong>
        </Link>
        <button className="feed-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} aria-controls="feed-drawer" onClick={() => setMenu((v) => !v)}>
          {menu ? <X size={22} /> : <Menu size={22} />}
        </button>
        <button className="feed-cart" onClick={openCart} aria-label={`Abrir cesta, ${count} ${count === 1 ? "item" : "itens"}`}>
          <ShoppingBasket size={20} aria-hidden /> <span className="feed-lbl">Cesta</span> <b>{count}</b>
        </button>
      </div>
      <nav className="feed-rail" aria-label="Principal">
        <div className="feed-wrap">
          {links.map((l) => <Link key={l.to} to={l.to} aria-current={pathname === l.match && !activeCat ? "page" : undefined}>{l.name}</Link>)}
          {categories.length > 0 && <span className="feed-sep" aria-hidden />}
          {categories.map((c) => (
            <Link key={c.id} to={path("/catalogo", { cat: String(c.id) })} aria-current={activeCat === String(c.id) ? "page" : undefined}><Grain size={14} /> {c.name}</Link>
          ))}
        </div>
      </nav>
      {menu && (
        <nav id="feed-drawer" className="feed-drawer" aria-label="Menu">
          {links.map((l) => <Link key={l.to} to={l.to} aria-current={pathname === l.match && !activeCat ? "page" : undefined}>{l.name}</Link>)}
          {categories.map((c) => <Link key={c.id} to={path("/catalogo", { cat: String(c.id) })}><Paw size={16} /> {c.name}</Link>)}
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant, categories, path } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = tenant.whatsapp?.replace(/\D/g, "");
  return (
    <footer className="feed-footer">
      <div className="feed-wrap feed-foot-grid">
        <div>
          <h2><Paw size={26} /> {tenant.name}</h2>
          <p>{tenant.footer_text || tenant.hero_tagline || "Cuidado em cada porção, para quem faz parte da família."}</p>
          {tenant.show_address && tenant.address && <p>{tenant.address}</p>}
        </div>
        <div>
          <h3><Grain size={16} /> Corredores</h3>
          <ul>
            {categories.slice(0, 6).map((c) => <li key={c.id}><Link to={path("/catalogo", { cat: String(c.id) })}>{c.name}</Link></li>)}
            <li><Link to={path("/catalogo")}>Todo o catálogo</Link></li>
          </ul>
        </div>
        <div>
          <h3><Paw size={16} /> Atendimento</h3>
          <ul>
            <li><Link to={path("/sobre")}>Nossa loja</Link></li>
            {wa && <li><a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">WhatsApp</a></li>}
            {tenant.instagram_url && <li><a href={tenant.instagram_url} target="_blank" rel="noreferrer">Instagram</a></li>}
            {tenant.facebook_url && <li><a href={tenant.facebook_url} target="_blank" rel="noreferrer">Facebook</a></li>}
          </ul>
        </div>
        <div>
          <h3><Grain size={16} /> Horários</h3>
          {hours.length ? <ul className="feed-hours">{hours.map((h) => <li key={h.label}><span>{h.label}</span><span>{h.text}</span></li>)}</ul> : <p>Fale com a loja para saber os horários.</p>}
        </div>
      </div>
      <p className="feed-credit">
        © {new Date().getFullYear()} {tenant.name} · Powered by{" "}
        <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a>
      </p>
    </footer>
  );
}
