import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ArrowRight, CreditCard, Headphones, ShieldCheck, Truck, Zap } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { StoreButton } from "../../../../components/store/StoreButton";
import { Card, deptIcon, installmentText } from "./parts";
import { imageOf, money, priceInfo, productHref, useKit, whatsappLink } from "./kit";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, path, sf, hidePrices } = useKit();
  const wa = whatsappLink(tenant);
  const offers = active
    .filter((p) => priceInfo(p).hasDiscount)
    .sort((a, b) => priceInfo(b).pct - priceInfo(a).pct)
    .slice(0, 5);
  const featured = active.filter((p) => p.is_featured);
  const base = featured.length ? featured : active;
  const heroProduct = base.find((p) => imageOf(p));
  const spotlight = base.filter((p) => p.id !== heroProduct?.id).slice(0, 2);
  const popular = base.slice(0, 10);
  const popularIds = new Set(popular.map((p) => p.id));
  const fresh = [...active].sort((a, b) => b.id - a.id).filter((p) => !popularIds.has(p.id)).slice(0, 5);
  const depts = categories.filter((c) => active.some((p) => p.category_id === c.id));
  const warranty = tenant.policies?.warranty_days;
  const pay = tenant.payment_methods;
  const payNames = [pay?.pix && "Pix", pay?.credit_card && "cartão", pay?.boleto && "boleto"].filter(Boolean) as string[];
  const trust = [
    { icon: ShieldCheck, t: "Garantia", d: warranty ? `${warranty} dias de garantia` : "Confira a garantia de cada produto" },
    { icon: Truck, t: "Entrega e retirada", d: "Consulte prazo e formas de receber" },
    { icon: CreditCard, t: "Pagamento", d: payNames.length ? `Aceitamos ${payNames.join(", ")}` : "Formas de pagamento no carrinho" },
    { icon: Headphones, t: "Suporte", d: wa ? "Especialistas no WhatsApp" : "Atendimento da loja" },
  ];
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from(".elx-hero-copy > *", { opacity: 0, y: 26, duration: 0.7, stagger: 0.1, ease: "power3.out" });
      gsap.from(".elx-hero-tile", { opacity: 0, x: 30, duration: 0.7, stagger: 0.15, delay: 0.2, ease: "power3.out" });
      gsap.fromTo(".elx-hero-visual img", { scale: 0.92 }, { scale: 1, duration: 1.4, ease: "power2.out" });
    }, root);
    const img = root.current.querySelector<HTMLElement>(".elx-hero-visual");
    const move = (e: MouseEvent) => {
      if (!img) return;
      const r = img.getBoundingClientRect();
      gsap.to(img.querySelector("img"), { x: ((e.clientX - r.left) / r.width - 0.5) * 18, y: ((e.clientY - r.top) / r.height - 0.5) * 14, duration: 0.6, ease: "power2.out" });
    };
    img?.addEventListener("mousemove", move);
    return () => {
      img?.removeEventListener("mousemove", move);
      ctx.revert();
    };
  }, []);
  const heroImg = tenant.banner_url || (heroProduct ? imageOf(heroProduct) : "");

  const fallback = (
    <section className="elx-hero">
      <div className="elx-hero-main">
        <div className="elx-hero-copy">
          <span className="elx-tag">
            <Zap size={14} /> {sf.segment_label || "Tecnologia para o seu dia a dia"}
          </span>
          <h1>{tenant.hero_tagline || tenant.name}</h1>
          <p>{tenant.about_text ? tenant.about_text.slice(0, 140) : "Gadgets, acessórios e novidades em uma compra simples e conectada."}</p>
          <div className="elx-hero-actions">
            <StoreButton asChild size="md" className="elx-btn elx-btn-inline">
              <Link to={path("/catalogo")}>
                {sf.hero_button_label || "Explorar produtos"} <ArrowRight size={17} />
              </Link>
            </StoreButton>
            <StoreButton asChild size="md" variant="outline" className="elx-btn elx-btn-outline">
              <Link to={path("/sobre")}>Conheça a loja</Link>
            </StoreButton>
          </div>
        </div>
        <div className="elx-hero-visual">
          {heroImg ? <img src={heroImg} alt="" /> : <Zap size={96} strokeWidth={1} />}
          <span className="elx-hero-orbit" aria-hidden="true" />
        </div>
      </div>
      {spotlight.length > 0 && (
        <div className="elx-hero-side">
          {spotlight.map((p, i) => {
            const info = priceInfo(p);
            const img = imageOf(p);
            return (
              <Link key={p.id} to={productHref(path, p)} className={`elx-hero-tile elx-tone-${i}`}>
                <span className="elx-hero-tile-txt">
                  <small>{i === 0 ? "Lançamento" : "Em alta"}</small>
                  <b>{p.name}</b>
                  {!hidePrices && <em>{money(info.price)}</em>}
                </span>
                <span className="elx-hero-tile-img">{img && <img src={img} alt="" loading="lazy" />}</span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <div className="elx-page" ref={root}>
      <StoreSEO
        title={`${tenant.name} — Loja de tecnologia`}
        description={tenant.hero_tagline || tenant.about_text || `Conheça os produtos da ${tenant.name}.`}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <div className="elx-wrap">
        <HeroSlider
          slides={sf.hero_slides}
          autoplaySeconds={sf.hero_autoplay_seconds ?? 6}
          resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
          layout="banner"
          className="elx-slider"
          fallback={fallback}
        />

        <ul className="elx-trust">
          {trust.map(({ icon: Icon, t, d }) => (
            <li key={t}>
              <span className="elx-trust-ico">
                <Icon size={22} strokeWidth={1.8} />
              </span>
              <div>
                <strong>{t}</strong>
                <span>{d}</span>
              </div>
            </li>
          ))}
        </ul>

        {depts.length > 0 && (
          <section className="elx-block">
            <div className="elx-head">
              <h2>{sf.home_categories_title || "Compre por departamento"}</h2>
            </div>
            <div className="elx-circles" data-no-fx>
              {depts.slice(0, 14).map((c) => {
                const Icon = deptIcon(c.name);
                return (
                  <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className="elx-circle">
                    <span className="elx-circle-disc">
                      {c.cover_url ? <img src={c.cover_url} alt="" loading="lazy" /> : <Icon size={30} strokeWidth={1.5} />}
                    </span>
                    <span className="elx-circle-name">{c.name}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {offers.length > 0 && !hidePrices && (
          <section className="elx-block" aria-label="Ofertas da loja">
            <div className="elx-head">
              <h2>
                <Zap size={22} fill="currentColor" className="elx-bolt" /> Ofertas da loja
              </h2>
              <Link to={path("/catalogo")}>
                Ver catálogo <ArrowRight size={15} />
              </Link>
            </div>
            <div className={`elx-tiles elx-tiles-${offers.length}`}>
              {offers.map((p, i) => {
                const info = priceInfo(p);
                const img = imageOf(p);
                const inst = installmentText(tenant, info.price);
                return (
                  <Link key={p.id} to={productHref(path, p)} className={`elx-tile elx-tone-${i % 5}`}>
                    <span className="elx-off">-{info.pct}%</span>
                    <span className="elx-tile-img">{img && <img src={img} alt="" loading="lazy" />}</span>
                    <span className="elx-tile-info">
                      <b>{p.name}</b>
                      <s>{money(info.full)}</s>
                      <strong>{money(info.price)}</strong>
                      {inst && <small>{inst}</small>}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {popular.length > 0 && (
          <section className="elx-block">
            <div className="elx-head">
              <h2>{sf.home_featured_title || "Mais procurados"}</h2>
              <Link to={path("/catalogo")}>
                Ver catálogo <ArrowRight size={14} />
              </Link>
            </div>
            <div className="elx-grid">
              {popular.map((p) => (
                <Card key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
        {fresh.length > 0 && (
          <section className="elx-block">
            <div className="elx-head">
              <h2>Explore mais produtos</h2>
              <Link to={path("/catalogo")}>
                Ver mais <ArrowRight size={14} />
              </Link>
            </div>
            <div className="elx-grid">
              {fresh.map((p) => (
                <Card key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
        {active.length === 0 && <p className="elx-note">Em breve novos produtos por aqui.</p>}
      </div>
    </div>
  );
}
