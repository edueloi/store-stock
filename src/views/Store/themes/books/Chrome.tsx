import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BookOpen, ChevronDown, Clock, Facebook, Instagram, MapPin, Menu, MessageCircle, Search, ShoppingBag, X } from "lucide-react";
import { hoursLines, useKit, whatsappLink } from "./kit";
import "./styles.css";

function Brand({ foot = false }: { foot?: boolean }) {
  const { tenant, path } = useKit();
  return (
    <Link className={`bk-brand ${foot ? "bk-brand-foot" : ""}`} to={path()} aria-label={`${tenant.name} - página inicial`}>
      {tenant.logo_url ? <img src={tenant.logo_url} alt="" /> : <BookOpen size={26} aria-hidden="true" />}
      <span>{tenant.name}</span>
    </Link>
  );
}

export function Header() {
  const { categories, active, openCart, cartCount, path } = useKit();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [genres, setGenres] = useState(false);
  const [term, setTerm] = useState("");
  const used = categories
    .map((c) => ({ ...c, total: active.filter((p) => p.category_id === c.id).length }))
    .filter((c) => c.total > 0)
    .slice(0, 16);
  const close = () => {
    setMenu(false);
    setGenres(false);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    close();
    navigate(path(`/catalogo${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ""}`));
  };
  return (
    <header className="bk-header">
      <div className="bk-top">
        <Brand />
        <form className="bk-search" role="search" onSubmit={submit}>
          <Search size={19} aria-hidden="true" />
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Busque por título, autor ou código" aria-label="Buscar livros" />
          <button type="submit">Buscar</button>
        </form>
        <button type="button" className="bk-cart" aria-label={`Abrir sacola, ${cartCount} ${cartCount === 1 ? "item" : "itens"}`} onClick={openCart}>
          <ShoppingBag size={21} />
          <span>{cartCount}</span>
        </button>
        <button type="button" className="bk-burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          {menu ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      <nav className="bk-nav" aria-label="Principal">
        <div>
          <Link to={path()} aria-current={!/catalogo|sobre|produto/.test(pathname) ? "page" : undefined}>
            Início
          </Link>
          <Link to={path("/catalogo")} aria-current={/catalogo|produto/.test(pathname) ? "page" : undefined}>
            Todos os livros
          </Link>
          {used.length > 0 && (
            <button type="button" aria-expanded={genres} aria-controls="bk-genres" onClick={() => setGenres((v) => !v)}>
              Gêneros <ChevronDown size={16} aria-hidden="true" />
            </button>
          )}
          <Link to={path("/sobre")} aria-current={/sobre/.test(pathname) ? "page" : undefined}>
            A livraria
          </Link>
        </div>
      </nav>
      {genres && (
        <div id="bk-genres" className="bk-genres">
          <div>
            <p>Navegue pelos gêneros</p>
            <ul>
              {used.map((c) => (
                <li key={c.id}>
                  <Link to={path(`/catalogo?categoria=${c.id}`)} onClick={close}>
                    <span>{c.name}</span>
                    <small>{c.total}</small>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {menu && (
        <div className="bk-drawer">
          <nav aria-label="Menu">
            <Link to={path()} onClick={close}>
              Início
            </Link>
            <Link to={path("/catalogo")} onClick={close}>
              Todos os livros
            </Link>
            <Link to={path("/sobre")} onClick={close}>
              A livraria
            </Link>
          </nav>
          {used.length > 0 && (
            <>
              <p className="bk-drawer-title">Gêneros</p>
              <div className="bk-drawer-grid">
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
    </header>
  );
}

export function Footer() {
  const { tenant, categories, active, path } = useKit();
  const hours = hoursLines(tenant.business_hours);
  const wa = whatsappLink(tenant.whatsapp, `Olá! Vim pela loja ${tenant.name}.`);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id)).slice(0, 6);
  return (
    <footer className="bk-footer">
      <div className="bk-footer-inner">
        <section className="bk-foot-card bk-foot-about">
          <Brand foot />
          <p>{tenant.footer_text || tenant.about_text || "Boas histórias merecem boas estantes. Encontre o seu próximo livro."}</p>
          <div className="bk-social">
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
        <section className="bk-foot-card">
          <h2>Gêneros</h2>
          <Link to={path("/catalogo")}>Todos os livros</Link>
          {cats.map((c) => (
            <Link key={c.id} to={path(`/catalogo?categoria=${c.id}`)}>
              {c.name}
            </Link>
          ))}
        </section>
        <section className="bk-foot-card">
          <h2>Fale com a livraria</h2>
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
            <dl className="bk-hours">
              <dt className="bk-hours-title">
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
      <p className="bk-credit">
        © {new Date().getFullYear()} {tenant.name} · Desenvolvido por{" "}
        <a href="https://boxsys.com.br" target="_blank" rel="noreferrer">
          BoxSys
        </a>
      </p>
    </footer>
  );
}
