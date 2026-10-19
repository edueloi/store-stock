import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Clock, Cable, Facebook, Heart, Instagram, LayoutGrid, MapPin, Menu, MessageCircle, Phone, Search, ShoppingCart, X, Zap } from "lucide-react";
import { useStore } from "../../StoreLayout";
import { hoursRows, useTheme, waLink } from "./lib";
import "./styles.css";

export function Header() {
  const { tenant, categories, products, cart, openCart, wishlist } = useStore();
  const { path } = useTheme();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("");
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  const cats = categories.filter((c) => products.some((p) => p.is_active && p.category_id === c.id));

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (cat) params.set("cat", cat);
    const qs = params.toString();
    navigate(path(`/catalogo${qs ? `?${qs}` : ""}`));
    setQuery("");
    setOpen(false);
  };

  return (
    <header className="ep-header">
      <div className="ep-wrap">
        <div className="ep-bar">
          <button type="button" className="ep-icon ep-burger" aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
          <Link to={path()} className="ep-brand" aria-label={`${tenant.name} - início`}>
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt="" />
            ) : (
              <span className="ep-brand-mark">
                <Zap size={20} />
              </span>
            )}
            <span className="ep-brand-name">{tenant.name}</span>
          </Link>
          <button type="button" className="ep-mega-btn" aria-expanded={open} aria-controls="ep-mega" onClick={() => setOpen((v) => !v)}>
            <LayoutGrid size={18} /> Materiais <ChevronDown size={15} className="ep-chev" />
          </button>
          <form onSubmit={submit} className="ep-search" role="search">
            <label className="ep-sr" htmlFor="ep-hcat">
              Tipo de material
            </label>
            <select id="ep-hcat" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Todos</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Search size={17} aria-hidden="true" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nome ou código do material" aria-label="Buscar material" />
            <button type="submit" className="ep-search-go">
              Buscar
            </button>
          </form>
          <div className="ep-actions">
            {tenant.whatsapp && (
              <a className="ep-quote" href={waLink(tenant, "Olá! Preciso de um orçamento.")} target="_blank" rel="noreferrer">
                <Phone size={16} aria-hidden="true" /> <span>Orçamento</span>
              </a>
            )}
            <Link to={path("/catalogo")} className="ep-icon ep-fav" aria-label={`Favoritos: ${wishlist.length}`}>
              <Heart size={20} />
              {wishlist.length > 0 && <b>{wishlist.length}</b>}
            </Link>
            <button type="button" className="ep-cart" aria-label={`Abrir carrinho, ${count} itens`} onClick={openCart}>
              <ShoppingCart size={20} />
              <span className="ep-cart-txt">Carrinho</span>
              <b>{count}</b>
            </button>
          </div>
        </div>

        {open && (
          <>
            <button type="button" className="ep-scrim" aria-label="Fechar menu" onClick={() => setOpen(false)} />
            <div className="ep-mega" id="ep-mega">
              <div className="ep-mega-links">
                <Link to={path()}>Início</Link>
                <Link to={path("/catalogo")}>Catálogo completo</Link>
                <Link to={path("/sobre")}>Sobre a loja</Link>
              </div>
              <p className="ep-mega-h">Por tipo de material</p>
              <ol className="ep-mega-grid">
                {cats.map((c, i) => (
                  <li key={c.id}>
                    <Link to={path(`/catalogo?cat=${c.id}`)}>
                      <span className="ep-mega-n">{String(i + 1).padStart(2, "0")}</span>
                      {c.name}
                    </Link>
                  </li>
                ))}
                {cats.length === 0 && <li className="ep-mega-empty">Nenhum tipo cadastrado.</li>}
              </ol>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

export function Footer() {
  const { tenant, categories, products } = useStore();
  const { path } = useTheme();
  const hours = hoursRows(tenant);
  const cats = categories.filter((c) => products.some((p) => p.is_active && p.category_id === c.id)).slice(0, 6);
  return (
    <footer className="ep-footer">
      <div className="ep-wrap">
        <div className="ep-foot-quote">
          <span className="ep-foot-ico">
            <Cable size={26} aria-hidden="true" />
          </span>
          <div>
            <strong>Tem uma lista de materiais?</strong>
            <span>Envie para a loja e receba o orçamento.</span>
          </div>
          {tenant.whatsapp ? (
            <a className="ep-btn" href={waLink(tenant, "Olá! Preciso de um orçamento de materiais.")} target="_blank" rel="noreferrer">
              <MessageCircle size={16} aria-hidden="true" /> Pedir orçamento
            </a>
          ) : (
            <Link className="ep-btn" to={path("/sobre")}>
              Falar com a loja
            </Link>
          )}
        </div>
        <div className="ep-foot-grid">
          <section className="ep-foot-card">
            <p className="ep-foot-brand">{tenant.name}</p>
            <p className="ep-foot-txt">{tenant.footer_text || tenant.about_text || "Materiais e atendimento técnico para a sua obra, reforma ou instalação."}</p>
            <div className="ep-foot-social">
              {tenant.instagram_url && (
                <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram">
                  <Instagram size={18} />
                </a>
              )}
              {tenant.facebook_url && (
                <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook">
                  <Facebook size={18} />
                </a>
              )}
            </div>
          </section>
          <section className="ep-foot-card">
            <h3>Materiais</h3>
            {cats.map((c) => (
              <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>
                {c.name}
              </Link>
            ))}
            <Link to={path("/catalogo")} className="ep-foot-more">
              Ver tudo
            </Link>
          </section>
          <section className="ep-foot-card">
            <h3>Atendimento</h3>
            <Link to={path("/sobre")}>Sobre a loja</Link>
            {tenant.whatsapp && (
              <a href={waLink(tenant)} target="_blank" rel="noreferrer">
                <MessageCircle size={14} aria-hidden="true" /> {tenant.whatsapp}
              </a>
            )}
            {tenant.show_address && tenant.address && (
              <p>
                <MapPin size={14} aria-hidden="true" /> {tenant.address}
              </p>
            )}
          </section>
          <section className="ep-foot-card">
            <h3>
              <Clock size={14} aria-hidden="true" /> Horários
            </h3>
            {hours.length ? (
              hours.map((h) => (
                <p key={h.day} className="ep-foot-hour">
                  <span>{h.day}</span>
                  <span>{h.text}</span>
                </p>
              ))
            ) : (
              <p>Consulte o horário pelo WhatsApp.</p>
            )}
          </section>
        </div>
        <div className="ep-foot-bottom">
          <span>
            © {new Date().getFullYear()} {tenant.name}
          </span>
          <span>Desenvolvido por BoxSys</span>
        </div>
      </div>
    </footer>
  );
}
