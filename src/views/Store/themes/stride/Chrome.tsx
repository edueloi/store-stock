import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight, Menu, Search, ShoppingBag, X } from "lucide-react";
import { useHeaderState } from "../street/shared";
import SiteFooter from "../street/SiteFooter";
import "./styles.css";

export function Header() {
  const h = useHeaderState();
  const { search } = useLocation();
  const [searching, setSearching] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setSearching(false), [h.pathname, search]);
  useEffect(() => {
    if (searching) input.current?.focus();
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setSearching(false); h.setMenu(false); }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [searching, h.setMenu]);
  return (
    <header className="sr-header">
      <div className="sr-announcement"><span>SEU ESTILO. SEU MOVIMENTO.</span><Link to={h.path("/catalogo")}>Explore a coleção <ArrowUpRight size={12} /></Link></div>
      <div className="sr-bar">
        <button className="sr-icon sr-burger" type="button" aria-label={h.menu ? "Fechar menu" : "Abrir menu"} aria-expanded={h.menu} onClick={() => h.setMenu(!h.menu)}>{h.menu ? <X /> : <Menu />}</button>
        <Link className="sr-brand" to={h.path()} aria-label={`${h.tenant.name} - página inicial`}>
          {h.tenant.logo_url ? <img src={h.tenant.logo_url} alt="" /> : <span className="sr-brand-mark" aria-hidden="true">↗</span>}
          <span>{h.tenant.name}</span>
        </Link>
        <nav className="sr-nav" aria-label="Navegação principal">
          <Link to={h.path("/catalogo")} aria-current={h.pathname.includes("/catalogo") ? "page" : undefined}>Explorar</Link>
          {h.used.slice(0, 3).map(c => <Link key={c.id} to={h.path(`/catalogo?categoria=${c.id}`)}>{c.name}</Link>)}
          <Link to={h.path("/sobre")}>Nossa essência</Link>
        </nav>
        <div className="sr-actions">
          <button className="sr-icon" type="button" aria-label="Buscar produtos" aria-expanded={searching} onClick={() => setSearching(!searching)}>{searching ? <X size={21} /> : <Search size={21} />}</button>
          <button className="sr-icon sr-bag" type="button" aria-label={`Abrir sacola, ${h.cartCount} itens`} onClick={h.openCart}><ShoppingBag size={21} /><span>{h.cartCount}</span></button>
        </div>
      </div>
      {searching && <form className="sr-header-search" role="search" onSubmit={h.submit}>
        <Search size={20} /><input ref={input} type="search" value={h.term} onChange={e => h.setTerm(e.target.value)} placeholder="Encontre seu próximo favorito" aria-label="Buscar produtos" /><button className="sr-btn sr-btn-solid" type="submit">Buscar</button>
      </form>}
      {h.menu && <div className="sr-mobile-menu" role="dialog" aria-label="Menu da loja" aria-modal="true">
        <button type="button" className="sr-menu-backdrop" aria-label="Fechar menu" onClick={() => h.setMenu(false)} />
        <nav aria-label="Menu móvel">
          <div className="sr-menu-title"><strong>Explore a loja</strong><button type="button" className="sr-icon" aria-label="Fechar menu" onClick={() => h.setMenu(false)}><X /></button></div>
          <Link to={h.path()}>Início <ArrowUpRight /></Link><Link to={h.path("/catalogo")}>Toda a coleção <ArrowUpRight /></Link>
          {h.used.map(c => <Link key={c.id} to={h.path(`/catalogo?categoria=${c.id}`)}>{c.name} <ArrowUpRight /></Link>)}
          <Link to={h.path("/sobre")}>Nossa essência <ArrowUpRight /></Link>
        </nav>
      </div>}
    </header>
  );
}

export function Footer() {
  return <SiteFooter t="sr" tagline="Camisetas, tênis e roupas para viver o seu próprio ritmo. O próximo movimento é seu." />;
}
