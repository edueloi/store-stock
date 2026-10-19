import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Facebook, Heart, Instagram, Menu, MessageCircle, PawPrint, Search, ShoppingBag, X } from "lucide-react";
import { detectAnimal } from "./animals";
import { useKit } from "./lib";
import "./styles.css";

const DAY_LABELS: Record<string, string> = { seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb", dom: "Dom" };

export function Header() {
  const { tenant, usedCategories, cart, openCart, path } = useKit();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");
  const count = cart.reduce((s, i) => s + i.quantity, 0);

  useEffect(() => setMenu(false), [pathname, search]);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menu]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    navigate(path(term ? `/catalogo?q=${encodeURIComponent(term)}` : "/catalogo"));
    setMenu(false);
  };
  const links = [
    { name: "Início", to: path() },
    { name: "Catálogo", to: path("/catalogo") },
    { name: "Nossa loja", to: path("/sobre") },
  ];
  const current = (to: string) => pathname === to.split("?")[0];

  return (
    <header className="pet-header">
      <div className="pet-wrap">
        <div className="pet-bar">
          <form className="pet-search" onSubmit={submit} role="search">
            <Search size={19} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar para o seu pet" aria-label="Buscar produtos" />
          </form>
          <button className="pet-round pet-burger" onClick={() => setMenu(true)} aria-label="Abrir menu" aria-expanded={menu}><Menu size={22} /></button>
          <Link to={path()} className="pet-logo" aria-label={`${tenant.name} - início`}>
            {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="pet-logo-mark"><PawPrint size={22} /></span>}
            <span className="pet-logo-name">{tenant.name}</span>
          </Link>
          <div className="pet-acts">
            <button className="pet-round pet-round--cart" onClick={openCart} aria-label={`Abrir carrinho, ${count} ${count === 1 ? "item" : "itens"}`}>
              <ShoppingBag size={21} />
              {count > 0 && <span className="pet-badge-n">{count}</span>}
            </button>
          </div>
        </div>
        <nav className="pet-strip" aria-label="Principal">
          {links.map((l) => <Link key={l.to} to={l.to} aria-current={current(l.to) ? "page" : undefined}>{l.name}</Link>)}
          {usedCategories.slice(0, 5).map((c) => {
            const { Icon } = detectAnimal(c.name);
            return <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className="pet-strip-cat"><Icon size={16} />{c.name}</Link>;
          })}
        </nav>
      </div>
      {menu && (
        <div className="pet-backdrop" onClick={() => setMenu(false)}>
          <aside className="pet-sheet" role="dialog" aria-modal="true" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
            <div className="pet-sheet-head"><strong>{tenant.name}</strong><button className="pet-round" onClick={() => setMenu(false)} aria-label="Fechar menu"><X size={22} /></button></div>
            <form onSubmit={submit} role="search" className="pet-search pet-search--sheet">
              <Search size={19} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar para o seu pet" aria-label="Buscar produtos" />
            </form>
            <nav aria-label="Menu móvel">{links.map((l) => <Link key={l.to} to={l.to} className="pet-sl">{l.name}<ArrowRight size={18} /></Link>)}</nav>
            {usedCategories.length > 0 && (
              <>
                <h3>Para quem?</h3>
                <nav aria-label="Categorias">
                  {usedCategories.slice(0, 8).map((c) => {
                    const { Icon } = detectAnimal(c.name);
                    return <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className="pet-sl"><span><Icon size={18} /> {c.name}</span><ArrowRight size={18} /></Link>;
                  })}
                </nav>
              </>
            )}
          </aside>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant, usedCategories, path, sf } = useKit();
  const hours = tenant.business_hours ? Object.entries(tenant.business_hours).filter(([, v]) => v) : [];
  const wa = tenant.whatsapp ? tenant.whatsapp.replace(/\D/g, "") : "";
  return (
    <footer className="pet-footer">
      <svg className="pet-footer-wave" viewBox="0 0 1200 44" preserveAspectRatio="none" aria-hidden="true"><path d="M0 22 C 150 0, 250 44, 400 22 S 650 0, 800 22 S 1050 44, 1200 22 V44 H0 Z" /></svg>
      <div className="pet-wrap">
        <div className="pet-footer-cta">
          <h2 className="pet-h">{sf.hero_button_label ? sf.hero_button_label : "Seu pet merece o melhor!"}</h2>
          <Link to={path("/catalogo")} className="pet-btn">Ver produtos <ArrowRight size={18} /></Link>
        </div>
        <div className="pet-footer-grid">
          <div className="pet-fcard pet-fcard--brand">
            <h3><Heart size={18} fill="currentColor" /> {tenant.name}</h3>
            <p>{tenant.footer_text || tenant.about_text || "Carinho, cuidado e tudo o que o seu pet precisa."}</p>
            {tenant.show_address && tenant.address && <p>{tenant.address}</p>}
          </div>
          <div className="pet-fcard">
            <h3>Passeie por aqui</h3>
            <ul>
              <li><Link to={path()}>Início</Link></li>
              <li><Link to={path("/catalogo")}>Catálogo</Link></li>
              <li><Link to={path("/sobre")}>Nossa loja</Link></li>
            </ul>
          </div>
          {usedCategories.length > 0 && (
            <div className="pet-fcard">
              <h3>Para quem?</h3>
              <ul>{usedCategories.slice(0, 5).map((c) => <li key={c.id}><Link to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link></li>)}</ul>
            </div>
          )}
          <div className="pet-fcard">
            <h3>Fale com a gente</h3>
            <ul>
              {wa && <li><a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a></li>}
              {tenant.instagram_url && <li><a href={tenant.instagram_url} target="_blank" rel="noreferrer"><Instagram size={16} /> Instagram</a></li>}
              {tenant.facebook_url && <li><a href={tenant.facebook_url} target="_blank" rel="noreferrer"><Facebook size={16} /> Facebook</a></li>}
            </ul>
            {hours.length > 0 && (
              <ul className="pet-hours" aria-label="Horários de atendimento">
                {hours.map(([d, h]) => <li key={d}><span>{DAY_LABELS[d] || d}</span><span>{h.closed ? "Fechado" : `${h.open} - ${h.close}`}</span></li>)}
              </ul>
            )}
          </div>
        </div>
        <div className="pet-credit">
          <span>© {new Date().getFullYear()} {tenant.name}</span>
          <span>Powered by <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a></span>
        </div>
      </div>
    </footer>
  );
}
