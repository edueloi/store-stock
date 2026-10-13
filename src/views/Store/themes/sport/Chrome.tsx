import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Facebook, Instagram, Menu, MessageCircle, Search, ShoppingBag, X } from "lucide-react";
import { useKit } from "./lib";
import "./styles.css";
import "./v3.css";

const days: Record<string,string> = {seg:"Seg",ter:"Ter",qua:"Qua",qui:"Qui",sex:"Sex",sab:"Sáb",dom:"Dom"};
export function Header() {
  const { tenant, cart, openCart, path, sf } = useKit();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);
  const [q, setQ] = useState("");
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const pages = [{name:"Início",to:path()},{name:"Catálogo",to:path("/catalogo")},{name:"Nossa loja",to:path("/sobre")}];
  const submit = (e: FormEvent) => {e.preventDefault();navigate(path(q.trim() ? `/catalogo?q=${encodeURIComponent(q.trim())}` : "/catalogo"));setDrawer(false);};
  useEffect(() => {setDrawer(false);}, [pathname,search]);
  useEffect(() => {if (!drawer) return;const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape"){setDrawer(false);}};document.addEventListener("keydown",onKey);return()=>document.removeEventListener("keydown",onKey);},[drawer]);
  return <header className="sport-header sport-v3-header">
    <div className="sv3-announcement"><div className="sport-wrap"><span>{sf.segment_label || "MOVIMENTO • PERFORMANCE • ESTILO"}</span><span className="sv3-announcement-right">{tenant.hero_tagline || "Equipamentos e artigos para o seu esporte"}</span></div></div>
    <div className="sport-wrap sv3-header-main">
      <Link to={path()} className="sv3-logo" aria-label={`${tenant.name} — início`}>{tenant.logo_url && <img src={tenant.logo_url} alt="" />}<strong>{tenant.name}</strong>{!tenant.logo_url && <span className="sv3-logo-mark">/</span>}</Link>
      <nav className="sv3-navigation" aria-label="Navegação principal">{pages.map(p=><Link key={p.name} to={p.to} aria-current={pathname===p.to.split("?")[0]?"page":undefined}>{p.name}</Link>)}</nav>
      <form className="sv3-header-search" role="search" onSubmit={submit}><Search size={19}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="O que você procura?" aria-label="Buscar produtos"/><button type="submit" aria-label="Pesquisar"><ArrowRight size={19}/></button></form>
      <button className="sv3-cart" type="button" onClick={openCart} aria-label={`Abrir carrinho com ${count} itens`}><ShoppingBag size={21}/><span>Carrinho</span><b>{count}</b></button>
      <button className="sv3-menu-trigger" onClick={()=>setDrawer(true)} type="button" aria-label="Abrir menu"><Menu size={25}/></button>
    </div>
    {drawer && <div className="sv3-drawer-backdrop" onClick={()=>setDrawer(false)}><aside className="sv3-drawer" role="dialog" aria-modal="true" aria-label="Menu" onClick={e=>e.stopPropagation()}><div className="sv3-drawer-heading"><strong>{tenant.name}</strong><button onClick={()=>setDrawer(false)} aria-label="Fechar menu"><X size={24}/></button></div><form onSubmit={submit} className="sv3-drawer-search"><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar produtos"/><button type="submit" aria-label="Buscar"><ArrowRight size={18}/></button></form><nav aria-label="Navegação móvel">{pages.map((p,i)=><Link key={p.name} to={p.to}><small>0{i+1}</small>{p.name}<ArrowRight size={20}/></Link>)}</nav></aside></div>}
  </header>;
}
export function Footer(){const {tenant,usedCategories,path,sf}=useKit();const wa=(tenant.whatsapp||"").replace(/\D/g,"");const hours=Object.entries(tenant.business_hours||{}).filter(([,h])=>!!h);return <footer className="sport-footer sv3-footer"><div className="sport-wrap"><div className="sv3-footer-cta"><div><small>PRONTO PARA O PRÓXIMO NÍVEL?</small><h2>{sf.hero_button_label || "Seu próximo desafio começa aqui."}</h2></div><Link to={path("/catalogo")} className="sv3-primary">Explorar catálogo <ArrowRight size={19}/></Link></div><div className="sv3-footer-columns"><section><h3>{tenant.name}</h3><p>{tenant.footer_text||tenant.about_text||"Tudo para acompanhar seu movimento."}</p>{tenant.show_address && tenant.address && <p>{tenant.address}</p>}</section><section><h3>Navegação</h3><Link to={path()}>Início</Link><Link to={path("/catalogo")}>Catálogo</Link><Link to={path("/sobre")}>Nossa loja</Link></section><section><h3>Categorias</h3>{usedCategories.slice(0,4).map(c=><Link to={path(`/catalogo?cat=${c.id}`)} key={c.id}>{c.name}</Link>)}<Link to={path("/catalogo")}>Explorar todas →</Link></section><section><h3>Atendimento</h3>{wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle size={15}/> WhatsApp</a>}{tenant.instagram_url && <a href={tenant.instagram_url} target="_blank" rel="noreferrer"><Instagram size={15}/> Instagram</a>}{tenant.facebook_url && <a href={tenant.facebook_url} target="_blank" rel="noreferrer"><Facebook size={15}/> Facebook</a>}{hours.length>0 && <div className="sv3-hours">{hours.map(([d,h])=><p key={d}>{days[d]||d}: {h.closed?"Fechado":`${h.open}–${h.close}`}</p>)}</div>}</section></div><div className="sv3-footer-bottom"><span>© {new Date().getFullYear()} {tenant.name}</span><span>Powered by <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">BoxSys</a></span></div></div></footer>}
