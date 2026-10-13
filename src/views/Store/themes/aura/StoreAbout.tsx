import React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, MapPin, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";

export default function StoreAbout() {
  const { slug: routeSlug } = useParams();
  const { tenant, products, categories } = useStore();
  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);

  const active = products.filter((p) => p.is_active);
  const about =
    tenant.about_text ||
    "Aura Feminina nasceu com o propósito de vestir mulheres com elegância, confiança e conforto. Cada criação une o rigor da alfaiataria clássica à leveza dos tecidos contemporâneos, proporcionando silhuetas sofisticadas e marcantes.";

  return (
    <main className="aura-root" style={{ minHeight: "100vh", paddingBottom: "5rem" }}>
      <StoreSEO
        title={`Sobre Nós | ${tenant.name}`}
        description={about}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      {/* Banner */}
      <section style={{ backgroundColor: "#F4EFEB", borderBottom: "1px solid #E5DBD0", padding: "4rem 1.5rem" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", textAlign: "center" }}>
          <span style={{ color: "#8C7A6B", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.25em" }}>
            Nossa Trajetória
          </span>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(2.2rem, 5vw, 3.5rem)",
              fontWeight: 700,
              color: "#111111",
              margin: "10px 0 0",
              lineHeight: 1.15,
            }}
          >
            Moda com Propósito, Elegância com Alma
          </h1>
        </div>
      </section>

      {/* Content */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "4rem 1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "3rem", alignItems: "center" }}>
          <div>
            <span style={{ color: "#D4AF37", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={16} /> Manifesto
            </span>

            <p style={{ fontSize: "1.05rem", color: "#4A3F35", lineHeight: 1.8, margin: "16px 0 24px", whiteSpace: "pre-line", fontWeight: 300 }}>
              {about}
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
              <Link
                to={path("/catalogo")}
                style={{
                  backgroundColor: "#111111",
                  color: "#FAF9F6",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  padding: "14px 32px",
                  borderRadius: 9999,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
                className="hover:bg-amber-600"
              >
                Conhecer a Coleção <ArrowRight size={14} />
              </Link>

              {tenant.whatsapp && (
                <a
                  href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    border: "1px solid #D1C2B2",
                    color: "#111111",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    padding: "14px 28px",
                    borderRadius: 9999,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                  className="hover:bg-stone-100"
                >
                  <MessageCircle size={14} /> Falar com a Estilista
                </a>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ backgroundColor: "#FBF9F7", border: "1px solid #E5DBD0", padding: "1.5rem", borderRadius: "1rem" }}>
              <h4 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", fontWeight: 700, margin: "0 0 6px", color: "#111111" }}>
                Acabamento Impecável
              </h4>
              <p style={{ fontSize: 12, color: "#8C7A6B", margin: 0, lineHeight: 1.6 }}>
                Selecionamos tecidos nobres, costura reforçada e forros acetinados para garantir caimento perfeito e durabilidade.
              </p>
            </div>

            <div style={{ backgroundColor: "#FBF9F7", border: "1px solid #E5DBD0", padding: "1.5rem", borderRadius: "1rem" }}>
              <h4 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", fontWeight: 700, margin: "0 0 6px", color: "#111111" }}>
                Atendimento Personalizado
              </h4>
              <p style={{ fontSize: 12, color: "#8C7A6B", margin: 0, lineHeight: 1.6 }}>
                Nossa consultoria de estilo está disponível para tirar dúvidas de medidas e sugerir combinações perfeitas.
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1.5rem",
            marginTop: "4rem",
            paddingTop: "3rem",
            borderTop: "1px solid #E5DBD0",
          }}
        >
          <div>
            <span style={{ fontSize: "2.5rem", fontWeight: 700, fontFamily: "'Playfair Display', serif", color: "#111111" }}>
              +{active.length}
            </span>
            <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.15em", color: "#8C7A6B", margin: "4px 0 0" }}>
              Peças Exclusivas
            </p>
          </div>

          <div>
            <span style={{ fontSize: "2.5rem", fontWeight: 700, fontFamily: "'Playfair Display', serif", color: "#111111" }}>
              +{categories.length}
            </span>
            <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.15em", color: "#8C7A6B", margin: "4px 0 0" }}>
              Linhas & Estilos
            </p>
          </div>

          <div>
            <span style={{ fontSize: "2.5rem", fontWeight: 700, fontFamily: "'Playfair Display', serif", color: "#D4AF37" }}>
              100%
            </span>
            <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.15em", color: "#8C7A6B", margin: "4px 0 0" }}>
              Satisfação & Qualidade
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
