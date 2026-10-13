import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, Facebook, Instagram, Menu, MessageCircle, ShoppingBag, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { useKit } from "./lib";
import "./styles.css";

const DAY_LABELS: Record<string, string> = { seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb", dom: "Dom" };

export function Header() {
  const { tenant, categories, cart, openCart, path, preview, sf } = useKit();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  const label = sf.segment_label || "Esporte é movimento";

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    navigate(path(term ? `/catalogo?q=${encodeURIComponent(term)}` : "/catalogo"));
    setOpen(false);
  };
  const links = [
    { name: "Início", to: path() },
    { name: "Catálogo", to: path("/catalogo") },
    { name: "Nossa loja", to: path("/sobre") },
  ];
  const current = (to: string) => pathname === to.split("?")[0];
  const ticker = [label, tenant.hero_tagline || "Treine, jogue, supere", `${tenant.name}`, label, tenant.hero_tagline || "Treine, jogue, supere", `${tenant.name}`];

  return (
    <header className="sport-header">
      <div className="sport-ticker" aria-hidden="true">
        <div className="sport-ticker-track">
          {[...ticker, ...ticker].map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
      </div>
      <div className="sport-wrap">
        <div className="sport-bar">
          <Link to={path()} className="sport-logo sport-h" aria-label={`${tenant.name} - início`}>
            {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : null}
            <span>{tenant.name}</span>
          </Link>
          <nav className="sport-nav" aria-label="Principal">
            {links.map((l) => (
              <Link key={l.to} to={l.to} aria-current={current(l.to) ? "page" : undefined}>
                {l.name}
              </Link>
            ))}
          </nav>
          <form className="sport-search" onSubmit={submit} role="search">
            <SearchBar value={q} onChange={setQ} placeholder="Buscar produto" className="w-full" />
          </form>
          <div className="sport-bar-actions">
            <button className="sport-cart" onClick={openCart} aria-label={`Abrir carrinho, ${count} ${count === 1 ? "item" : "itens"}`}>
              <ShoppingBag size={20} /> {count}
            </button>
            <button className="sport-icon-btn sport-burger" onClick={() => setOpen(true)} aria-label="Abrir menu" aria-expanded={open}>
              <Menu size={26} />
            </button>
          </div>
        </div>
      </div>
      {open && (
        <div className="sport-drawer" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="sport-drawer-top">
            <span className="sport-h" style={{ fontSize: 28 }}>{tenant.name}</span>
            <button className="sport-icon-btn" style={{ color: "#fff" }} onClick={() => setOpen(false)} aria-label="Fechar menu">
              <X size={28} />
            </button>
          </div>
          <form onSubmit={submit} role="search">
            <label className="sport-sr" htmlFor="sport-mq">Buscar produto</label>
            <input id="sport-mq" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto" />
            {preview && <input type="hidden" value={preview} readOnly />}
          </form>
          <nav aria-label="Menu móvel" style={{ marginTop: 16 }}>
            {links.map((l, i) => (
              <Link key={l.to} to={l.to} className="sport-big sport-h" onClick={() => setOpen(false)}>
                <small>0{i + 1}</small>
                {l.name}
              </Link>
            ))}
          </nav>
          {categories.length > 0 && (
            <div className="sport-drawer-cats">
              {categories.slice(0, 10).map((c) => (
                <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} onClick={() => setOpen(false)}>
                  {c.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant, categories, path, sf } = useKit();
  const hours = tenant.business_hours
    ? Object.entries(tenant.business_hours).filter(([, v]) => v)
    : [];
  const wa = tenant.whatsapp ? tenant.whatsapp.replace(/\D/g, "") : "";
  return (
    <footer className="sport-footer">
      <div className="sport-footer-band">
        <div className="sport-wrap">
          <h2 className="sport-h">{sf.hero_button_label ? sf.hero_button_label : "Bora pro jogo?"}</h2>
          <Link to={path("/catalogo")} className="sport-btn sport-btn--dark">
            Ver catálogo <ArrowUpRight size={20} />
          </Link>
        </div>
      </div>
      <div className="sport-wrap">
        <p className="sport-giant sport-h" aria-hidden="true">{tenant.name}</p>
        <div className="sport-footer-grid" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div>
            <h3>{tenant.name}</h3>
            <p>{tenant.footer_text || tenant.about_text || "Equipamentos e artigos esportivos para quem não fica parado."}</p>
            {tenant.show_address && tenant.address && <p>{tenant.address}</p>}
          </div>
          <div>
            <h3>Navegue</h3>
            <ul>
              <li><Link to={path()}>Início</Link></li>
              <li><Link to={path("/catalogo")}>Catálogo</Link></li>
              <li><Link to={path("/sobre")}>Nossa loja</Link></li>
            </ul>
          </div>
          <div>
            <h3>Categorias</h3>
            <ul>
              {categories.slice(0, 6).map((c) => (
                <li key={c.id}><Link to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Fale com a gente</h3>
            <ul>
              {wa && (
                <li>
                  <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a>
                </li>
              )}
              {tenant.instagram_url && (
                <li>
                  <a href={tenant.instagram_url} target="_blank" rel="noreferrer"><Instagram size={16} /> Instagram</a>
                </li>
              )}
              {tenant.facebook_url && (
                <li>
                  <a href={tenant.facebook_url} target="_blank" rel="noreferrer"><Facebook size={16} /> Facebook</a>
                </li>
              )}
            </ul>
            {hours.length > 0 && (
              <ul className="sport-hours" style={{ marginTop: 14 }} aria-label="Horários">
                {hours.map(([day, h]) => (
                  <li key={day}>
                    <span>{DAY_LABELS[day] || day}</span>
                    <span>{h.closed ? "Fechado" : `${h.open} - ${h.close}`}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      <div className="sport-wrap">
        <div className="sport-credit" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <span>© {new Date().getFullYear()} {tenant.name}</span>
          <span>
            Powered by <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
