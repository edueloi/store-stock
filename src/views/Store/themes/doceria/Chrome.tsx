import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CakeSlice, Clock, Facebook, Instagram, MapPin, Menu, MessageCircle, Search, ShoppingBag, X } from "lucide-react";
import { hoursLines, useKit, whatsappLink } from "./kit";
import "./styles.css";

function Brand({ foot = false }: { foot?: boolean }) {
  const { tenant, path } = useKit();
  return (
    <Link className={`dc-brand ${foot ? "dc-brand-foot" : ""}`} to={path()} aria-label={`${tenant.name} - página inicial`}>
      {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <CakeSlice size={26} aria-hidden="true" />}
      <span>{tenant.name}</span>
    </Link>
  );
}

export function Header() {
  const { categories, active, openCart, cartCount, path } = useKit();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [flavors, setFlavors] = useState(false);
  const [term, setTerm] = useState("");
  const used = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 12);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setMenu(false);
    setFlavors(false);
    navigate(path(`/catalogo${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ""}`));
  };
  const close = () => {
    setMenu(false);
    setFlavors(false);
  };
  return (
    <header className="dc-header">
      <div className="dc-bar">
        <nav className="dc-nav" aria-label="Principal">
          <Link to={path()} aria-current={!/catalogo|sobre|produto/.test(pathname) ? "page" : undefined}>
            Início
          </Link>
          <Link to={path("/catalogo")} aria-current={/catalogo|produto/.test(pathname) ? "page" : undefined}>
            Doces
          </Link>
          {used.length > 0 && (
            <button type="button" aria-expanded={flavors} aria-controls="dc-flavors" onClick={() => setFlavors((v) => !v)}>
              Sabores
            </button>
          )}
          <Link to={path("/sobre")} aria-current={/sobre/.test(pathname) ? "page" : undefined}>
            Nossa história
          </Link>
        </nav>
        <Brand />
        <div className="dc-tools">
          <form className="dc-search" role="search" onSubmit={submit}>
            <Search size={18} aria-hidden="true" />
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar um doce" aria-label="Buscar um doce" />
          </form>
          <button type="button" className="dc-cart" aria-label={`Abrir sacola, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`} onClick={openCart}>
            <ShoppingBag size={22} />
            <span>{cartCount}</span>
          </button>
          <button type="button" className="dc-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
            {menu ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
      {flavors && (
        <div id="dc-flavors" className="dc-flavors">
          <p>Escolha pelo sabor</p>
          <div>
            {used.map((c) => (
              <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)} onClick={close}>
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      )}
      {menu && (
        <div className="dc-drawer">
          <form className="dc-search" role="search" onSubmit={submit}>
            <Search size={18} aria-hidden="true" />
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar um doce" aria-label="Buscar um doce" />
          </form>
          <nav aria-label="Menu">
            <Link to={path()} onClick={close}>
              Início
            </Link>
            <Link to={path("/catalogo")} onClick={close}>
              Todos os doces
            </Link>
            <Link to={path("/sobre")} onClick={close}>
              Nossa história
            </Link>
          </nav>
          {used.length > 0 && (
            <>
              <p className="dc-drawer-title">Sabores</p>
              <div className="dc-drawer-chips">
                {used.map((c) => (
                  <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)} onClick={close}>
                    {c.name}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      <i className="dc-drip" aria-hidden="true" />
    </header>
  );
}

export function Footer() {
  const { tenant, categories, active, path } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 6);
  return (
    <footer className="dc-footer">
      <i className="dc-wave" aria-hidden="true" />
      <div className="dc-footer-inner">
        <section className="dc-foot-card dc-foot-about">
          <Brand foot />
          <p>{tenant.footer_text || tenant.about_text || "Doces feitos com carinho, do jeitinho que você gosta."}</p>
          <div className="dc-social">
            {tenant.instagram_url && (
              <a href={tenant.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram">
                <Instagram size={20} />
              </a>
            )}
            {tenant.facebook_url && (
              <a href={tenant.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook">
                <Facebook size={20} />
              </a>
            )}
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp">
                <MessageCircle size={20} />
              </a>
            )}
          </div>
        </section>
        <section className="dc-foot-card">
          <h2>Nosso cardápio</h2>
          <Link to={path("/catalogo")}>Todos os doces</Link>
          {cats.map((c) => (
            <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>
              {c.name}
            </Link>
          ))}
          <Link to={path("/sobre")}>Nossa história</Link>
        </section>
        <section className="dc-foot-card">
          <h2>Fale com a gente</h2>
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer">
              <MessageCircle size={16} /> {tenant.whatsapp}
            </a>
          )}
          {tenant.show_address && tenant.address && (
            <p>
              <MapPin size={16} /> {tenant.address}
            </p>
          )}
          {hours.length > 0 && (
            <dl className="dc-hours">
              <dt className="dc-hours-title">
                <Clock size={15} /> Horários
              </dt>
              {hours.map((h) => (
                <div key={h.day}>
                  <dt>{h.day}</dt>
                  <dd>{h.text}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>
      <p className="dc-credit">
        © {new Date().getFullYear()} {tenant.name} · Desenvolvido por{" "}
        <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">
          BoxSys
        </a>
      </p>
    </footer>
  );
}
