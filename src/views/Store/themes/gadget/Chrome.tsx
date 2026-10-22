import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, ChevronRight, Menu, MessageCircle, Search, ShieldCheck, ShoppingBag, Truck, X, Zap } from "lucide-react";
import { formatPhone, hoursRows, shorten, useKit, useUsedCategories } from "./kit";
import { SocialLinks } from "./Social";
import "./styles.css";

export function Header() {
  const { tenant, cartCount, openCart, path, waLink } = useKit();
  const cats = useUsedCategories();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => setMenu(false), [pathname, search]);
  useEffect(() => {
    document.body.style.overflow = menu ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menu]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(path(q ? `/catalogo?q=${encodeURIComponent(q)}` : "/catalogo"));
    setMenu(false);
  };
  const cur = (to: string): "page" | undefined => (pathname === to.split("?")[0] ? "page" : undefined);
  const links = [
    { to: path(), label: "Início" },
    { to: path("/catalogo"), label: "Catálogo" },
    { to: path("/sobre"), label: "Sobre" },
  ];
  return (
    <div className="gd-header" role="banner">
      <div className="gd-bar">
        <button type="button" className="gd-icon gd-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          {menu ? <X size={20} strokeWidth={1.7} /> : <Menu size={20} strokeWidth={1.7} />}
        </button>
        <Link to={path()} className="gd-brand" aria-label={`${tenant.name} — início`}>
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="gd-brand-symbol" aria-hidden="true"><Zap size={23} /></span>}
          <span className="gd-brand-name">{tenant.name}<small>Tecnologia & eletrônicos</small></span>
        </Link>
        <form className="gd-search" role="search" onSubmit={submit}>
          <Search size={15} aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="O que você procura?" aria-label="Buscar produtos" />
        </form>
        <nav className="gd-nav" aria-label="Principal">
          {links.map((l) => (
            <Link key={l.to} to={l.to} aria-current={cur(l.to)}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="gd-actions">
          <div className="gd-header-social"><SocialLinks /></div>
          <button type="button" className="gd-icon gd-cart" onClick={openCart} aria-label={`Abrir carrinho, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`}>
            <ShoppingBag size={19} strokeWidth={1.6} />
            {cartCount > 0 && <span className="gd-count">{cartCount}</span>}
          </button>
        </div>
      </div>
      <div className="gd-header-bottom">
        <nav className="gd-cats-bar" aria-label="Categorias">
          <div className="gd-cats-in">
            <Link className="gd-all-cats" to={path("/catalogo")}><Menu size={14} /> Todos os produtos</Link>
            {cats.slice(0, 9).map((c) => (
              <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>
                {c.name}
              </Link>
            ))}
          </div>
        </nav>
        {tenant.whatsapp && <a className="gd-header-contact" href={waLink()} target="_blank" rel="noreferrer"><MessageCircle size={15} /><span>Precisa de ajuda? <strong>{formatPhone(tenant.whatsapp)}</strong></span><ArrowUpRight size={13} /></a>}
      </div>
      {menu && (
        <div className="gd-drawer" role="dialog" aria-label="Menu">
          <form className="gd-search gd-search-drawer" role="search" onSubmit={submit}>
            <Search size={15} aria-hidden="true" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="O que você procura?" aria-label="Buscar produtos" />
          </form>
          <nav aria-label="Menu">
            {links.map((l) => (
              <Link key={l.to} to={l.to} aria-current={cur(l.to)}>
                {l.label} <ChevronRight size={16} />
              </Link>
            ))}
          </nav>
          {cats.length > 0 && (
            <>
              <p className="gd-drawer-title">Categorias</p>
              <nav aria-label="Categorias" className="gd-drawer-cats">
                {cats.slice(0, 14).map((c) => (
                  <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>
                    {c.name} <small>{c.count}</small>
                  </Link>
                ))}
              </nav>
            </>
          )}
          <SocialLinks labels />
          {tenant.whatsapp && <a className="gd-drawer-phone" href={waLink()} target="_blank" rel="noreferrer"><MessageCircle size={16} /> {formatPhone(tenant.whatsapp)}</a>}
        </div>
      )}
    </div>
  );
}

export function Footer() {
  const { tenant, path, waLink } = useKit();
  const cats = useUsedCategories();
  const hours = hoursRows(tenant);
  const blurb = shorten(tenant.footer_text || tenant.about_text || "Tecnologia selecionada, com atendimento próximo e compra simples.", 160);
  return (
    <div className="gd-footer" role="contentinfo">
      <div className="gd-foot-perks">
        <div>
          <Truck size={18} strokeWidth={1.5} />
          <span>Entrega e retirada<small>Combine direto com a loja</small></span>
        </div>
        <div>
          <ShieldCheck size={18} strokeWidth={1.5} />
          <span>Compra segura<small>Atendimento antes e depois</small></span>
        </div>
        <div>
          <MessageCircle size={18} strokeWidth={1.5} />
          <span>Suporte no WhatsApp<small>Tire dúvidas de especificação</small></span>
        </div>
      </div>
      <div className="gd-foot-main">
        <div className="gd-foot-top">
          <div className="gd-foot-brand">
            <div className="gd-foot-identity">{tenant.logo_url && <img src={tenant.logo_url} alt="" />}<strong>{tenant.name}</strong></div>
            <p>{blurb}</p>
            <SocialLinks />
          </div>
          <nav className="gd-foot-col" aria-label="Rodapé">
            <h2>Loja</h2>
            <Link to={path()}>Início</Link>
            <Link to={path("/catalogo")}>Catálogo</Link>
            <Link to={path("/sobre")}>Sobre nós</Link>
          </nav>
          {cats.length > 0 && (
            <nav className="gd-foot-col" aria-label="Categorias">
              <h2>Categorias</h2>
              {cats.slice(0, 6).map((c) => (
                <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>
                  {c.name}
                </Link>
              ))}
            </nav>
          )}
          <div className="gd-foot-col">
            <h2>Atendimento</h2>
            {tenant.whatsapp && (
              <a href={waLink()} target="_blank" rel="noreferrer">
                {formatPhone(tenant.whatsapp)}
              </a>
            )}
            {tenant.show_address && tenant.address && <span>{tenant.address}</span>}
            {hours.length > 0 && (
              <ul className="gd-hours">
                {hours.map((h) => (
                  <li key={h.day}>
                    <span>{h.day}</span> {h.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <p className="gd-credit">
          <span>
            © {new Date().getFullYear()} {tenant.name}
          </span>
          <span>
            Desenvolvido por{" "}
            <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">
              BoxSys
            </a>
          </span>
        </p>
      </div>
    </div>
  );
}
