import { Flame, History, Info, Search } from "lucide-react";
import type { MenuSection, MenuTenant, Route } from "../menuTypes";
import { catStyle } from "../menuTypes";
import { Logo, StatusChips } from "./parts";

interface HeroProps {
  tenant: MenuTenant;
  status: { open: boolean; text: string } | null;
  route: Route;
  mesa: string;
  search: string;
  onSearch: (v: string) => void;
  onOrders: () => void;
  onInfo: () => void;
}

/** Topo do celular: logo, status, atalhos e busca (some no tablet/computador, onde a lateral assume). */
export function Hero({ tenant, status, route, mesa, search, onSearch, onOrders, onInfo }: HeroProps) {
  return (
    <section className="mnu-hero">
      {tenant.banner_url && <div className="mnu-hero-bg" style={{ backgroundImage: `url(${tenant.banner_url})` }} />}
      <div className="mnu-wrap">
        <Logo tenant={tenant} />
        <h1 className="mnu-title">{tenant.name}</h1>
        {(tenant.hero_tagline || tenant.about_text) && <p className="mnu-sub">{(tenant.hero_tagline || tenant.about_text || "").slice(0, 120)}</p>}
        <StatusChips status={status} route={route} mesa={mesa} />
        <div className="mnu-actions">
          <button type="button" className="mnu-action" onClick={onOrders}><span className="ic"><History size={16} /></span>Meus Pedidos</button>
          <button type="button" className="mnu-action" onClick={onInfo}><span className="ic"><Info size={16} /></span>Info da Loja</button>
        </div>
        <div className="mnu-search"><Search size={18} /><input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Buscar no cardápio..." aria-label="Buscar no cardápio" /></div>
      </div>
    </section>
  );
}

/** Abas de categoria do celular (rolagem horizontal, fixas no topo ao rolar). */
export function CategoryTabs({ sections, active, onGo }: { sections: MenuSection[]; active: string; onGo: (id: string) => void }) {
  return (
    <div className="mnu-bar"><div className="mnu-wrap"><div className="mnu-tabs" role="tablist">
      {sections.map((s) => {
        const TI = catStyle(s.name).icon;
        return <button key={s.id} type="button" className={`mnu-tab ${active === s.id ? "is-on" : ""}`} onClick={() => onGo(s.id)}><TI size={15} />{s.name}</button>;
      })}
    </div></div></div>
  );
}

interface SidebarProps {
  tenant: MenuTenant;
  status: { open: boolean; text: string } | null;
  route: Route;
  mesa: string;
  sections: MenuSection[];
  hasFeatured: boolean;
  active: string;
  onGo: (id: string) => void;
  onOrders: () => void;
  onInfo: () => void;
}

/** Menu fixo na lateral (tablet e computador): marca, status, categorias e atalhos sempre à vista. */
export function Sidebar({ tenant, status, route, mesa, sections, hasFeatured, active, onGo, onOrders, onInfo }: SidebarProps) {
  return (
    <aside className="mnu-side">
      <div className="mnu-side-brand">
        <Logo tenant={tenant} size={64} />
        <div>
          <h1>{tenant.name}</h1>
          {tenant.hero_tagline && <p>{tenant.hero_tagline.slice(0, 60)}</p>}
        </div>
      </div>
      <StatusChips status={status} route={route} mesa={mesa} />
      <nav className="mnu-side-nav" aria-label="Categorias">
        {hasFeatured && (
          <button type="button" className={`mnu-nav ${active === "featured" ? "is-on" : ""}`} onClick={() => onGo("featured")}>
            <span className="ic" style={{ background: "#ffe6d3", color: "#ea580c" }}><Flame size={17} /></span><span className="lb">Destaques</span>
          </button>
        )}
        {sections.map((s) => {
          const st = catStyle(s.name);
          const I = st.icon;
          return (
            <button key={s.id} type="button" className={`mnu-nav ${active === s.id ? "is-on" : ""}`} onClick={() => onGo(s.id)}>
              <span className="ic" style={{ background: st.tint, color: st.fg }}><I size={17} /></span>
              <span className="lb">{s.name}</span>
              <span className="n">{s.items.length}</span>
            </button>
          );
        })}
      </nav>
      <div className="mnu-side-foot">
        <button type="button" onClick={onOrders}><History size={16} />Meus Pedidos</button>
        <button type="button" onClick={onInfo}><Info size={16} />Info da Loja</button>
      </div>
    </aside>
  );
}
