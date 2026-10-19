import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, MessageCircle, Package, Sparkles } from "lucide-react";
import { gsap } from "gsap";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { StoreButton } from "../../../../components/store/StoreButton";
import { useStore } from "../../StoreLayout";
import { productRouteSegment } from "../../store-routing";
import { Card, PERKS, Price } from "./parts";
import { groups, imageOf, money, pricesHidden, unitPrice, useTheme, waLink } from "./lib";
import "./styles.css";

export default function StoreFront() {
  const { tenant, products, categories } = useStore();
  const { path } = useTheme();
  const sf = tenant.policies?.storefront || {};
  const root = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<number | null>(null);
  const hidden = pricesHidden(tenant);

  const active = useMemo(() => products.filter((p) => p.is_active && p.type !== "internal"), [products]);
  const featured = useMemo(() => {
    const f = active.filter((p) => p.is_featured);
    return f.length ? f : active;
  }, [active]);
  const hero = featured.find((p) => imageOf(p)) || featured[0];
  const launches = useMemo(() => [...active].sort((a, b) => b.id - a.id).slice(0, 10), [active]);
  const compare = useMemo(() => featured.filter((p) => imageOf(p)).slice(0, 3), [featured]);
  const cats = useMemo(
    () =>
      categories
        .map((c) => ({ ...c, items: active.filter((p) => p.category_id === c.id) }))
        .filter((c) => c.items.length > 0),
    [categories, active],
  );
  const currentTab = cats.find((c) => c.id === tab) || cats[0];
  const title = tenant.hero_tagline || "Tecnologia que combina com o seu ritmo.";
  const marquee = [...cats.map((c) => c.name), "Garantia", "Suporte especializado", "Entrega"].slice(0, 10);

  useEffect(() => {
    if (!root.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from(".nx-hero-copy > *", { opacity: 0, y: 28, duration: 0.7, stagger: 0.1, ease: "power3.out" });
      gsap.from(".nx-bento-card", { opacity: 0, y: 30, scale: 0.97, duration: 0.7, stagger: 0.12, delay: 0.2, ease: "power3.out" });
      gsap.to(".nx-marquee-track", { xPercent: -50, duration: 32, ease: "none", repeat: -1 });
    }, root);
    return () => ctx.revert();
  }, [marquee.length]);

  const scrollRail = (dir: number) => rail.current?.scrollBy({ left: dir * (rail.current.clientWidth * 0.8), behavior: "smooth" });

  const fallback = (
    <section className="nx-herofb">
      <div className="nx-hero-copy">
        <p className="nx-kicker">
          <Sparkles size={14} aria-hidden="true" /> {sf.segment_label || tenant.name}
        </p>
        <h1>{title}</h1>
        <p className="nx-hero-sub">{tenant.about_text ? tenant.about_text.slice(0, 150) : "Lançamentos, comparativos e uma seleção cuidadosa de produtos, com atendimento próximo."}</p>
        <div className="nx-hero-cta">
          <StoreButton asChild size="lg" className="nx-btn nx-btn-lg">
            <Link to={path("/catalogo")}>
              {sf.hero_button_label || "Ver catálogo"} <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </StoreButton>
          {tenant.whatsapp && (
            <StoreButton asChild size="lg" variant="outline" className="nx-btn nx-btn-ghost nx-btn-lg">
              <a href={waLink(tenant, "Olá! Gostaria de atendimento.")} target="_blank" rel="noreferrer">
                <MessageCircle size={18} aria-hidden="true" /> Falar com a loja
              </a>
            </StoreButton>
          )}
        </div>
      </div>
      <div className="nx-bento">
        {hero ? (
          <Link to={path(`/produto/${productRouteSegment(hero)}`)} className="nx-bento-card nx-bento-main">
            <span className="nx-chip">Em destaque</span>
            <span className="nx-bento-img">{imageOf(hero) ? <img src={imageOf(hero)} alt={hero.name} /> : <Package size={64} aria-hidden="true" />}</span>
            <span className="nx-bento-info">
              <b>{hero.name}</b>
              <Price product={hero} />
            </span>
            <span className="nx-bento-go" aria-hidden="true">
              <ArrowUpRight size={20} />
            </span>
          </Link>
        ) : tenant.banner_url ? (
          <img className="nx-hero-banner" src={tenant.banner_url} alt="" />
        ) : null}
        {launches[0] && launches[0].id !== hero?.id && (
          <Link to={path(`/produto/${productRouteSegment(launches[0])}`)} className="nx-bento-card nx-bento-new">
            <span className="nx-chip nx-chip-dark">Novo na loja</span>
            <b>{launches[0].name}</b>
            <span className="nx-bento-img nx-bento-img-sm">{imageOf(launches[0]) && <img src={imageOf(launches[0])} alt="" loading="lazy" />}</span>
          </Link>
        )}
        <Link to={path("/catalogo")} className="nx-bento-card nx-bento-count">
          <strong>{active.length}</strong>
          <span>produtos no catálogo</span>
        </Link>
      </div>
    </section>
  );

  return (
    <main className="nx-page" ref={root}>
      <StoreSEO
        title={`${tenant.name} — tecnologia e catálogo online`}
        description={tenant.about_text || `Conheça o catálogo de ${tenant.name}: produtos selecionados, atendimento próximo e compra segura.`}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      <div className="nx-wrap nx-hero-wrap">
        <HeroSlider
          slides={sf.hero_slides}
          autoplaySeconds={sf.hero_autoplay_seconds ?? 6}
          resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
          layout="banner"
          className="nx-slider"
          fallback={fallback}
        />
      </div>

      <div className="nx-marquee" data-no-fx aria-hidden="true">
        <div className="nx-marquee-track">
          {[0, 1].map((k) => (
            <div key={k} className="nx-marquee-set">
              {marquee.map((m, i) => (
                <span key={`${k}-${i}`}>
                  <Sparkles size={14} /> {m}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {launches.length > 0 && (
        <section className="nx-wrap nx-sec">
          <header className="nx-sec-h nx-sec-h-row">
            <div>
              <p className="nx-kicker nx-kicker-dark">Lançamentos</p>
              <h2>{sf.home_featured_title || "Acabou de chegar"}</h2>
            </div>
            <div className="nx-rail-ctl">
              <button type="button" aria-label="Anterior" onClick={() => scrollRail(-1)}>
                <ChevronLeft size={20} />
              </button>
              <button type="button" aria-label="Próximo" onClick={() => scrollRail(1)}>
                <ChevronRight size={20} />
              </button>
            </div>
          </header>
          <div className="nx-rail" ref={rail} data-no-fx>
            {launches.map((p) => (
              <div key={p.id} className="nx-rail-item">
                <Card product={p} />
              </div>
            ))}
          </div>
        </section>
      )}

      {compare.length >= 2 && (
        <section className="nx-wrap nx-sec">
          <header className="nx-sec-h">
            <p className="nx-kicker nx-kicker-dark">Comparativo</p>
            <h2>Compare os destaques lado a lado</h2>
          </header>
          <div className="nx-cmp-wrap">
            <table className="nx-cmp">
              <thead>
                <tr>
                  <td />
                  {compare.map((p) => (
                    <th key={p.id} scope="col">
                      <Link to={path(`/produto/${productRouteSegment(p)}`)}>
                        <span className="nx-cmp-img">
                          <img src={imageOf(p)} alt="" loading="lazy" />
                        </span>
                        {p.name}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!hidden && (
                  <tr>
                    <th scope="row">Preço</th>
                    {compare.map((p) => (
                      <td key={p.id}>
                        <strong>{money(unitPrice(p))}</strong>
                      </td>
                    ))}
                  </tr>
                )}
                <tr>
                  <th scope="row">Categoria</th>
                  {compare.map((p) => (
                    <td key={p.id}>{categories.find((c) => c.id === p.category_id)?.name || "—"}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Opções</th>
                  {compare.map((p) => {
                    const g = groups(p);
                    return <td key={p.id}>{g.length ? g.map((x) => `${x.name} (${x.values.length})`).join(", ") : "Modelo único"}</td>;
                  })}
                </tr>
                <tr>
                  <th scope="row">Referência</th>
                  {compare.map((p) => (
                    <td key={p.id}>{p.sku || "—"}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" />
                  {compare.map((p) => (
                    <td key={p.id}>
                      <Link className="nx-btn nx-btn-sm" to={path(`/produto/${productRouteSegment(p)}`)}>
                        Ver produto <ArrowUpRight size={15} aria-hidden="true" />
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="nx-wrap nx-perks" aria-label="Diferenciais">
        {PERKS.map(({ icon: Icon, title: t, text }) => (
          <div key={t} className="nx-perk">
            <span className="nx-perk-ico">
              <Icon size={22} aria-hidden="true" />
            </span>
            <div>
              <h3>{t}</h3>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </section>

      {cats.length > 0 && currentTab && (
        <section className="nx-wrap nx-sec">
          <header className="nx-sec-h nx-sec-h-row">
            <div>
              <p className="nx-kicker nx-kicker-dark">Departamentos</p>
              <h2>{sf.home_categories_title || "Explore por categoria"}</h2>
            </div>
            <Link to={path(`/catalogo?cat=${currentTab.id}`)} className="nx-link">
              Ver categoria <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </header>
          <div className="nx-tabs" role="tablist" aria-label="Categorias" data-no-fx>
            {cats.map((c) => (
              <button key={c.id} type="button" role="tab" aria-selected={currentTab.id === c.id} className={currentTab.id === c.id ? "is-on" : ""} onClick={() => setTab(c.id)}>
                {c.name} <small>{c.items.length}</small>
              </button>
            ))}
          </div>
          <div className="nx-grid" role="tabpanel">
            {currentTab.items.slice(0, 8).map((p) => (
              <Card key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {active.length === 0 && <p className="nx-wrap nx-empty">Em breve, novos produtos na vitrine.</p>}

      <section className="nx-wrap nx-banner">
        <div>
          <p className="nx-kicker">Atendimento</p>
          <h2>Precisa de ajuda para escolher?</h2>
          <p>Nossa equipe orienta você a encontrar o produto certo.</p>
        </div>
        {tenant.whatsapp ? (
          <a className="nx-btn nx-btn-lg" href={waLink(tenant, "Olá! Preciso de ajuda para escolher um produto.")} target="_blank" rel="noreferrer">
            <MessageCircle size={18} aria-hidden="true" /> Chamar no WhatsApp
          </a>
        ) : (
          <Link className="nx-btn nx-btn-lg" to={path("/sobre")}>
            Conheça a loja
          </Link>
        )}
      </section>
    </main>
  );
}
