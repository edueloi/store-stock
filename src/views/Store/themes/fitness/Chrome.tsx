import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Dumbbell, Facebook, Instagram, Menu, MessageCircle, Search, ShoppingBag, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { useKit } from "./lib";
import "./styles.css";

const DAY_LABELS: Record<string, string> = { seg: "SEG", ter: "TER", qua: "QUA", qui: "QUI", sex: "SEX", sab: "SÁB", dom: "DOM" };

export function Header() {
  const { tenant, categories, cart, openCart, path } = useKit();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<null | "search" | "menu">(null);
  const [q, setQ] = useState("");
  const count = cart.reduce((s, i) => s + i.quantity, 0);

  useEffect(() => setPanel(null), [pathname]);
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
  const onCatalog = pathname.endsWith("/catalogo");

  return (
    <>
      <header className="ft-header">
        <div className="ft-wrap">
          <div className="ft-bar">
            <Link to={path()} className="ft-logo" aria-label={`${tenant.name} - início`}>
              {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="ft-logo-mark"><Dumbbell size={15} /></span>}
              <span className="ft-name">{tenant.name}</span>
            </Link>
            <nav className="ft-nav" aria-label="Principal">
              {links.map((l) => (
                <Link key={l.to} to={l.to} aria-current={current(l.to) ? "page" : undefined}>{l.name}</Link>
              ))}
            </nav>
            <div className="ft-actions">
              <button className="ft-ibtn" aria-label="Buscar produtos" aria-expanded={panel === "search"} onClick={() => setPanel(panel === "search" ? null : "search")}>
                <Search size={20} />
              </button>
              <button className="ft-ibtn" aria-label={`Abrir carrinho, ${count} ${count === 1 ? "item" : "itens"}`} onClick={openCart}>
                <ShoppingBag size={20} />
                {count > 0 && <span className="ft-count">{count}</span>}
              </button>
              <Link to={path("/catalogo")} className="ft-btn ft-cta">
                Ver catálogo <ArrowRight size={16} />
              </Link>
              <button className="ft-ibtn ft-burger" aria-label={panel === "menu" ? "Fechar menu" : "Abrir menu"} aria-expanded={panel === "menu"} onClick={() => setPanel(panel === "menu" ? null : "menu")}>
                {panel === "menu" ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>
        {panel === "search" && (
          <div className="ft-drop">
            <div className="ft-wrap">
              <form onSubmit={submit} role="search">
                <SearchBar value={q} onChange={setQ} placeholder="Buscar produto, suplemento, acessório" />
              </form>
            </div>
          </div>
        )}
        {panel === "menu" && (
          <div className="ft-drop">
            <div className="ft-wrap">
              <nav className="ft-menu" aria-label="Menu móvel">
                {links.map((l, i) => (
                  <Link key={l.to} to={l.to} onClick={() => setPanel(null)}>
                    {l.name} <small>0{i + 1}</small>
                  </Link>
                ))}
              </nav>
              {categories.length > 0 && (
                <div className="ft-menu-cats">
                  {categories.slice(0, 8).map((c) => (
                    <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} onClick={() => setPanel(null)}>{c.name}</Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </header>
      {!onCatalog && (
        <div className="ft-dock" role="region" aria-label="Atalhos">
          <Link to={path("/catalogo")} className="ft-btn">Ver catálogo <ArrowRight size={16} /></Link>
          <button className="ft-btn ft-btn--line" onClick={openCart} aria-label={`Abrir carrinho, ${count} ${count === 1 ? "item" : "itens"}`}>
            <ShoppingBag size={18} /> {count}
          </button>
        </div>
      )}
    </>
  );
}

export function Footer() {
  const { tenant, categories, path, sf } = useKit();
  const hours = tenant.business_hours ? Object.entries(tenant.business_hours).filter(([, v]) => v) : [];
  const wa = tenant.whatsapp ? tenant.whatsapp.replace(/\D/g, "") : "";
  return (
    <footer className="ft-footer">
      <div className="ft-wrap">
        <div className="ft-footer-top">
          <div>
            <p className="ft-brandline">{tenant.name}</p>
            <p>{tenant.footer_text || tenant.about_text || sf.segment_label || "Performance, treino e bem-estar em um só lugar."}</p>
            {tenant.show_address && tenant.address && <p style={{ marginTop: 10 }}>{tenant.address}</p>}
          </div>
          <div>
            <h3>Módulos</h3>
            <ul>
              <li><Link to={path()}>Início</Link></li>
              <li><Link to={path("/catalogo")}>Catálogo</Link></li>
              <li><Link to={path("/sobre")}>Sobre</Link></li>
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
            <h3>Contato</h3>
            <ul>
              {wa && <li><a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a></li>}
              {tenant.instagram_url && <li><a href={tenant.instagram_url} target="_blank" rel="noreferrer"><Instagram size={16} /> Instagram</a></li>}
              {tenant.facebook_url && <li><a href={tenant.facebook_url} target="_blank" rel="noreferrer"><Facebook size={16} /> Facebook</a></li>}
            </ul>
            {hours.length > 0 && (
              <ul className="ft-hours" style={{ marginTop: 12 }} aria-label="Horários de atendimento">
                {hours.map(([d, h]) => (
                  <li key={d}><span>{DAY_LABELS[d] || d}</span><span>{h.closed ? "FECHADO" : `${h.open}-${h.close}`}</span></li>
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
    </footer>
  );
}
