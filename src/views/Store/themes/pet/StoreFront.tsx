import { Link } from "react-router-dom";
import { ArrowRight, Heart, PawPrint, ShieldCheck, Sparkles, Star } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { detectAnimal, tint } from "./animals";
import Card from "./Card";
import { imageOf, priceOf, useKit } from "./lib";
import "./styles.css";

const Wave = ({ color }: { color: string }) => (
  <svg className="pet-wave" viewBox="0 0 1200 44" preserveAspectRatio="none" aria-hidden="true" style={{ ["--wave" as string]: color }}>
    <path d="M0 22 C 150 0, 250 44, 400 22 S 650 0, 800 22 S 1050 44, 1200 22 V44 H0 Z" />
  </svg>
);

export default function StoreFront() {
  const { tenant, active, path, sf, usedCategories, countIn } = useKit();
  const featured = (active.some((p) => p.is_featured) ? active.filter((p) => p.is_featured) : active).slice(0, 8);
  const deals = active.filter((p) => priceOf(p).off).slice(0, 4);
  const title = tenant.hero_tagline || "Tudo para uma vida feliz de quatro patas";
  const firstPhoto = imageOf(featured[0]);
  const hero = tenant.banner_url || firstPhoto;
  const words = title.trim().split(/\s+/);
  const cut = Math.max(1, words.length - 2);

  return (
    <main className="pet-root">
      <StoreSEO
        title={`${tenant.name} | Pet shop`}
        description={tenant.about_text || `Tudo para o seu pet na ${tenant.name}.`}
        image={hero}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      <section className="pet-hero">
        <div className="pet-wrap">
          <div className="pet-hero-grid">
            <div>
              <span className="pet-pill-tag"><PawPrint size={16} /> {sf.segment_label || "Pet shop com carinho"}</span>
              <h1 className="pet-h">
                {words.length > 3 ? (<>{words.slice(0, cut).join(" ")} <em>{words.slice(cut).join(" ")}</em></>) : title}
              </h1>
              <p className="pet-lead">{tenant.about_text || "Alimentos, brinquedos, higiene e acessórios escolhidos com carinho para o seu melhor amigo."}</p>
              <div className="pet-hero-cta">
                <Link to={path("/catalogo")} className="pet-btn">{sf.hero_button_label || "Ver produtos"} <ArrowRight size={20} /></Link>
                <Link to={path("/sobre")} className="pet-btn pet-btn--light">Conheça a loja</Link>
              </div>
            </div>
            <div style={{ position: "relative", padding: "14px 10px 24px" }}>
              <div className="pet-blob">
                {hero ? <img src={hero} alt="" className={tenant.banner_url ? "" : "contain"} /> : <PawPrint size={120} className="pet-blob-empty" />}
              </div>
              <span className="pet-sticker pet-float" style={{ left: 0, top: 0, ["--r" as string]: "-6deg" }}><Heart size={16} fill="currentColor" style={{ color: "var(--pt-accent)" }} /> Feito com carinho</span>
              {deals.length > 0 && !(sf.hide_prices === true || sf.checkout_mode === "order_request") && (
                <span className="pet-sticker pet-float" style={{ right: 0, bottom: 4, background: "var(--pt-sun)", ["--r" as string]: "4deg" }}><Sparkles size={16} /> {deals.length} {deals.length === 1 ? "oferta" : "ofertas"} disponíveis</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {usedCategories.length > 0 && (
        <section className="pet-sec" style={{ paddingTop: 20 }}>
          <div className="pet-wrap">
            <div className="pet-sec-head">
              <span className="pet-pill-tag"><PawPrint size={16} /> Para quem é?</span>
              <h2 className="pet-h">{sf.home_categories_title || "Escolha o seu bichinho"}</h2>
            </div>
            <div className="pet-bubbles">
              {usedCategories.slice(0, 10).map((c, i) => {
                const a = detectAnimal(c.name);
                return (
                  <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className="pet-bubble">
                    <span className="pet-bubble-ico" style={{ ["--b" as string]: tint(i) }}><a.Icon size={44} strokeWidth={1.8} /></span>
                    <span>{c.name}<small>{countIn(c.id)} {countIn(c.id) === 1 ? "produto" : "produtos"}</small></span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {deals.length > 0 && !(sf.hide_prices === true || sf.checkout_mode === "order_request") && (
        <>
          <Wave color="var(--pt-sun)" />
          <section className="pet-sec pet-sec--sun">
            <div className="pet-wrap">
              <div className="pet-sec-head">
                <span className="pet-pill-tag"><Star size={16} /> Ofertas</span>
                <h2 className="pet-h">Preço de petisco!</h2>
                <p>Ofertas especiais para cuidar do seu pet gastando menos.</p>
              </div>
              <div className="pet-grid">{deals.map((p, i) => <Card key={p.id} product={p} index={i} />)}</div>
            </div>
          </section>
          <svg className="pet-wave" viewBox="0 0 1200 44" preserveAspectRatio="none" aria-hidden="true" style={{ transform: "scaleY(-1)", ["--wave" as string]: "var(--pt-sun)", marginTop: -1 }}>
            <path d="M0 22 C 150 0, 250 44, 400 22 S 650 0, 800 22 S 1050 44, 1200 22 V44 H0 Z" />
          </svg>
        </>
      )}

      <section className="pet-sec">
        <div className="pet-wrap">
          <div className="pet-sec-head">
            <span className="pet-pill-tag"><Heart size={16} /> Favoritos</span>
            <h2 className="pet-h">{sf.home_featured_title || "Os queridinhos da turma"}</h2>
          </div>
          {featured.length ? (
            <div className="pet-grid">{featured.map((p, i) => <Card key={p.id} product={p} index={i} />)}</div>
          ) : (
            <div className="pet-empty"><PawPrint size={44} /><h3>Estamos arrumando a casinha</h3><p>Em breve teremos novidades por aqui.</p></div>
          )}
          <div className="pet-more"><Link to={path("/catalogo")} className="pet-btn pet-btn--sun">Ver todo o catálogo <ArrowRight size={20} /></Link></div>
        </div>
      </section>

      <Wave color="var(--pt-sand)" />
      <section className="pet-sec pet-sec--sand">
        <div className="pet-wrap">
          <div className="pet-why">
            {[
              [Heart, "#ffdfe0", "Cuidado de verdade", "Produtos escolhidos pensando no bem-estar do seu pet."],
              [ShieldCheck, "#c9f1e8", "Compra tranquila", "Pedido simples, com atendimento direto da loja."],
              [Sparkles, "#d4e9ff", "Para todo tipo de pet", "Navegue por categorias e encontre o item certo."],
            ].map(([Icon, bg, t, d]: any) => (
              <div className="pet-why-card" key={t}>
                <span className="pet-bubble-ico" style={{ ["--b" as string]: bg }}><Icon size={28} /></span>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
