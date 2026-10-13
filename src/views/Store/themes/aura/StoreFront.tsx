import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight, Gift, Sparkles } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import { AuraProductCard, auraHidePrices, auraImage } from "./ThemeParts";

export default function StoreFront() {
  const { slug: routeSlug } = useParams();
  const { tenant, products, categories, addToCart, wishlist, toggleWishlist } = useStore();
  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);

  const active = products.filter((p) => p.is_active);
  const featured = (
    active.filter((p) => p.is_featured).length ? active.filter((p) => p.is_featured) : active
  ).slice(0, 8);

  const shownCategories = categories.filter((c) =>
    active.some((p) => p.category_id === c.id),
  );

  const [slide, setSlide] = useState(0);
  const heroImages = [
    tenant.banner_url || "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=80&w=1600",
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=1600",
  ];

  const hidePrices = auraHidePrices(tenant);

  return (
    <main className="aura-root" style={{ minHeight: "100vh" }}>
      <StoreSEO
        title={`${tenant.name} | Moda Feminina Sofisticada`}
        description={tenant.about_text || `Aura Feminina — moda elegante, tecidos nobres e alfaiataria fina.`}
        image={heroImages[0]}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
        keywords={`${tenant.name}, moda feminina, vestidos, alfaiataria, elegância, sofisticação`}
      />

      {/* Hero Slider */}
      <section style={{ position: "relative", backgroundColor: "#F4EFEB", overflow: "hidden", minHeight: 520, height: "70vh" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url('${heroImages[slide]}')`,
            backgroundPosition: "center",
            backgroundSize: "cover",
            transition: "all 0.7s ease-in-out",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 10,
            maxWidth: 1280,
            margin: "0 auto",
            padding: "0 1.5rem",
            height: "100%",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div style={{ maxWidth: 580, color: "#ffffff" }}>
            <span
              style={{
                backgroundColor: "rgba(212, 175, 55, 0.95)",
                color: "#111111",
                fontSize: 11,
                fontWeight: 700,
                padding: "6px 14px",
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                borderRadius: 9999,
                display: "inline-block",
                marginBottom: 16,
              }}
            >
              Coleção Especial
            </span>

            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(2.2rem, 5vw, 4rem)",
                fontWeight: 700,
                lineHeight: 1.15,
                margin: "0 0 16px",
              }}
            >
              A Essência da Elegância Contemporânea
            </h2>

            <p
              style={{
                fontSize: "0.95rem",
                color: "#FBF9F7",
                lineHeight: 1.6,
                fontWeight: 300,
                margin: "0 0 24px",
              }}
            >
              {tenant.hero_tagline ||
                "Descubra alfaiataria impecável, vestidos fluidos e texturas criadas para a mulher moderna e autêntica."}
            </p>

            <Link
              to={path("/catalogo")}
              style={{
                display: "inline-block",
                backgroundColor: "#FAF9F6",
                color: "#111111",
                fontWeight: 600,
                fontSize: 11,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                padding: "16px 36px",
                borderRadius: 9999,
                textDecoration: "none",
                boxShadow: "0 10px 20px rgba(0,0,0,0.15)",
                transition: "all 0.3s",
              }}
              className="hover:bg-amber-600 hover:text-white"
            >
              Explorar Coleção
            </Link>
          </div>
        </div>

        {/* Controls */}
        <button
          type="button"
          onClick={() => setSlide((s) => (s === 0 ? heroImages.length - 1 : s - 1))}
          style={{
            position: "absolute",
            left: 16,
            top: "50%",
            transform: "translateY(-50%)",
            backgroundColor: "rgba(255,255,255,0.4)",
            border: "none",
            borderRadius: "50%",
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            cursor: "pointer",
            backdropFilter: "blur(4px)",
            zIndex: 10,
          }}
          aria-label="Slide anterior"
        >
          <ChevronLeft size={20} />
        </button>

        <button
          type="button"
          onClick={() => setSlide((s) => (s + 1) % heroImages.length)}
          style={{
            position: "absolute",
            right: 16,
            top: "50%",
            transform: "translateY(-50%)",
            backgroundColor: "rgba(255,255,255,0.4)",
            border: "none",
            borderRadius: "50%",
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            cursor: "pointer",
            backdropFilter: "blur(4px)",
            zIndex: 10,
          }}
          aria-label="Próximo slide"
        >
          <ChevronRight size={20} />
        </button>
      </section>

      {/* Categorias em Destaque */}
      {shownCategories.length > 0 && (
        <section style={{ maxWidth: 1280, margin: "0 auto", padding: "4rem 1.5rem" }}>
          <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 3rem" }}>
            <span style={{ color: "#8C7A6B", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.25em" }}>
              Explore por Estilo
            </span>
            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(1.8rem, 3.5vw, 2.5rem)",
                fontWeight: 700,
                color: "#111111",
                marginTop: 8,
              }}
            >
              Categorias em Destaque
            </h2>
            <div style={{ width: 60, height: 2, backgroundColor: "#D4AF37", margin: "12px auto 0" }} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {shownCategories.slice(0, 4).map((cat) => (
              <Link
                key={cat.id}
                to={path(`/catalogo?cat=${cat.id}`)}
                style={{
                  position: "relative",
                  borderRadius: "1rem",
                  overflow: "hidden",
                  height: 320,
                  textDecoration: "none",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
                  display: "block",
                  backgroundColor: "#F4EFEB",
                }}
                className="group"
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    padding: "1.5rem",
                    color: "#ffffff",
                    zIndex: 2,
                  }}
                >
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.35rem", fontWeight: 700, margin: 0 }}>
                    {cat.name}
                  </h3>
                  <p style={{ fontSize: 11, color: "#E5DBD0", margin: "4px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
                    Ver peças <ArrowRight size={12} />
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Vitrine / Destaques */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "1rem 1.5rem 5rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "2.5rem", gap: "1rem" }}>
          <div>
            <span style={{ color: "#8C7A6B", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.25em" }}>
              Seleção Especial
            </span>
            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(1.8rem, 3.5vw, 2.5rem)",
                fontWeight: 700,
                color: "#111111",
                marginTop: 6,
                margin: 0,
              }}
            >
              Destaques da Coleção
            </h2>
          </div>

          <Link
            to={path("/catalogo")}
            style={{
              fontSize: 12,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              color: "#4A3F35",
              textDecoration: "none",
              borderBottom: "1px solid #D4AF37",
              paddingBottom: 2,
            }}
            className="hover:text-amber-700"
          >
            Ver Todas as Peças →
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "2rem",
          }}
        >
          {featured.map((product) => (
            <AuraProductCard
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

      {/* Newsletter */}
      <section style={{ backgroundColor: "#F4EFEB", borderTop: "1px solid #E5DBD0", borderBottom: "1px solid #E5DBD0", padding: "4rem 1.5rem" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <span style={{ color: "#8C7A6B", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.25em" }}>
            Clube Aura
          </span>
          <h2
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(1.8rem, 3vw, 2.2rem)",
              fontWeight: 700,
              color: "#111111",
              marginTop: 8,
            }}
          >
            Receba Lançamentos & Vantagens Exclusivas
          </h2>
          <p style={{ fontSize: "0.85rem", color: "#8C7A6B", marginTop: 8, lineHeight: 1.6 }}>
            Inscreva-se com seu e-mail para ter acesso antecipado às novidades, convites VIP e descontos especiais.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              alert("Inscrição realizada com sucesso! Aproveite o cupom AURA10.");
            }}
            style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}
          >
            <input
              type="email"
              required
              placeholder="Digite seu melhor e-mail"
              style={{
                flex: "1 1 240px",
                maxWidth: 340,
                backgroundColor: "#FAF9F6",
                border: "1px solid #D1C2B2",
                borderRadius: 9999,
                padding: "12px 20px",
                fontSize: 12,
                outline: "none",
              }}
            />
            <button
              type="submit"
              style={{
                backgroundColor: "#111111",
                color: "#FAF9F6",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                padding: "12px 28px",
                borderRadius: 9999,
                border: "none",
                cursor: "pointer",
              }}
              className="hover:bg-amber-600"
            >
              Cadastrar
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
