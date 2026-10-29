import { ArrowRight, Bike, Check, Clock3, History, Info, MapPin, Search, ShoppingBag, Store, UtensilsCrossed } from "lucide-react";
import type { MenuConfig, MenuSection, MenuTenant, Receive, Route } from "../menuTypes";
import { catStyle, money } from "../menuTypes";
import { Logo, StatusChips } from "./parts";

interface HeroProps {
  tenant: MenuTenant;
  status: { open: boolean; text: string } | null;
  route: Route;
  mesa: string;
  search: string;
  onSearch: (value: string) => void;
  onOrders: () => void;
  onInfo: () => void;
}

export function Hero({ tenant, status, route, mesa, search, onSearch, onOrders, onInfo }: HeroProps) {
  return <header className="mnu-hero"><div className="mnu-wrap">
    <div className="mnu-brand-row"><div className="mnu-brand"><Logo tenant={tenant} /><div><span className="mnu-eyebrow">{route === "mesa" ? "Cardápio da casa" : route === "balcao" ? "Peça e retire aqui" : "Entrega e retirada"}</span><h1 className="mnu-title">{tenant.name}</h1><StatusChips status={status} route={route} mesa={mesa} /></div></div><div className="mnu-actions"><button type="button" className="mnu-action" aria-label="Meus pedidos" onClick={onOrders}><History size={17} /><span>Meus pedidos</span></button><button type="button" className="mnu-action" aria-label="Sobre a loja" onClick={onInfo}><Info size={17} /><span>Sobre a loja</span></button></div></div>
    <label className="mnu-search"><Search size={18} /><input type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Encontre algo no cardápio" aria-label="Buscar no cardápio" /></label>
  </div></header>;
}

export function MenuIntro({ route, mesa, guest, people, cfg, receive, accepts, onReceive }: {
  route: Route; mesa: string; guest?: string; people?: number; cfg: MenuConfig; receive: Receive;
  accepts: { delivery: boolean; pickup: boolean }; onReceive: (value: Receive) => void;
}) {
  if (route === "mesa") return <section className="mnu-intro mnu-table-intro"><div><span className="mnu-eyebrow">{guest ? `Seja bem-vindo, ${guest}` : "Fique à vontade"}</span><h2>Bom encontro.<br />Boa escolha.</h2><p>Escolha com calma e envie seu pedido à equipe.<br />Os pedidos da mesa ficam na mesma comanda.</p></div><div className="mnu-table-number"><UtensilsCrossed size={20} strokeWidth={1.3} /><span>Mesa</span><strong>{mesa.padStart(2, "0")}</strong><small>{people || 1} {(people || 1) === 1 ? "pessoa" : "pessoas"}</small></div></section>;
  if (route === "balcao") return <section className="mnu-intro mnu-counter-intro"><span className="mnu-eyebrow"><Store size={14} /> Pedido no balcão {guest ? `· ${guest}` : ""}</span><h2>Seu pedido, sem complicação.</h2><p>Escolha os itens e acompanhe a retirada no balcão.</p><div className="mnu-counter-steps"><span><b>1</b> Escolha</span><ArrowRight size={13} /><span><b>2</b> Confira</span><ArrowRight size={13} /><span><b>3</b> Retire aqui</span>{cfg.pickup_eta && <small><Clock3 size={13} /> {cfg.pickup_eta}</small>}</div></section>;
  const delivery = cfg.delivery || {};
  return <section className="mnu-intro mnu-delivery-intro"><div><span className="mnu-eyebrow">Feito para o seu dia</span><h2>O que vai ser hoje?</h2><p>Escolha seus favoritos. A gente cuida do seu pedido.</p></div><div className="mnu-service"><div className="mnu-service-toggle" role="group" aria-label="Como receber o pedido">{accepts.delivery && <button type="button" aria-pressed={receive === "delivery"} onClick={() => onReceive("delivery")}><Bike size={16} /> Entrega {receive === "delivery" && <Check size={13} />}</button>}{accepts.pickup && <button type="button" aria-pressed={receive === "pickup"} onClick={() => onReceive("pickup")}><Store size={15} /> Retirar na loja {receive === "pickup" && <Check size={13} />}</button>}</div><div className="mnu-service-meta">{receive === "delivery" ? <>{delivery.eta && <span><Clock3 size={13} />{delivery.eta}</span>}<span><MapPin size={13} />{delivery.fee_mode === "neighborhood" ? "Taxa por bairro" : `Entrega ${money(Math.max(0, Number(delivery.fixed_fee) || 0))}`}</span></> : <span><Store size={13} />{cfg.pickup_eta ? `Retirada · ${cfg.pickup_eta}` : "Retirada no estabelecimento"}</span>}</div></div></section>;
}

export function CategoryTabs({ sections, active, onGo }: { sections: MenuSection[]; active: string; onGo: (id: string) => void }) {
  return <nav className="mnu-bar" aria-label="Categorias do cardápio"><div className="mnu-wrap"><div className="mnu-tabs">{sections.map((section) => <button key={section.id} type="button" className={`mnu-tab ${active === section.id ? "is-on" : ""}`} aria-current={active === section.id ? "true" : undefined} onClick={() => onGo(section.id)}>{section.name}</button>)}</div></div></nav>;
}

interface SidebarProps {
  tenant: MenuTenant; status: { open: boolean; text: string } | null; route: Route; mesa: string; sections: MenuSection[];
  hasFeatured: boolean; active: string; onGo: (id: string) => void; onOrders: () => void; onInfo: () => void;
}
export function Sidebar({ tenant, status, route, mesa, sections, active, onGo, onOrders, onInfo }: SidebarProps) {
  return <aside className="mnu-side"><div className="mnu-side-brand"><Logo tenant={tenant} /><div><span className="mnu-eyebrow">Cardápio digital</span><h1>{tenant.name}</h1></div></div><StatusChips status={status} route={route} mesa={mesa} /><div className="mnu-nav-label">Explore o cardápio</div><nav className="mnu-side-nav" aria-label="Categorias">{sections.map((section) => {
    const Icon = catStyle(section.name).icon;
    return <button type="button" key={section.id} className={`mnu-nav ${active === section.id ? "is-on" : ""}`} aria-current={active === section.id ? "true" : undefined} onClick={() => onGo(section.id)}><Icon size={18} strokeWidth={1.5} /><span className="lb">{section.name}</span><span className="n">{section.items.length}</span></button>;
  })}</nav><div className="mnu-side-foot"><div><Store size={18} /><span>Pedido no balcão<small>Escolha aqui. Retire com a equipe.</small></span></div><button type="button" onClick={onOrders}><History size={16} />Meus pedidos</button><button type="button" onClick={onInfo}><Info size={16} />Sobre a loja</button></div></aside>;
}
