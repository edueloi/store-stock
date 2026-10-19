import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, ChevronDown, Dumbbell, Facebook, Instagram, Menu, MessageCircle, Search, ShoppingBag, X } from "lucide-react";
import { useKit } from "./lib";
import "./styles.css";

const DAY_LABELS: Record<string, string> = { seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb", dom: "Dom" };

export function Header() {
  const { tenant, usedCategories, cart, openCart, path } = useKit();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<null | "cats" | "menu">(null);
  const [q, setQ] = useState("");
  const count = cart.reduce((s, i) => s + i.quantity, 0);

  useEffect(() => setPanel(null), [pathname, search]);
  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPanel(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panel]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    navigate(path(term ? `/catalogo?q=${encodeURIComponent(term)}` : "/catalogo"));
    setPanel(null);
  };
  const links = [
    { name: "Início", to: path() },
    { name: "Catálogo", to: path("/catalogo") },
    { name: "Sobre", to: path("/sobre") },
  ];
  const current = (to: string) => pathname === to.split("?")[0];

  return (
    <header className="ft-header">
      <div className="ft-wrap">
        <div className="ft-bar">
          <Link to={path()} className="ft-logo" aria-label={`${tenant.name} - início`}>
            {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="ft-logo-mark"><Dumbbell size={18} /></span>}
            <span className="ft-name">{tenant.name}</span>
          </Link>
          <nav className="ft-nav" aria-label="Principal">
            {links.map((l) => (
              <Link key={l.to} to={l.to} aria-current={current(l.to) ? "page" : undefined}>{l.name}</Link>
            ))}
            {usedCategories.length > 0 && (
              <button type="button" aria-expanded={panel === "cats"} onClick={() => setPanel(panel === "cats" ? null : "cats")}>
                Categorias <ChevronDown size={15} />
              </button>
            )}
          </nav>
          <form className="ft-hsearch" role="search" onSubmit={submit}>
            <Search size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produtos" aria-label="Buscar produtos" />
          </form>
          <div className="ft-actions">
            <button className="ft-ibtn ft-cart" aria-label={`Abrir carrinho, ${count} ${count === 1 ? "item" : "itens"}`} onClick={openCart}>
              <ShoppingBag size={20} />
              {count > 0 && <span className="ft-count">{count}</span>}
            </button>
            <button className="ft-ibtn ft-burger" aria-label="Abrir menu" aria-expanded={panel === "menu"} onClick={() => setPanel("menu")}>
              <Menu size={22} />
            </button>
          </div>
        </div>
        {panel === "cats" && (
          <div className="ft-mega" role="region" aria-label="Categorias">
            <div className="ft-mega-grid">
              {usedCategories.slice(0, 12).map((c) => (
                <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link>
              ))}
            </div>
            <Link to={path("/catalogo")} className="ft-mega-all">Ver todos os produtos <ArrowRight size={16} /></Link>
          </div>
        )}
      </div>
      {panel === "cats" && <button className="ft-scrim ft-scrim--soft" aria-label="Fechar categorias" onClick={() => setPanel(null)} />}
      {panel === "menu" && (
        <>
          <button className="ft-scrim" aria-label="Fechar menu" onClick={() => setPanel(null)} />
          <aside className="ft-drawer" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="ft-drawer-head">
              <strong>{tenant.name}</strong>
              <button className="ft-ibtn" aria-label="Fechar menu" onClick={() => setPanel(null)}><X size={22} /></button>
            </div>
            <form className="ft-hsearch ft-hsearch--drawer" role="search" onSubmit={submit}>
              <Search size={18} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produtos" aria-label="Buscar produtos" />
            </form>
            <nav className="ft-drawer-nav" aria-label="Menu móvel">
              {links.map((l) => <Link key={l.to} to={l.to}>{l.name}<ArrowRight size={18} /></Link>)}
            </nav>
            {usedCategories.length > 0 && (
              <>
                <h3 className="ft-drawer-title">Categorias</h3>
                <div className="ft-drawer-cats">
                  {usedCategories.slice(0, 10).map((c) => <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link>)}
                </div>
              </>
            )}
          </aside>
        </>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant, usedCategories, path, sf } = useKit();
  const hours = tenant.business_hours ? Object.entries(tenant.business_hours).filter(([, v]) => v) : [];
  const wa = tenant.whatsapp ? tenant.whatsapp.replace(/\D/g, "") : "";
  return (
    <footer className="ft-footer">
      <div className="ft-wrap">
        <div className="ft-footer-card">
          <div className="ft-footer-grid">
            <div className="ft-fcol ft-fcol--brand">
              <p className="ft-brandline">{tenant.name}</p>
              <p>{tenant.footer_text || tenant.about_text || sf.segment_label || "Performance, treino e bem-estar em um só lugar."}</p>
              {tenant.show_address && tenant.address && <p>{tenant.address}</p>}
            </div>
            <div className="ft-fcol">
              <h3>Navegue</h3>
              <ul>
                <li><Link to={path()}>Início</Link></li>
                <li><Link to={path("/catalogo")}>Catálogo</Link></li>
                <li><Link to={path("/sobre")}>Sobre a loja</Link></li>
              </ul>
            </div>
            {usedCategories.length > 0 && (
              <div className="ft-fcol">
                <h3>Categorias</h3>
                <ul>
                  {usedCategories.slice(0, 5).map((c) => (
                    <li key={c.id}><Link to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link></li>
                  ))}
                </ul>
              </div>
            )}
            <div className="ft-fcol">
              <h3>Contato</h3>
              <ul>
                {wa && <li><a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a></li>}
                {tenant.instagram_url && <li><a href={tenant.instagram_url} target="_blank" rel="noreferrer"><Instagram size={16} /> Instagram</a></li>}
                {tenant.facebook_url && <li><a href={tenant.facebook_url} target="_blank" rel="noreferrer"><Facebook size={16} /> Facebook</a></li>}
              </ul>
              {hours.length > 0 && (
                <ul className="ft-hours" aria-label="Horários de atendimento">
                  {hours.map(([d, h]) => (
                    <li key={d}><span>{DAY_LABELS[d] || d}</span><span>{h.closed ? "Fechado" : `${h.open}-${h.close}`}</span></li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="ft-credit">
            <span>© {new Date().getFullYear()} {tenant.name}</span>
            <span>Powered by <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a></span>
          </div>
        </div>
      </div>
    </footer>
  );
}
