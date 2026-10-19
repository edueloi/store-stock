import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import SiteFooter from "../street/SiteFooter";
import { useHeaderState } from "../street/shared";
import "./styles.css";

export function Header() {
  const h = useHeaderState();
  const { search } = useLocation();
  const [searching, setSearching] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setSearching(false), [h.pathname, search]);
  useEffect(() => {
    if (searching) input.current?.focus();
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") { setSearching(false); h.setMenu(false); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [searching, h.setMenu]);
  const nav = [
    { name: "Início", to: h.path(), on: !/catalogo|sobre|produto/.test(h.pathname) },
    { name: "A coleção", to: h.path("/catalogo"), on: /catalogo|produto/.test(h.pathname) },
    { name: "Nossa essência", to: h.path("/sobre"), on: /sobre/.test(h.pathname) },
  ];
  return <header className="sw-header">
    <div className="sw-top">
      <button type="button" className="sw-iconbtn sw-burger" aria-label={h.menu ? "Fechar menu" : "Abrir menu"} aria-expanded={h.menu} onClick={() => h.setMenu(!h.menu)}>{h.menu ? <X size={21} /> : <Menu size={21} />}</button>
      <Link className="sw-brand" to={h.path()} aria-label={`${h.tenant.name} - página inicial`}>{h.tenant.logo_url && <img src={h.tenant.logo_url} alt="" />}<span>{h.tenant.name}</span></Link>
      <nav className="sw-nav" aria-label="Navegação principal">{nav.map(l => <Link key={l.to} to={l.to} aria-current={l.on ? "page" : undefined}>{l.name}</Link>)}</nav>
      <div className="sw-header-actions"><button type="button" className="sw-iconbtn" aria-label="Buscar produtos" aria-expanded={searching} onClick={() => setSearching(!searching)}>{searching ? <X size={20} /> : <Search size={20} />}</button><button type="button" className="sw-cart" aria-label={`Abrir sacola, ${h.cartCount} ${h.cartCount === 1 ? "item" : "itens"}`} onClick={h.openCart}><ShoppingBag size={20} /><span className="sw-cart-label">Sacola</span><span className="sw-cart-count">{h.cartCount}</span></button></div>
    </div>
    {searching && <form className="sw-search" role="search" onSubmit={h.submit}><Search size={19} aria-hidden="true" /><input ref={input} type="search" value={h.term} onChange={e => h.setTerm(e.target.value)} placeholder="O que você procura?" aria-label="Buscar produtos" /><button type="submit">Buscar</button></form>}
    {h.menu && <div className="sw-drawer" role="dialog" aria-label="Menu da loja" aria-modal="true"><button type="button" className="sw-drawer-bg" aria-label="Fechar menu" onClick={() => h.setMenu(false)} /><div className="sw-drawer-panel"><div className="sw-drawer-top"><strong>{h.tenant.name}</strong><button type="button" className="sw-iconbtn" aria-label="Fechar menu" onClick={() => h.setMenu(false)}><X size={21} /></button></div><nav className="sw-drawer-nav" aria-label="Menu móvel">{nav.map(l => <Link key={l.to} to={l.to} aria-current={l.on ? "page" : undefined}>{l.name}</Link>)}</nav></div></div>}
  </header>;
}

export function Footer() {
  return <SiteFooter t="sw" showCategories={false} tagline="Streetwear e skate fazem parte de um jeito livre de viver. Reunimos camisetas, calçados e peças versáteis para o seu dia a dia, com espaço para a sua personalidade e para os caminhos que você escolher." />;
}
