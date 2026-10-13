import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, Search, ShoppingBasket, Sprout, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { hoursLines, useKit } from "./kit";
import { Leaf } from "./parts";
import "./styles.css";

export function Header() {
  const { tenant, categories, cart, openCart, path } = useKit();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<"" | "search" | "menu">("");
  const [q, setQ] = useState("");
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  useEffect(() => setPanel(""), [pathname, search]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPanel("");
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
    <header className="garden-header">
      <div className="garden-pill">
        <Link className="garden-brand" to={path()} aria-label={`${tenant.name} - página inicial`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="garden-brand-mark"><Sprout size={24} aria-hidden /></span>}
          <strong>{tenant.name}</strong>
        </Link>
        <nav className="garden-nav" aria-label="Principal">
          {links.map((l) => <Link key={l.to} to={l.to} aria-current={pathname === l.match ? "page" : undefined}>{l.name}</Link>)}
        </nav>
        <div className="garden-tools">
          <button className="garden-icon" aria-label="Buscar produtos" aria-expanded={panel === "search"} onClick={() => setPanel(panel === "search" ? "" : "search")}>
            {panel === "search" ? <X size={21} /> : <Search size={21} />}
          </button>
          <button className="garden-bag" onClick={openCart} aria-label={`Abrir seleção, ${count} ${count === 1 ? "item" : "itens"}`}>
            <ShoppingBasket size={19} aria-hidden /> <span className="garden-lbl">Seleção</span> <b>{count}</b>
          </button>
          <button className="garden-icon garden-burger" aria-label={panel === "menu" ? "Fechar menu" : "Abrir menu"} aria-expanded={panel === "menu"} onClick={() => setPanel(panel === "menu" ? "" : "menu")}>
            {panel === "menu" ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {panel === "search" && (
        <div className="garden-panel">
          <form role="search" onSubmit={submit}>
            <SearchBar value={q} onChange={setQ} placeholder="Buscar sementes, ferramentas, vasos..." />
          </form>
        </div>
      )}
      {panel === "menu" && (
        <nav className="garden-panel" aria-label="Menu">
          <div className="garden-mobile-links">
            {links.map((l) => <Link key={l.to} to={l.to} aria-current={pathname === l.match ? "page" : undefined}>{l.name}</Link>)}
            {categories.map((c) => <Link key={c.id} to={path("/catalogo", { cat: String(c.id) })}><Leaf size={18} className="" /> {c.name}</Link>)}
          </div>
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
    <footer className="garden-footer">
      <svg className="garden-footer-wave" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden>
        <path d="M0 60V30C120 6 240 6 360 26s240 30 360 14S960 0 1080 10s240 24 360 8V60z" fill="#183d2a" />
      </svg>
      <div className="garden-foot-big" aria-hidden>{tenant.name}</div>
      <div className="garden-wrap garden-foot-grid">
        <div>
          <h2>{tenant.name}</h2>
          <p>{tenant.footer_text || tenant.hero_tagline || "Um pouco mais de verde. Todos os dias."}</p>
          {tenant.show_address && tenant.address && <p>{tenant.address}</p>}
        </div>
        <div>
          <h3>Coleções</h3>
          <ul>
            {categories.slice(0, 6).map((c) => <li key={c.id}><Link to={path("/catalogo", { cat: String(c.id) })}>{c.name}</Link></li>)}
            <li><Link to={path("/catalogo")}>Ver tudo</Link></li>
          </ul>
        </div>
        <div>
          <h3>Conversa</h3>
          <ul>
            <li><Link to={path("/sobre")}>Nossa loja</Link></li>
            {wa && <li><a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">WhatsApp</a></li>}
            {tenant.instagram_url && <li><a href={tenant.instagram_url} target="_blank" rel="noreferrer">Instagram</a></li>}
            {tenant.facebook_url && <li><a href={tenant.facebook_url} target="_blank" rel="noreferrer">Facebook</a></li>}
          </ul>
        </div>
        <div>
          <h3>Horários</h3>
          {hours.length ? <ul className="garden-hours">{hours.map((h) => <li key={h.label}><span>{h.label}</span><span>{h.text}</span></li>)}</ul> : <p>Fale com a loja para combinar o melhor horário.</p>}
        </div>
      </div>
      <p className="garden-credit">
        © {new Date().getFullYear()} {tenant.name} · Powered by{" "}
        <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a>
      </p>
    </footer>
  );
}
