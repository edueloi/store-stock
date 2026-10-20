import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, ChevronDown, Clock, Facebook, Heart, Instagram, MapPin, Menu, MessageCircle, Search, ShoppingBag, X } from "lucide-react";
import { useStore } from "../../StoreLayout";
import { hoursRows, useTheme, waLink } from "./lib";
import "./styles.css";

export function Header() {
  const { tenant, categories, products, cart, openCart, wishlist } = useStore();
  const { path } = useTheme();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [pop, setPop] = useState(false);
  const [query, setQuery] = useState("");
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  const cats = categories.filter((c) => products.some((p) => p.is_active && p.type !== "internal" && p.category_id === c.id));
  const current = pathname.replace(/\/$/, "");

  useEffect(() => {
    setMenu(false);
    setSearch(false);
    setPop(false);
  }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = menu ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menu]);
  useEffect(() => {
    if (!pop && !search) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPop(false);
        setSearch(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pop, search]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate(path(`/catalogo?q=${encodeURIComponent(q)}`));
    setQuery("");
    setSearch(false);
    setMenu(false);
  };
  const links = [
    { name: "Início", to: path(), match: "" },
    { name: "Catálogo", to: path("/catalogo"), match: "/catalogo" },
    { name: "Sobre", to: path("/sobre"), match: "/sobre" },
  ];
  const isActive = (m: string) => (m === "" ? !/\/(catalogo|sobre|produto)/.test(current) : current.includes(m));

  return (
    <header className="nx-header">
      <div className="nx-wrap">
        <div className="nx-bar">
          <button type="button" className="nx-ico nx-burger" aria-label="Abrir menu" aria-expanded={menu} onClick={() => setMenu(true)}>
            <Menu size={22} />
          </button>
          <Link to={path()} className="nx-brand" aria-label={`${tenant.name} - início`}>
            {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="nx-brand-dot" aria-hidden="true" />}
            <span>{tenant.name}</span>
          </Link>
          <nav className="nx-nav" aria-label="Principal">
            {links.slice(0, 2).map((l) => (
              <Link key={l.name} to={l.to} aria-current={isActive(l.match) ? "page" : undefined}>
                {l.name}
              </Link>
            ))}
            <div className="nx-drop">
              <button type="button" aria-expanded={pop} aria-haspopup="true" onClick={() => setPop((v) => !v)}>
                Categorias <ChevronDown size={14} />
              </button>
              {pop && (
                <>
                  <button type="button" className="nx-scrim" aria-label="Fechar" onClick={() => setPop(false)} />
                  <div className="nx-pop">
                    <p>Categorias</p>
                    <ul>
                      {cats.map((c) => (
                        <li key={c.id}>
                          <Link to={path(`/catalogo?cat=${c.id}`)} onClick={() => setPop(false)}>{c.name}</Link>
                        </li>
                      ))}
                      {cats.length === 0 && <li className="nx-pop-empty">Nenhuma categoria cadastrada.</li>}
                    </ul>
                  </div>
                </>
              )}
            </div>
            <Link to={links[2].to} aria-current={isActive("/sobre") ? "page" : undefined}>
              Sobre
            </Link>
          </nav>

          <div className="nx-tools">
            <button type="button" className="nx-ico" aria-label="Buscar produtos" aria-expanded={search} onClick={() => setSearch((v) => !v)}>
              {search ? <X size={20} /> : <Search size={20} />}
            </button>
            <Link to={path("/catalogo")} className="nx-ico nx-fav" aria-label={`Favoritos: ${wishlist.length}`}>
              <Heart size={20} />
              {wishlist.length > 0 && <b>{wishlist.length}</b>}
            </Link>
            <button type="button" className="nx-bag" aria-label={`Abrir carrinho, ${count} itens`} onClick={openCart}>
              <ShoppingBag size={19} />
              <span>Carrinho</span>
              <b>{count}</b>
            </button>
          </div>
        </div>
        {search && (
          <form className="nx-searchpanel" onSubmit={submit} role="search">
            <Search size={20} aria-hidden="true" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="O que você procura?" aria-label="Buscar produtos" />
            <button type="submit" className="nx-btn">
              Buscar
            </button>
          </form>
        )}
      </div>

      {menu && (
        <div className="nx-sheet" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="nx-sheet-top">
            <span className="nx-brand">
              <span>{tenant.name}</span>
            </span>
            <button type="button" className="nx-ico" aria-label="Fechar menu" onClick={() => setMenu(false)}>
              <X size={24} />
            </button>
          </div>
          <form onSubmit={submit} role="search" className="nx-sheet-search">
            <Search size={18} aria-hidden="true" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar produtos" aria-label="Buscar produtos" />
          </form>
          <nav className="nx-sheet-links">
            {links.map((l) => (
              <Link key={l.name} to={l.to}>
                {l.name} <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            ))}
          </nav>
          {cats.length > 0 && <p className="nx-sheet-h">Categorias</p>}
          <div className="nx-sheet-cats">
            {cats.map((c) => (
              <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)}>
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { tenant } = useStore();
  const { path } = useTheme();
  const hours = hoursRows(tenant);
  return (
    <footer className="nx-footer">
      <div className="nx-wrap">
        <div className="nx-foot-grid">
          <section className="nx-foot-card nx-foot-about">
            <Link className="nx-foot-brand" to={path()}>{tenant.logo_url && <img src={tenant.logo_url} alt="" />}<span>{tenant.name}</span></Link>
            <p>{tenant.footer_text || tenant.about_text || "Tecnologia para o seu dia, com escolhas práticas e atendimento próximo."}</p>
            <div className="nx-foot-social">
              {tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>}
              {tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={18} /></a>}
            </div>
          </section>
          <section className="nx-foot-card">
            <h2>Navegação</h2>
            <Link to={path()}>Início</Link>
            <Link to={path("/catalogo")}>Todos os produtos</Link>
            <Link to={path("/sobre")}>Sobre a loja</Link>
          </section>
          <section className="nx-foot-card">
            <h2>Fale com a gente</h2>
            {tenant.whatsapp && <a href={waLink(tenant)} target="_blank" rel="noreferrer"><MessageCircle size={16} />{tenant.whatsapp}</a>}
            {tenant.show_address && tenant.address && <p className="nx-foot-addr"><MapPin size={16} />{tenant.address}</p>}
            <Link to={path("/sobre")}>Atendimento e informações</Link>
          </section>
          <section className="nx-foot-card nx-foot-hours">
            <h2><Clock size={15} /> Horários</h2>
            {hours.length ? <dl>{hours.map(hour => <div key={hour.day}><dt>{hour.day}</dt><dd>{hour.text}</dd></div>)}</dl> : <p>Consulte os horários com a equipe.</p>}
          </section>
        </div>
        <div className="nx-foot-bottom"><span>© {new Date().getFullYear()} {tenant.name}</span><span>Desenvolvido por <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a></span></div>
      </div>
    </footer>
  );
}
