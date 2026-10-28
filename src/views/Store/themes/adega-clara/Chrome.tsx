import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Clock3, Facebook, Grid2X2, Home, Instagram, MapPin, Menu, MessageCircle, Search, ShoppingBag, Sparkles, Wine, X } from "lucide-react";
import { hoursLines, money, useKit, whatsappLink } from "./kit";
import { SearchField } from "./parts";
import "./styles.css";

export function Header() {
  const { tenant, path, categories, active, cart, cartCount, hidden, openCart } = useKit();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [find, setFind] = useState(false);
  const [term, setTerm] = useState("");
  const cats = categories.filter((category) => active.some((p) => p.category_id === category.id)).slice(0, 7);
  const links = [
    { label: "Início", to: path(), current: !/catalogo|produto|sobre/.test(pathname) },
    { label: "Nossa seleção", to: path("/catalogo"), current: /catalogo|produto/.test(pathname) },
    { label: "A adega", to: path("/sobre"), current: /sobre/.test(pathname) },
  ];
  useEffect(() => { setMenu(false); setFind(false); }, [pathname, search]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenu(false); setFind(false); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setMenu(false); setFind(false);
    navigate(path(`/catalogo${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ""}`));
  };
  return <header className="brs-header">
    <div className="brs-announcement"><Sparkles size={12} /> Pequenos momentos. Grandes motivos para brindar. <span>18+ · Consumo responsável</span></div>
    <div className="brs-wrap brs-header-main">
      <button className="brs-icon brs-burger" type="button" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} aria-controls="brs-menu" onClick={() => { setMenu((value) => !value); setFind(false); }}>{menu ? <X size={21} /> : <Menu size={21} />}</button>
      <Link className="brs-brand" to={path()} aria-label={`${tenant.name} - página inicial`}>{tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <span className="brs-brand-symbol"><Wine size={24} strokeWidth={1.1} /></span>}<span>{tenant.name}<small>Bebidas & bons encontros</small></span></Link>
      <nav className="brs-main-nav" aria-label="Principal">{links.map((link) => <Link key={link.to} to={link.to} aria-current={link.current ? "page" : undefined}>{link.label}</Link>)}</nav>
      <form className="brs-header-search" role="search" onSubmit={submit}><SearchField value={term} onChange={setTerm} label="Buscar na loja" placeholder="O que vamos brindar hoje?" /><button className="brs-sr" type="submit">Buscar</button></form>
      <button className="brs-icon brs-mobile-search" type="button" aria-label="Buscar" aria-expanded={find} onClick={() => { setFind((value) => !value); setMenu(false); }}><Search size={20} /></button>
      <button className="brs-header-bag" type="button" onClick={openCart} aria-label={`Abrir sacola, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`}><ShoppingBag size={20} strokeWidth={1.5} /><span>Minha sacola<small>{hidden || !cartCount ? "Um bom começo" : money(cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0))}</small></span><b>{cartCount}</b></button>
    </div>
    {find && <form className="brs-panel brs-find" role="search" onSubmit={submit}><SearchField value={term} onChange={setTerm} placeholder="Buscar cerveja, vinho, gelo..." label="Buscar produtos" autoFocus /><button className="brs-btn" type="submit">Buscar</button></form>}
    {menu && <div className="brs-panel brs-drawer" id="brs-menu"><span className="brs-kicker">Bem-vindo à nossa seleção</span><nav aria-label="Menu">{links.map((link) => <Link key={link.to} to={link.to} aria-current={link.current ? "page" : undefined}>{link.label}<ArrowUpRight size={17} /></Link>)}</nav>{cats.length > 0 && <div className="brs-menu-categories">{cats.map((category) => <Link key={category.id} to={path(`/catalogo?categoria=${category.id}`)}>{category.name}</Link>)}</div>}</div>}
  </header>;
}

export function Footer() {
  const { tenant, sf, path, categories, active, cartCount, openCart } = useKit();
  const { pathname } = useLocation();
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const hours = hoursLines(tenant.business_hours);
  const cats = categories.filter((category) => active.some((p) => p.category_id === category.id)).slice(0, 5);
  return <footer className="brs-footer">
    <div className="brs-wrap brs-footer-heading"><div><span className="brs-kicker">Para os próximos bons momentos</span><p>A gente se encontra no próximo brinde.</p></div><Link to={path("/catalogo")} aria-label="Explorar a seleção"><ArrowUpRight size={31} strokeWidth={1} /></Link></div>
    <div className="brs-wrap brs-footer-grid"><section className="brs-footer-brand"><Link to={path()}><Wine size={25} strokeWidth={1.2} />{tenant.name}</Link><p>{tenant.footer_text || tenant.about_text || "Bebidas, descobertas e tudo o que combina com um bom encontro."}</p><div className="brs-social">{tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={17} /></a>}{tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={17} /></a>}{wa && <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={17} /></a>}</div></section><section><h2>Descubra</h2><Link to={path()}>Início</Link><Link to={path("/catalogo")}>Toda a seleção</Link><Link to={path("/sobre")}>Nossa história</Link>{cats.map((category) => <Link key={category.id} to={path(`/catalogo?categoria=${category.id}`)}>{category.name}</Link>)}</section><section><h2>Vamos conversar?</h2>{wa && <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={14} />{tenant.whatsapp}</a>}{tenant.show_address && tenant.address && <p><MapPin size={14} />{tenant.address}</p>}{!wa && !(tenant.show_address && tenant.address) && <Link to={path("/sobre")}>Conheça a nossa adega <ArrowRight size={14} /></Link>}</section><section><h2>Faça uma visita</h2>{hours.length ? hours.map((hour) => <p key={hour.day}><Clock3 size={13} />{hour.day}: {hour.text}</p>) : <p>Consulte os horários com a equipe.</p>}<span className="brs-age"><b>18+</b> Brinde com responsabilidade.</span></section></div>
    <div className="brs-wrap brs-footer-credit"><span>© {new Date().getFullYear()} {tenant.name}. Bons momentos merecem cuidado.</span><span>Venda proibida para menores de 18 anos. · <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a></span></div>
    {wa && sf.show_whatsapp_widget !== false && !/produto/.test(pathname) && <a className="brs-contact-float" href={wa} target="_blank" rel="noreferrer" aria-label="Conversar com a adega no WhatsApp"><MessageCircle size={21} /></a>}
    <nav className="brs-bottom-nav" aria-label="Navegação do celular"><Link to={path()} aria-current={!/catalogo|produto|sobre/.test(pathname) ? "page" : undefined}><Home size={20} /><span>Início</span></Link><Link to={path("/catalogo")} aria-current={/catalogo|produto/.test(pathname) ? "page" : undefined}><Grid2X2 size={20} /><span>Seleção</span></Link><Link to={path("/sobre")} aria-current={/sobre/.test(pathname) ? "page" : undefined}><Wine size={20} /><span>A adega</span></Link><button type="button" onClick={openCart} aria-label={`Abrir sacola, ${cartCount} itens`}><span className="brs-bottom-bag"><ShoppingBag size={20} />{cartCount > 0 && <b>{cartCount}</b>}</span><span>Sacola</span></button></nav>
  </footer>;
}
