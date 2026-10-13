import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Facebook, Instagram, Menu, MessageCircle, PawPrint, ShoppingBag, X } from "lucide-react";
import SearchBar from "../../../../components/layout/SearchBar";
import { detectAnimal } from "./animals";
import { useKit } from "./lib";
import "./styles.css";
import "./reference.css";

const DAY_LABELS: Record<string, string> = { seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb", dom: "Dom" };

export function Header() {
  const { tenant, cart, openCart, path } = useKit();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");
  const count = cart.reduce((s, i) => s + i.quantity, 0);

  useEffect(() => setMenu(false), [pathname]);
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
          <Link to={path()} className="pet-logo" aria-label={`${tenant.name} - início`}>
            {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="pet-logo-mark"><PawPrint size={22} /></span>}
            <span className="pet-logo-name">{tenant.name}</span>
          </Link>
          <nav className="pet-nav" aria-label="Principal">
            {links.map((l) => (
              <Link key={l.to} to={l.to} aria-current={current(l.to) ? "page" : undefined}>{l.name}</Link>
            ))}
          </nav>
          <form className="pet-search" onSubmit={submit} role="search">
            <SearchBar value={q} onChange={setQ} placeholder="Buscar para o seu pet" />
          </form>
          <div className="pet-acts">
            <button className="pet-round pet-round--cart" onClick={openCart} aria-label={`Abrir carrinho, ${count} ${count === 1 ? "item" : "itens"}`}>
              <ShoppingBag size={21} />
              {count > 0 && <span className="pet-badge-n">{count}</span>}
            </button>
            <button className="pet-round pet-burger" onClick={() => setMenu((v) => !v)} aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu}>
              {menu ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>
        {menu && (
          <div className="pet-sheet">
            <form onSubmit={submit} role="search" style={{ marginBottom: 8 }}>
              <SearchBar value={q} onChange={setQ} placeholder="Buscar para o seu pet" />
            </form>
            <nav aria-label="Menu móvel">
              {links.map((l) => (
                <Link key={l.to} to={l.to} className="pet-sl" onClick={() => setMenu(false)}>{l.name}</Link>
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

export function Footer() {
  const { tenant, categories, path, sf } = useKit();
  const hours = tenant.business_hours ? Object.entries(tenant.business_hours).filter(([, v]) => v) : [];
  const wa = tenant.whatsapp ? tenant.whatsapp.replace(/\D/g, "") : "";
  return (
    <footer className="pet-footer">
      <div className="pet-wrap">
        <div className="pet-footer-cta">
          <h2 className="pet-h" style={{ color: "var(--pt-ink)" }}>{sf.hero_button_label ? sf.hero_button_label : "Seu pet merece o melhor!"}</h2>
          <Link to={path("/catalogo")} className="pet-btn pet-btn--light">Ver produtos <ArrowRight size={18} /></Link>
        </div>
        <div className="pet-footer-grid">
          <div>
            <h3>{tenant.name}</h3>
            <p>{tenant.footer_text || tenant.about_text || "Carinho, cuidado e tudo o que o seu pet precisa."}</p>
            {tenant.show_address && tenant.address && <p style={{ marginTop: 10 }}>{tenant.address}</p>}
          </div>
          <div>
            <h3>Passeie por aqui</h3>
            <ul>
              <li><Link to={path()}>Início</Link></li>
              <li><Link to={path("/catalogo")}>Catálogo</Link></li>
              <li><Link to={path("/sobre")}>Nossa loja</Link></li>
            </ul>
          </div>
          <div>
            <h3>Para quem?</h3>
            <ul>
              {categories.slice(0, 6).map((c) => (
                <li key={c.id}><Link to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Fale com a gente</h3>
            <ul>
              {wa && <li><a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a></li>}
              {tenant.instagram_url && <li><a href={tenant.instagram_url} target="_blank" rel="noreferrer"><Instagram size={16} /> Instagram</a></li>}
              {tenant.facebook_url && <li><a href={tenant.facebook_url} target="_blank" rel="noreferrer"><Facebook size={16} /> Facebook</a></li>}
            </ul>
            {hours.length > 0 && (
              <ul className="pet-hours" style={{ marginTop: 12 }} aria-label="Horários de atendimento">
                {hours.map(([d, h]) => (
                  <li key={d}><span>{DAY_LABELS[d] || d}</span><span>{h.closed ? "Fechado" : `${h.open} - ${h.close}`}</span></li>
                ))}
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
