import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  Flame,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  Zap,
} from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import { SwProductCard, swHidePrices, swImage, swMoney } from "./ThemeParts";

export default function StoreFront() {
  const { slug: routeSlug } = useParams();
  const { tenant, products, categories, addToCart, wishlist, toggleWishlist } = useStore();
  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);

  const active = products.filter((p) => p.is_active);
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);

  const featured = active.filter((p) => p.is_featured);
  const showcaseList = featured.length > 0 ? featured : active;
  const heroProduct = showcaseList[0] || null;
  const heroImage = tenant.banner_url || swImage(heroProduct as any);
  const hidePrices = swHidePrices(tenant);

  // Filtered products for the catalog showcase
  const displayedProducts = selectedCatId
    ? active.filter((p) => p.category_id === selectedCatId)
    : active;

  const shownCategories = categories.filter((c) =>
    active.some((p) => p.category_id === c.id),
  );

  const heroPrice = heroProduct ? Number(heroProduct.discount_price || heroProduct.price) : 0;

  const brands = [
    { name: "ÖUS", slug: "ous" },
    { name: "NIKE SB", slug: "nikesb" },
    { name: "VANS", slug: "vans" },
    { name: "DC SHOES", slug: "dcshoes" },
    { name: "THRASHER", slug: "thrasher" },
    { name: "PALACE", slug: "palace" },
  ];

  return (
    <main
      className="sw-root"
      style={{
        minHeight: "100vh",
        background: "#09090b",
        color: "#f4f4f5",
        fontFamily: "'Inter', sans-serif",
        overflowX: "hidden",
      }}
    >
      <StoreSEO
        title={`${tenant.name} | Streetwear & Skate`}
        description={tenant.about_text || `Drops exclusivos, moda urbana e skate na ${tenant.name}.`}
        image={heroImage || ""}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
        keywords={`${tenant.name}, streetwear, skate, moda urbana, drops`}
      />

      {/* ── TOP TICKER ANNOUNCEMENT ── */}
      <aside
        style={{
          background: "#facc15",
          color: "#000",
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: ".18em",
          textTransform: "uppercase",
          padding: "9px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        <span>⚡ FRETE GRÁTIS EM COMPRAS ACIMA DE R$ 299</span>
        <span style={{ opacity: 0.4 }}>•</span>
        <span>ATÉ 6X SEM JUROS NO CARTÃO</span>
        <span style={{ opacity: 0.4 }}>•</span>
        <span>DROPS EXCLUSIVOS & 100% ORIGINAIS</span>
      </aside>

      {/* ── HERO SECTION ── */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          borderBottom: "1px solid #27272a",
          padding: "4.5rem 1.5rem 5rem",
        }}
      >
        {/* Subtle dot matrix background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(rgba(250, 204, 21, 0.12) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            opacity: 0.6,
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            position: "relative",
            zIndex: 1,
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "3.5rem",
            alignItems: "center",
          }}
        >
          <style>{`
            @media (min-width: 1024px) {
              .sw-hero-grid { grid-template-columns: 1.15fr 0.85fr !important; }
            }
          `}</style>
          <div className="sw-hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: "3.5rem", alignItems: "center" }}>
            
            {/* Left Column: Headlines & CTAs */}
            <div>
              {/* Badge */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 14px",
                  borderRadius: 9999,
                  background: "rgba(250, 204, 21, 0.1)",
                  border: "1px solid rgba(250, 204, 21, 0.3)",
                  marginBottom: "1.75rem",
                }}
              >
                <span className="sw-pulse-dot" />
                <span
                  style={{
                    color: "#facc15",
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: ".14em",
                  }}
                >
                  {tenant.hero_tagline || "DROP LIMITADO 2026"}
                </span>
              </div>

              {/* Title */}
              <h1
                style={{
                  fontSize: "clamp(2.75rem, 6.5vw, 5.5rem)",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  lineHeight: 0.92,
                  letterSpacing: "-0.05em",
                  margin: "0 0 1.5rem",
                }}
              >
                NOVA COLEÇÃO<br />
                <span style={{ color: "#facc15" }}>STREETWEAR & SKATE</span>
              </h1>

              {/* Subtitle */}
              <p
                style={{
                  color: "#a1a1aa",
                  fontSize: "clamp(0.95rem, 1.8vw, 1.15rem)",
                  lineHeight: 1.65,
                  maxWidth: 540,
                  margin: "0 0 2.25rem",
                }}
              >
                {tenant.about_text ||
                  "Peças exclusivas, caimento oversized e a verdadeira essência da cultura de rua. O drop mais esperado da temporada já está no ar."}
              </p>

              {/* Action Buttons */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "3rem" }}>
                <Link
                  to={path("/catalogo")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    background: "#facc15",
                    color: "#000",
                    fontWeight: 900,
                    fontSize: ".85rem",
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    textDecoration: "none",
                    padding: "16px 32px",
                    borderRadius: "14px",
                    boxShadow: "0 6px 24px rgba(250, 204, 21, 0.3)",
                    transition: "transform .2s, box-shadow .2s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 30px rgba(250, 204, 21, 0.45)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = "none";
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 24px rgba(250, 204, 21, 0.3)";
                  }}
                >
                  Explorar Catálogo <ArrowRight size={16} />
                </Link>

                <a
                  href="#vitrine-drop"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "rgba(24, 24, 27, 0.8)",
                    color: "#f4f4f5",
                    border: "1px solid #3f3f46",
                    fontWeight: 800,
                    fontSize: ".85rem",
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    textDecoration: "none",
                    padding: "16px 28px",
                    borderRadius: "14px",
                    transition: "border-color .2s, color .2s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "#facc15";
                    (e.currentTarget as HTMLElement).style.color = "#facc15";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "#3f3f46";
                    (e.currentTarget as HTMLElement).style.color = "#f4f4f5";
                  }}
                >
                  <Flame size={16} style={{ color: "#facc15" }} /> Ver Lançamentos
                </a>
              </div>

              {/* Stats Bar */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "1.5rem",
                  paddingTop: "2rem",
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                  maxWidth: 480,
                }}
              >
                <div>
                  <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#facc15", letterSpacing: "-0.03em" }}>
                    +{active.length > 0 ? active.length : 150}
                  </div>
                  <div style={{ fontSize: 10, color: "#71717a", textTransform: "uppercase", fontWeight: 700, letterSpacing: ".1em", marginTop: 2 }}>
                    Peças Exclusivas
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#f4f4f5", letterSpacing: "-0.03em" }}>
                    100%
                  </div>
                  <div style={{ fontSize: 10, color: "#71717a", textTransform: "uppercase", fontWeight: 700, letterSpacing: ".1em", marginTop: 2 }}>
                    Original & Autêntico
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#facc15", letterSpacing: "-0.03em" }}>
                    24h
                  </div>
                  <div style={{ fontSize: 10, color: "#71717a", textTransform: "uppercase", fontWeight: 700, letterSpacing: ".1em", marginTop: 2 }}>
                    Envio Expresso
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Visual Card with Glowing Accent */}
            <div style={{ position: "relative" }}>
              {/* Glowing halo backdrop */}
              <div
                style={{
                  position: "absolute",
                  inset: -8,
                  background: "linear-gradient(135deg, #facc15 0%, #d97706 60%, transparent 100%)",
                  borderRadius: "2.5rem",
                  filter: "blur(40px)",
                  opacity: 0.2,
                  pointerEvents: "none",
                }}
              />

              <div
                className="sw-glass"
                style={{
                  position: "relative",
                  borderRadius: "2rem",
                  overflow: "hidden",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  background: "#18181b",
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
                }}
              >
                {/* Hero Showcase Image */}
                <div style={{ position: "relative", aspectRatio: "4/5", overflow: "hidden", background: "#121214" }}>
                  {heroImage ? (
                    <img
                      src={heroImage}
                      alt="Destaque da Coleção"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ShoppingBag size={80} style={{ color: "#27272a" }} />
                    </div>
                  )}

                  {/* Gradient bottom overlay */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(to top, rgba(9, 9, 11, 0.95) 0%, rgba(9, 9, 11, 0.3) 50%, transparent 100%)",
                    }}
                  />

                  {/* Floating badge over image */}
                  <div
                    style={{
                      position: "absolute",
                      top: 18,
                      right: 18,
                      background: "rgba(9, 9, 11, 0.85)",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(250, 204, 21, 0.3)",
                      borderRadius: 9999,
                      padding: "6px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Sparkles size={12} style={{ color: "#facc15" }} />
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#facc15", textTransform: "uppercase", letterSpacing: ".1em" }}>
                      ESTOQUE LIMITADO
                    </span>
                  </div>

                  {/* Bottom info inside card */}
                  {heroProduct && (
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "1.75rem" }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#facc15", textTransform: "uppercase", letterSpacing: ".14em", display: "block", marginBottom: 4 }}>
                        DESTAQUE DA SEMANA
                      </span>
                      <h3 style={{ fontSize: "1.35rem", fontWeight: 900, textTransform: "uppercase", margin: "0 0 .5rem", letterSpacing: "-0.02em" }}>
                        {heroProduct.name}
                      </h3>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "1.25rem", fontWeight: 900, color: "#facc15" }}>
                          {hidePrices ? "Sob consulta" : swMoney(heroPrice)}
                        </span>
                        <Link
                          to={path(`/produto/${heroProduct.id}`)}
                          style={{
                            background: "#facc15",
                            color: "#000",
                            fontSize: 10,
                            fontWeight: 900,
                            textTransform: "uppercase",
                            letterSpacing: ".1em",
                            padding: "8px 16px",
                            borderRadius: 10,
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          Ver Detalhes <ArrowRight size={12} />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── BRANDS STRIP ── */}
      <section
        style={{
          background: "#09090b",
          borderBottom: "1px solid #27272a",
          padding: "2rem 1.5rem",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto", textAlign: "center" }}>
          <p
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: "#71717a",
              textTransform: "uppercase",
              letterSpacing: ".24em",
              margin: "0 0 1.5rem",
            }}
          >
            MARCAS PARCEIRAS & DROPS EXCLUSIVOS
          </p>
          <div className="sw-brands-row">
            {brands.map((b) => (
              <span key={b.slug} className="sw-brand-item">
                {b.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── VITRINE / CATÁLOGO NA HOME ── */}
      <section id="vitrine-drop" style={{ maxWidth: 1280, margin: "0 auto", padding: "5rem 1.5rem" }}>
        {/* Section Header */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
            marginBottom: "2.5rem",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "1rem" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#facc15", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".16em", marginBottom: 6 }}>
                <Zap size={14} /> LANÇAMENTOS DO DROP
              </div>
              <h2
                style={{
                  fontSize: "clamp(2rem, 4.5vw, 3.25rem)",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "-0.04em",
                  margin: 0,
                  lineHeight: 0.95,
                }}
              >
                NO RADAR AGORA.
              </h2>
            </div>
            <Link
              to={path("/catalogo")}
              style={{
                color: "#facc15",
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: ".1em",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                border: "1px solid rgba(250, 204, 21, 0.3)",
                borderRadius: 10,
                transition: "all .2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#facc15";
                (e.currentTarget as HTMLElement).style.color = "#000";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "#facc15";
              }}
            >
              Ver Catálogo Completo <ArrowRight size={14} />
            </Link>
          </div>

          {/* Interactive Category Pills on Home */}
          {shownCategories.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: ".5rem",
                overflowX: "auto",
                scrollbarWidth: "none",
                paddingBottom: 4,
              }}
            >
              <button
                onClick={() => setSelectedCatId(null)}
                style={{
                  flexShrink: 0,
                  padding: "9px 18px",
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  cursor: "pointer",
                  transition: "all .2s",
                  background: selectedCatId === null ? "#facc15" : "#18181b",
                  color: selectedCatId === null ? "#000" : "#a1a1aa",
                  border: `1px solid ${selectedCatId === null ? "#facc15" : "#27272a"}`,
                }}
              >
                Todos ({active.length})
              </button>
              {shownCategories.map((cat) => {
                const isSelected = selectedCatId === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCatId(cat.id)}
                    style={{
                      flexShrink: 0,
                      padding: "9px 18px",
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: ".08em",
                      cursor: "pointer",
                      transition: "all .2s",
                      background: isSelected ? "#facc15" : "#18181b",
                      color: isSelected ? "#000" : "#a1a1aa",
                      border: `1px solid ${isSelected ? "#facc15" : "#27272a"}`,
                    }}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Product Cards Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "1.25rem",
          }}
        >
          {displayedProducts.slice(0, 8).map((product) => (
            <SwProductCard
              key={product.id}
              product={product}
              category={categories.find((c) => c.id === product.category_id)?.name}
              path={path}
              saved={wishlist.includes(product.id)}
              onFavorite={() => toggleWishlist(product.id)}
              onAdd={() => addToCart(product)}
              hidePrices={hidePrices}
            />
          ))}
        </div>
      </section>

      {/* ── MANIFESTO / CULTURA URBANA SECTION ── */}
      <section
        style={{
          background: "#18181b",
          borderTop: "1px solid #27272a",
          borderBottom: "1px solid #27272a",
          padding: "5rem 1.5rem",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <style>{`
            @media (min-width: 1024px) {
              .sw-manifesto-grid { grid-template-columns: 0.9fr 1.1fr !important; }
            }
          `}</style>
          <div
            className="sw-manifesto-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "4rem",
              alignItems: "center",
            }}
          >
            {/* Visual block */}
            <div style={{ position: "relative" }}>
              <div
                style={{
                  borderRadius: "1.75rem",
                  overflow: "hidden",
                  aspectRatio: "1/1",
                  background: "#09090b",
                  border: "1px solid #27272a",
                }}
              >
                {heroImage ? (
                  <img
                    src={heroImage}
                    alt="Cultura Streetwear"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ShoppingBag size={80} style={{ color: "#27272a" }} />
                  </div>
                )}
              </div>
              {/* Overlay sticker */}
              <div
                style={{
                  position: "absolute",
                  bottom: -16,
                  right: -16,
                  background: "#facc15",
                  color: "#000",
                  padding: "16px 24px",
                  borderRadius: "1rem",
                  fontWeight: 900,
                  fontSize: ".9rem",
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
                }}
              >
                FEITO PELA RUA ⚡
              </div>
            </div>

            {/* Content block */}
            <div>
              <span
                style={{
                  color: "#facc15",
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: ".2em",
                  display: "block",
                  marginBottom: ".75rem",
                }}
              >
                MANIFESTO DA MARCA
              </span>
              <h2
                style={{
                  fontSize: "clamp(2.25rem, 5vw, 3.5rem)",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "-0.04em",
                  lineHeight: 0.95,
                  margin: "0 0 1.5rem",
                }}
              >
                NÃO É APENAS ROUPA.<br />
                <span style={{ color: "#facc15" }}>É EXPRESSÃO.</span>
              </h2>
              <p
                style={{
                  color: "#a1a1aa",
                  fontSize: "1rem",
                  lineHeight: 1.7,
                  margin: "0 0 2rem",
                }}
              >
                {tenant.about_text ||
                  "A cultura urbana e o skate não se resumem a tendências passageiras. São sobre identidade, resistência e autenticidade. Cada costura, estampa e modelagem do nosso catálogo foi pensada para quem vive o asfalto sem pedir licença."}
              </p>

              {/* 3 Pillars */}
              <div style={{ display: "grid", gap: "1.25rem", marginBottom: "2.5rem" }}>
                {[
                  {
                    title: "Cultura do Skate & Rua",
                    desc: "Curadoria desenvolvida por quem realmente entende o movimento.",
                  },
                  {
                    title: "Caimento Autêntico Oversized",
                    desc: "Modelagens pesadas, golas estruturadas e tecido de alta gramatura.",
                  },
                  {
                    title: "Qualidade & Durabilidade Máxima",
                    desc: "Peças feitas para aguentar as sessões de skate e o corre da cidade.",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "1rem",
                      background: "rgba(9, 9, 11, 0.6)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                      borderRadius: "1rem",
                      padding: "1rem 1.25rem",
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "8px",
                        background: "rgba(250, 204, 21, 0.15)",
                        color: "#facc15",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 900,
                        fontSize: 12,
                        flexShrink: 0,
                      }}
                    >
                      0{i + 1}
                    </div>
                    <div>
                      <h4 style={{ margin: "0 0 4px", fontSize: ".9rem", fontWeight: 800, textTransform: "uppercase" }}>
                        {item.title}
                      </h4>
                      <p style={{ margin: 0, fontSize: ".8rem", color: "#71717a", lineHeight: 1.5 }}>
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                to={path("/sobre")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  color: "#f4f4f5",
                  textDecoration: "none",
                  fontWeight: 800,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: ".1em",
                  borderBottom: "2px solid #facc15",
                  paddingBottom: 4,
                  transition: "color .2s",
                }}
              >
                Conheça Nossa História <ArrowRight size={14} style={{ color: "#facc15" }} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST & BENEFITS BAR ── */}
      <section
        style={{
          background: "#09090b",
          borderBottom: "1px solid #27272a",
          padding: "3.5rem 1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "2rem",
          }}
        >
          {[
            {
              icon: <Truck size={24} style={{ color: "#facc15" }} />,
              title: "Envio Rápido & Rastreado",
              desc: "Postagem em até 24h úteis para todo o território nacional.",
            },
            {
              icon: <Zap size={24} style={{ color: "#facc15" }} />,
              title: "Até 6x Sem Juros",
              desc: "Pague com cartão de crédito ou garanta desconto à vista no Pix.",
            },
            {
              icon: <RefreshCw size={24} style={{ color: "#facc15" }} />,
              title: "1ª Troca Grátis",
              desc: "Troca sem burocracia em até 7 dias após o recebimento.",
            },
            {
              icon: <ShieldCheck size={24} style={{ color: "#facc15" }} />,
              title: "100% Original",
              desc: "Garantia de procedência em todas as peças e lançamentos.",
            },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: "1.25rem",
                padding: "1.75rem",
                display: "flex",
                flexDirection: "column",
                gap: ".75rem",
              }}
            >
              <div>{item.icon}</div>
              <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 900, textTransform: "uppercase" }}>
                {item.title}
              </h4>
              <p style={{ margin: 0, fontSize: ".825rem", color: "#71717a", lineHeight: 1.5 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
