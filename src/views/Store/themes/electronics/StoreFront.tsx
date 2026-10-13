import { Link } from "react-router-dom";
import { ArrowRight, CreditCard, Headphones, ShieldCheck, Truck, Zap } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { Card, deptIcon, installmentText } from "./parts";
import { imageOf, money, priceInfo, productHref, useKit, whatsappLink } from "./kit";
import "./styles.css";

export default function StoreFront() {
  const { tenant, categories, active, path, sf, hidePrices } = useKit();
  const wa = whatsappLink(tenant);
  const offers = active.filter((p) => priceInfo(p).hasDiscount).sort((a, b) => priceInfo(b).pct - priceInfo(a).pct).slice(0, 10);
  const featured = active.filter((p) => p.is_featured);
  const heroProduct = (featured.length ? featured : active).find((p) => imageOf(p));
  const spotlight = (featured.length ? featured : active).slice(0, 3);
  const popular = (featured.length ? featured : active).slice(0, 10);
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

  return (
    <div className="elx-page">
      <StoreSEO title={`${tenant.name} — Loja de tecnologia`} description={tenant.hero_tagline || tenant.about_text || `Conheça os produtos da ${tenant.name}.`} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="elx-wrap">
        <section className="elx-hero">
          <div className="elx-hero-main">
            <div className="elx-hero-copy">
              <span className="elx-tag"><Zap size={14} /> {sf.segment_label || "Tecnologia para o seu dia a dia"}</span>
              <h1>{tenant.hero_tagline || tenant.name}</h1>
              <p>{tenant.about_text ? tenant.about_text.slice(0, 150) : "As novidades e os produtos que você procura em uma experiência de compra simples e conectada."}</p>
              <div className="elx-hero-actions"><Link to={path("/catalogo")} className="elx-btn elx-btn-inline elx-btn-cyan">{sf.hero_button_label || "Explorar produtos"} <ArrowRight size={17} /></Link><Link to={path("/sobre")} className="elx-btn elx-btn-inline elx-btn-outline">Conheça a loja</Link></div>
            </div>
            <div className="elx-hero-visual">{tenant.banner_url ? <img src={tenant.banner_url} alt="" /> : heroProduct ? <img src={imageOf(heroProduct)} alt="" /> : <Zap size={108} strokeWidth={1} />}<span className="elx-hero-orbit" aria-hidden="true" /></div>
          </div>
          {spotlight.length > 0 && (
            <aside className="elx-spot" aria-label="Destaques">
              <h2>Seleção especial</h2>
              <ul>
                {spotlight.map((p) => {
                  const info = priceInfo(p);
                  const img = imageOf(p);
                  return (
                    <li key={p.id}>
                      <Link to={productHref(path, p)}>
                        <span className="elx-spot-img">{img && <img src={img} alt="" loading="lazy" />}</span>
                        <span className="elx-spot-txt">
                          <b>{p.name}</b>
                          {hidePrices ? <em>Sob consulta</em> : <em>{money(info.price)}</em>}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </aside>
          )}
        </section>

        <ul className="elx-trust">
          {trust.map(({ icon: Icon, t, d }) => (
            <li key={t}><Icon size={26} strokeWidth={1.6} /><div><strong>{t}</strong><span>{d}</span></div></li>
          ))}
        </ul>

        {depts.length > 0 && (
          <section className="elx-block">
            <div className="elx-head"><h2>{sf.home_categories_title || "Departamentos"}</h2></div>
            <div className="elx-dept-grid">
              {depts.slice(0, 8).map((c) => {
                const Icon = deptIcon(c.name);
                return <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className="elx-dept"><Icon size={28} strokeWidth={1.5} /><span>{c.name}</span></Link>;
              })}
            </div>
          </section>
        )}
      </div>

      {offers.length > 0 && !hidePrices && (
        <section className="elx-flash" aria-label="Ofertas da loja">
          <div className="elx-wrap">
            <div className="elx-flash-head">
              <h2><Zap size={22} fill="currentColor" /> Ofertas da loja</h2>
              <Link to={path("/catalogo")}>Ver todas as ofertas <ArrowRight size={15} /></Link>
            </div>
            <div className="elx-flash-track">
              {offers.map((p) => {
                const info = priceInfo(p);
                const img = imageOf(p);
                const inst = installmentText(tenant, info.price);
                return (
                  <Link key={p.id} to={productHref(path, p)} className="elx-flash-card">
                    <span className="elx-off">-{info.pct}%</span>
                    <span className="elx-flash-img">{img && <img src={img} alt="" loading="lazy" />}</span>
                    <b>{p.name}</b>
                    <s>{money(info.full)}</s>
                    <strong>{money(info.price)}</strong>
                    {inst && <small>{inst}</small>}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <div className="elx-wrap">
        {popular.length > 0 && (
          <section className="elx-block">
            <div className="elx-head"><h2>{sf.home_featured_title || "Mais procurados"}</h2><Link to={path("/catalogo")}>Ver catálogo <ArrowRight size={14} /></Link></div>
            <div className="elx-grid">{popular.map((p) => <Card key={p.id} product={p} />)}</div>
          </section>
        )}
        {fresh.length > 0 && (
          <section className="elx-block">
            <div className="elx-head"><h2>Explore mais produtos</h2><Link to={path("/catalogo")}>Ver mais <ArrowRight size={14} /></Link></div>
            <div className="elx-grid">{fresh.map((p) => <Card key={p.id} product={p} />)}</div>
          </section>
        )}
        {active.length === 0 && <p className="elx-note">Em breve novos produtos por aqui.</p>}
      </div>
    </div>
  );
}
