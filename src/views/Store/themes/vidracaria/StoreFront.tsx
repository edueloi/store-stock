import { Link, useParams } from "react-router-dom";
import { ArrowRight, Check, Compass, Heart, Layers, MessageCircle, Shield, Sparkles, Wrench } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import { VitraProductCard, vitraHidePrices, vitraImage } from "./ThemeParts";

export default function StoreFront() {
  const { slug: routeSlug } = useParams();
  const { tenant, products, categories, addToCart } = useStore();
  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);

  const active = products.filter((p) => p.is_active);
  const featured = active.filter((p) => p.is_featured);
  const showcase = featured.length > 0 ? featured : active;
  const hidePrices = vitraHidePrices(tenant);

  // Category fallback images for architectural glass
  const defaultCategoryImages: Record<string, string> = {
    boxes: "https://images.unsplash.com/photo-1620626011761-996317b8d101?w=800&q=85",
    espelhos: "https://images.unsplash.com/photo-1615874694520-474822394e73?w=800&q=85",
    portas: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&q=85",
    "guarda-corpos": "https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=800&q=85",
  };

  const heroImage =
    tenant.banner_url ||
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1800&q=85";

  const whatsappLink = tenant.whatsapp
    ? `https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent("Olá! Gostaria de solicitar um orçamento para um projeto em vidro.")}`
    : null;

  return (
    <main className="vitra-root" style={{ minHeight: "100vh" }}>
      <StoreSEO
        title={`${tenant.name} | Vidraçaria & Design`}
        description={
          tenant.about_text ||
          "Vidros temperados, espelhos lapidados, box para banheiros, portas e esquadrias sob medida."
        }
        image={heroImage}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
        keywords={`${tenant.name}, vidraçaria, vidros temperados, espelhos, box de vidro, esquadrias`}
      />

      {/* ── HERO ── */}
      <section
        style={{
          minHeight: 640,
          position: "relative",
          display: "flex",
          alignItems: "center",
          color: "#ffffff",
          background: `linear-gradient(90deg, rgba(10,35,43,0.92) 0%, rgba(10,35,43,0.7) 42%, rgba(10,35,43,0.1) 100%), url(${heroImage}) center 48% / cover no-repeat`,
        }}
      >
        <div style={{ maxWidth: 1250, margin: "0 auto", padding: "80px 1.5rem", width: "100%", position: "relative" }}>
          <div style={{ maxWidth: 620 }}>
            {/* Eyebrow */}
            <div className="vitra-eyebrow" style={{ color: "#d6ae85", marginBottom: "1.25rem" }}>
              Elegância em transparência
            </div>

            {/* H1 */}
            <h1
              style={{
                fontFamily: "'Manrope', sans-serif",
                fontWeight: 800,
                fontSize: "clamp(2.5rem, 5.2vw, 4.75rem)",
                lineHeight: 1.1,
                letterSpacing: "-2.5px",
                margin: "0 0 1.5rem",
              }}
            >
              Transforme seus ambientes com <em style={{ fontStyle: "normal", color: "#d9b995" }}>vidro e design.</em>
            </h1>

            {/* Subtitle */}
            <p
              style={{
                fontSize: "1.05rem",
                lineHeight: 1.8,
                color: "#e1e9e8",
                maxWidth: 490,
                margin: "0 0 2.25rem",
              }}
            >
              {tenant.about_text ||
                "Soluções em vidros, espelhos, boxes e esquadrias para trazer mais luz, sofisticação e personalidade a cada espaço."}
            </p>

            {/* Actions */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              <Link to={path("/catalogo")} className="vitra-btn-primary">
                Explorar catálogo &nbsp; →
              </Link>
              <Link to={path("/sobre")} className="vitra-btn-secondary">
                Conheça nossa história &nbsp; ↗
              </Link>
            </div>
          </div>

          {/* Floating badge */}
          <div
            className="hidden md:block"
            style={{
              position: "absolute",
              bottom: 0,
              right: "1.5rem",
              border: "1px solid rgba(255, 255, 255, 0.35)",
              background: "rgba(255, 255, 255, 0.15)",
              backdropFilter: "blur(10px)",
              padding: "19px 24px",
              color: "#ffffff",
              fontSize: 13,
              lineHeight: 1.6,
              borderRadius: 6,
            }}
          >
            <strong
              style={{
                display: "block",
                fontFamily: "'Manrope', sans-serif",
                fontWeight: 800,
                fontSize: 26,
                lineHeight: 1.2,
                color: "#ffffff",
              }}
            >
              15+ anos
            </strong>
            Transformando ambientes<br />com transparência e precisão.
          </div>
        </div>
      </section>

      {/* ── BENEFITS BAR ── */}
      <section style={{ borderBottom: "1px solid var(--vitra-line)", background: "#ffffff" }}>
        <div style={{ maxWidth: 1250, margin: "0 auto", padding: "32px 1.5rem" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "24px",
            }}
          >
            {[
              {
                icon: "◇",
                title: "Projetos sob medida",
                desc: "Do seu jeito, no seu espaço",
              },
              {
                icon: "✧",
                title: "Acabamento premium",
                desc: "Qualidade em cada detalhe",
              },
              {
                icon: "⌂",
                title: "Instalação especializada",
                desc: "Equipe técnica qualificada",
              },
              {
                icon: "♡",
                title: "Atendimento próximo",
                desc: "Do orçamento à entrega",
              },
            ].map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span
                  style={{
                    color: "var(--vitra-accent)",
                    fontSize: 24,
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  {b.icon}
                </span>
                <div>
                  <b style={{ display: "block", fontSize: 13, color: "var(--vitra-ink)", fontWeight: 700 }}>
                    {b.title}
                  </b>
                  <small style={{ display: "block", color: "var(--vitra-muted)", fontSize: 12, marginTop: 2 }}>
                    {b.desc}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CATEGORIES SECTION ── */}
      {categories.length > 0 && (
        <section style={{ padding: "90px 1.5rem" }}>
          <div style={{ maxWidth: 1250, margin: "0 auto" }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: "20px",
                marginBottom: "35px",
              }}
            >
              <div>
                <div className="vitra-eyebrow">Soluções para cada ambiente</div>
                <h2
                  style={{
                    fontFamily: "'Manrope', sans-serif",
                    fontWeight: 800,
                    fontSize: "clamp(1.75rem, 3.2vw, 2.5rem)",
                    letterSpacing: "-1.5px",
                    margin: "12px 0 0",
                    color: "var(--vitra-ink)",
                  }}
                >
                  Explore nossas categorias
                </h2>
              </div>
              <p style={{ color: "var(--vitra-muted)", lineHeight: 1.8, maxWidth: 500, margin: 0, fontSize: 14 }}>
                De pequenos detalhes a projetos completos: encontre a solução ideal para transformar seu espaço.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "18px",
              }}
            >
              {categories.slice(0, 4).map((cat) => {
                const normKey = cat.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const matchedImage =
                  cat.image_url ||
                  defaultCategoryImages[normKey] ||
                  "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=800&q=85";

                return (
                  <Link
                    key={cat.id}
                    to={path(`/catalogo?cat=${cat.id}`)}
                    className="vitra-cat-card"
                  >
                    <img src={matchedImage} alt={cat.name} loading="lazy" />
                    <div className="vitra-cat-content">
                      <small>Conheça a linha</small>
                      <h3>{cat.name} →</h3>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── FEATURED PRODUCTS (VITRINE) ── */}
      <section style={{ padding: "90px 1.5rem", background: "var(--vitra-bg)" }}>
        <div style={{ maxWidth: 1250, margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: "20px",
              marginBottom: "35px",
            }}
          >
            <div>
              <div className="vitra-eyebrow">Seleção especial</div>
              <h2
                style={{
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: 800,
                  fontSize: "clamp(1.75rem, 3.2vw, 2.5rem)",
                  letterSpacing: "-1.5px",
                  margin: "12px 0 0",
                  color: "var(--vitra-ink)",
                }}
              >
                Produtos em destaque
              </h2>
            </div>
            <Link
              to={path("/catalogo")}
              style={{
                border: 0,
                background: "transparent",
                color: "var(--vitra-accent-dark)",
                fontWeight: 800,
                fontSize: 13,
                borderBottom: "1px solid var(--vitra-accent)",
                paddingBottom: 4,
                textDecoration: "none",
              }}
            >
              Ver catálogo completo →
            </Link>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "20px",
            }}
          >
            {showcase.slice(0, 8).map((product) => (
              <VitraProductCard
                key={product.id}
                product={product}
                category={categories.find((c) => c.id === product.category_id)?.name}
                path={path}
                onAdd={() => addToCart(product)}
                hidePrices={hidePrices}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT PREVIEW SECTION ── */}
      <section style={{ padding: "95px 1.5rem", background: "#ffffff" }}>
        <div style={{ maxWidth: 1250, margin: "0 auto" }}>
          <style>{`
            @media (min-width: 900px) {
              .vitra-about-split { grid-template-columns: 1fr 1fr !important; }
            }
          `}</style>
          <div
            className="vitra-about-split"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "60px",
              alignItems: "center",
            }}
          >
            {/* Photo with experience badge */}
            <div style={{ position: "relative" }}>
              <img
                src="https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1000&q=85"
                alt="Ambiente arquitetônico com vidro"
                style={{
                  width: "100%",
                  height: "clamp(340px, 45vw, 520px)",
                  objectFit: "cover",
                  borderRadius: 6,
                }}
                loading="lazy"
              />
              <div
                style={{
                  position: "absolute",
                  bottom: -20,
                  right: -10,
                  background: "var(--vitra-accent)",
                  padding: "24px 30px",
                  color: "#ffffff",
                  borderRadius: 6,
                  boxShadow: "0 15px 35px rgba(0,0,0,0.15)",
                }}
              >
                <strong
                  style={{
                    fontFamily: "'Manrope', sans-serif",
                    fontWeight: 800,
                    fontSize: 34,
                    display: "block",
                    lineHeight: 1,
                  }}
                >
                  15+
                </strong>
                <span style={{ fontSize: 13, marginTop: 4, display: "block" }}>
                  Anos de experiência
                </span>
              </div>
            </div>

            {/* Copy */}
            <div>
              <div className="vitra-eyebrow">Sobre a {tenant.name}</div>
              <h2
                style={{
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: 800,
                  fontSize: "clamp(1.85rem, 3.5vw, 2.75rem)",
                  lineHeight: 1.2,
                  letterSpacing: "-1.8px",
                  margin: "18px 0 16px",
                  color: "var(--vitra-ink)",
                }}
              >
                Mais do que vidro. Criamos novas perspectivas.
              </h2>
              <p
                style={{
                  color: "var(--vitra-muted)",
                  lineHeight: 1.85,
                  fontSize: 15,
                  margin: "0 0 24px",
                }}
              >
                {tenant.about_text ||
                  "Acreditamos no poder dos detalhes. Cada solução é pensada para unir segurança, beleza e funcionalidade, valorizando o seu projeto e a sua história."}
              </p>

              {/* Checklist */}
              <div style={{ display: "grid", gap: "12px", margin: "0 0 32px" }}>
                {[
                  "Atendimento consultivo e personalizado",
                  "Materiais selecionados e acabamento impecável",
                  "Projetos residenciais e comerciais sob medida",
                ].map((item, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 11, fontWeight: 700, fontSize: 13, color: "var(--vitra-ink)" }}>
                    <span style={{ color: "var(--vitra-accent)", fontWeight: 900 }}>✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <Link to={path("/sobre")} className="vitra-btn-primary">
                Conheça nossa empresa →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section style={{ padding: "0 1.5rem 80px" }}>
        <div style={{ maxWidth: 1250, margin: "0 auto" }}>
          <div
            style={{
              background: "var(--vitra-ink)",
              color: "#ffffff",
              padding: "50px 55px",
              borderRadius: 8,
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "28px",
            }}
          >
            <div>
              <h2
                style={{
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: 800,
                  fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
                  letterSpacing: "-1px",
                  margin: "0 0 8px",
                  color: "#ffffff",
                }}
              >
                Tem um projeto em mente?
              </h2>
              <p style={{ color: "#b7cccf", margin: 0, lineHeight: 1.7, fontSize: 14 }}>
                Conte para nós o que você precisa. Preparamos soluções sob medida.
              </p>
            </div>

            {whatsappLink ? (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="vitra-btn-primary"
                style={{ whiteSpace: "nowrap" }}
              >
                Solicitar orçamento ↗
              </a>
            ) : (
              <Link to={path("/catalogo")} className="vitra-btn-primary" style={{ whiteSpace: "nowrap" }}>
                Ver catálogo completo ↗
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
