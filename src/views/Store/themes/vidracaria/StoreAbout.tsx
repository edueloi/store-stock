import { Link, useParams } from "react-router-dom";
import { ArrowRight, Compass, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";

export default function StoreAbout() {
  const { slug: routeSlug } = useParams();
  const { tenant } = useStore();
  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);

  const whatsappLink = tenant.whatsapp
    ? `https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent("Olá! Gostaria de conversar com um especialista sobre um projeto em vidro.")}`
    : null;

  return (
    <main className="vitra-root" style={{ minHeight: "100vh", paddingBottom: "80px" }}>
      <StoreSEO
        title={`Sobre Nós | ${tenant.name}`}
        description={tenant.about_text || "Conheça a nossa história, tradição e paixão pela transformação de espaços com vidro e design."}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      {/* ── PAGE TITLE ── */}
      <section style={{ background: "var(--vitra-bg)", borderBottom: "1px solid var(--vitra-line)", padding: "48px 1.5rem" }}>
        <div style={{ maxWidth: 1250, margin: "0 auto" }}>
          <div style={{ color: "var(--vitra-muted)", fontSize: 12, marginBottom: 12 }}>
            <Link to={path()} style={{ textDecoration: "none", color: "inherit" }}>Início</Link>
            {" / "}
            <b style={{ color: "var(--vitra-ink)" }}>Sobre nós</b>
          </div>
          <h1
            style={{
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 800,
              fontSize: "clamp(2rem, 3.5vw, 2.75rem)",
              letterSpacing: "-1.5px",
              margin: 0,
              color: "var(--vitra-ink)",
            }}
          >
            Conheça a {tenant.name}
          </h1>
        </div>
      </section>

      {/* ── ABOUT CONTENT ── */}
      <section style={{ padding: "80px 1.5rem" }}>
        <div style={{ maxWidth: 1250, margin: "0 auto" }}>
          <style>{`
            @media (min-width: 900px) {
              .vitra-about-full { grid-template-columns: 1fr 1fr !important; }
            }
          `}</style>
          <div
            className="vitra-about-full"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "60px",
              alignItems: "center",
            }}
          >
            {/* Copy */}
            <div>
              <div className="vitra-eyebrow">Nossa essência</div>
              <h2
                style={{
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: 800,
                  fontSize: "clamp(2rem, 3.5vw, 2.6rem)",
                  lineHeight: 1.2,
                  letterSpacing: "-1.8px",
                  margin: "18px 0 20px",
                  color: "var(--vitra-ink)",
                }}
              >
                Transparência é parte de quem somos.
              </h2>
              <p style={{ lineHeight: 1.9, color: "var(--vitra-muted)", fontSize: 15, margin: "0 0 16px" }}>
                {tenant.about_text ||
                  "Somos apaixonados por arquitetura, design e pelas infinitas possibilidades que o vidro proporciona. Nossa missão é transformar ideias em ambientes que unem estética, conforto, luminosidade e funcionalidade."}
              </p>
              <p style={{ lineHeight: 1.9, color: "var(--vitra-muted)", fontSize: 15, margin: "0 0 28px" }}>
                Trabalhamos com atenção minuciosa ao projeto, matéria-prima de procedência comprovada e acompanhamento técnico em cada etapa — da medição precisa à instalação final impecável.
              </p>

              {/* Stats */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "15px",
                  padding: "24px 0",
                  borderTop: "1px solid var(--vitra-line)",
                  borderBottom: "1px solid var(--vitra-line)",
                  marginBottom: "28px",
                }}
              >
                <div>
                  <strong style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 28, color: "var(--vitra-ink)", display: "block" }}>
                    15+
                  </strong>
                  <span style={{ fontSize: 12, color: "var(--vitra-muted)", marginTop: 4, display: "block" }}>
                    Anos de tradição
                  </span>
                </div>
                <div>
                  <strong style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 28, color: "var(--vitra-accent)", display: "block" }}>
                    100%
                  </strong>
                  <span style={{ fontSize: 12, color: "var(--vitra-muted)", marginTop: 4, display: "block" }}>
                    Foco na qualidade
                  </span>
                </div>
                <div>
                  <strong style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 28, color: "var(--vitra-ink)", display: "block" }}>
                    1:1
                  </strong>
                  <span style={{ fontSize: 12, color: "var(--vitra-muted)", marginTop: 4, display: "block" }}>
                    Atendimento próximo
                  </span>
                </div>
              </div>

              <Link to={path("/catalogo")} className="vitra-btn-primary">
                Ver nossos produtos →
              </Link>
            </div>

            {/* Photo */}
            <div>
              <img
                src="https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1000&q=85"
                alt="Espaço contemporâneo com superfícies de vidro"
                style={{
                  width: "100%",
                  height: "clamp(340px, 45vw, 560px)",
                  objectFit: "cover",
                  borderRadius: 6,
                }}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── BANNER ORÇAMENTO ── */}
      <section style={{ padding: "0 1.5rem" }}>
        <div style={{ maxWidth: 1250, margin: "0 auto" }}>
          <div
            style={{
              background: "var(--vitra-bg)",
              border: "1px solid var(--vitra-line)",
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
                  color: "var(--vitra-ink)",
                }}
              >
                Seu próximo projeto começa aqui.
              </h2>
              <p style={{ color: "var(--vitra-muted)", margin: 0, lineHeight: 1.7, fontSize: 14 }}>
                Entre em contato para falar sobre dimensões, materiais e possibilidades.
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
                Falar com especialista ↗
              </a>
            ) : (
              <Link to={path("/catalogo")} className="vitra-btn-primary" style={{ whiteSpace: "nowrap" }}>
                Ver catálogo de peças ↗
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
