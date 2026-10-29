import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, Clock3, Facebook, Grid2X2, Home, Instagram, MapPin, Menu, MessageCircle, Search, ShoppingBag, Sparkles, X } from "lucide-react";
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
  const links = [{ label: "Início", to: path(), on: !/catalogo|sobre|produto/.test(pathname) }, { label: "A coleção", to: path("/catalogo"), on: /catalogo|produto/.test(pathname) }, { label: "Sobre a marca", to: path("/sobre"), on: /sobre/.test(pathname) }];
  const cats = categories.filter((category) => active.some((p) => p.category_id === category.id)).slice(0, 8);
  useEffect(() => { setMenu(false); setFind(false); }, [pathname, search]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenu(false); setFind(false); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const submit = (event: FormEvent) => { event.preventDefault(); setFind(false); setMenu(false); navigate(path(`/catalogo${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ""}`)); };
  return <header className="els-header"><div className="els-announcement">Delicadeza nos detalhes. Liberdade nas escolhas.</div><div className="els-wrap els-header-main"><div className="els-header-left"><button type="button" className="els-icon els-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => { setMenu((value) => !value); setFind(false); }}>{menu ? <X size={21} /> : <Menu size={21} />}</button><nav className="els-main-nav" aria-label="Principal">{links.map((link) => <Link key={link.to} to={link.to} aria-current={link.on ? "page" : undefined}>{link.label}</Link>)}</nav></div><Link className="els-brand" to={path()} aria-label={`${tenant.name} - página inicial`}>{tenant.logo_url && <img src={tenant.logo_url} alt="" />}<span>{tenant.name}<small>Vista a sua essência</small></span></Link><div className="els-header-tools"><button type="button" className="els-icon" aria-label="Buscar" aria-expanded={find} onClick={() => { setFind((value) => !value); setMenu(false); }}><Search size={19} strokeWidth={1.3} /></button><button type="button" className="els-header-bag" onClick={openCart} aria-label={`Abrir sacola, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`}><ShoppingBag size={19} strokeWidth={1.3} /><span>{hidden || !cartCount ? "Sacola" : money(cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0))}</span><b>{cartCount}</b></button></div></div>
    {find && <form className="els-panel els-find" role="search" onSubmit={submit}><SearchField value={term} onChange={setTerm} placeholder="Encontre sua próxima peça favorita" label="Buscar peças" autoFocus /><button type="submit" className="els-btn">Buscar</button></form>}
    {menu && <div className="els-panel els-drawer"><span className="els-kicker">Explore o seu estilo</span><nav aria-label="Menu">{links.map((link) => <Link key={link.to} to={link.to} aria-current={link.on ? "page" : undefined}>{link.label}<ArrowUpRight size={17} /></Link>)}</nav>{cats.length > 0 && <div className="els-menu-categories">{cats.map((category) => <Link key={category.id} to={path(`/catalogo?categoria=${category.id}`)}>{category.name}</Link>)}</div>}</div>}
  </header>;
}

export function Footer() {
  const { tenant, sf, path, categories, active, cartCount, openCart } = useKit();
  const { pathname } = useLocation();
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const hours = hoursLines(tenant.business_hours);
  const cats = categories.filter((category) => active.some((p) => p.category_id === category.id)).slice(0, 5);
  return <footer className={`els-footer ${/produto/.test(pathname) ? "has-buy-bar" : ""}`}><div className="els-wrap els-footer-title"><span className="els-kicker">Escolhas para acompanhar você</span><Link to={path()}>{tenant.name}</Link><p>{tenant.footer_text || tenant.about_text || "Uma coleção de possibilidades para vestir quem você é."}</p></div><div className="els-wrap els-footer-grid"><section><h2>Explore</h2><Link to={path()}>Início</Link><Link to={path("/catalogo")}>A coleção completa</Link><Link to={path("/sobre")}>Nossa história</Link>{cats.map((category) => <Link key={category.id} to={path(`/catalogo?categoria=${category.id}`)}>{category.name}</Link>)}</section><section><h2>Vamos conversar?</h2>{wa && <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={14} />{tenant.whatsapp}</a>}{tenant.show_address && tenant.address && <p><MapPin size={14} />{tenant.address}</p>}<div className="els-social">{tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={17} /></a>}{tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={17} /></a>}{wa && <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={17} /></a>}</div></section><section><h2>Um encontro com a marca</h2>{hours.length ? hours.map((hour) => <p key={hour.day}><Clock3 size={13} />{hour.day}: {hour.text}</p>) : <p>Converse com a equipe e conheça nossas peças.</p>}<Link className="els-text-link" to={path("/sobre")}>Conheça os detalhes <ArrowUpRight size={14} /></Link></section></div><div className="els-wrap els-credit"><span>© {new Date().getFullYear()} {tenant.name}</span><span>Feito para o seu jeito de ser. · <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a></span></div>
    {wa && sf.show_whatsapp_widget !== false && !/produto/.test(pathname) && <a className="els-contact-float" href={wa} target="_blank" rel="noreferrer" aria-label="Conversar com a loja no WhatsApp"><MessageCircle size={20} strokeWidth={1.4} /></a>}
    <nav className="els-bottom-nav" aria-label="Navegação do celular"><Link to={path()} aria-current={!/catalogo|produto|sobre/.test(pathname) ? "page" : undefined}><Home size={19} strokeWidth={1.4} /><span>Início</span></Link><Link to={path("/catalogo")} aria-current={/catalogo|produto/.test(pathname) ? "page" : undefined}><Grid2X2 size={19} strokeWidth={1.4} /><span>Coleção</span></Link><Link to={path("/sobre")} aria-current={/sobre/.test(pathname) ? "page" : undefined}><Sparkles size={19} strokeWidth={1.4} /><span>A marca</span></Link><button type="button" onClick={openCart} aria-label={`Abrir sacola, ${cartCount} itens`}><span className="els-bottom-bag"><ShoppingBag size={19} strokeWidth={1.4} />{cartCount > 0 && <b>{cartCount}</b>}</span><span>Sacola</span></button></nav>
  </footer>;
}
