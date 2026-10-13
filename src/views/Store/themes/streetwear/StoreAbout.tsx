import { Link, useParams } from "react-router-dom";
import { ArrowRight, MapPin, MessageCircle, ShieldCheck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import { swImage } from "./ThemeParts";

export default function StoreAbout() {
  const { slug: routeSlug } = useParams();
  const { tenant, products, categories } = useStore();
  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);

  const active = products.filter((p) => p.is_active);
  const images = active.map(swImage).filter(Boolean) as string[];
  const about =
    tenant.about_text ||
    "Nascemos da paixão genuína pelo skate, arte urbana e pela cultura sneakerhead. Mais do que uma loja de roupas, somos um manifesto de liberdade e autenticidade. Cada peça do nosso catálogo é escolhida a dedo para garantir que você tenha o melhor encaixe, durabilidade e atitude onde quer que vá.";

  const S = {
    bg: "#09090b",
    surface: "#18181b",
    accent: "#facc15",
    ink: "#f4f4f5",
    muted: "#71717a",
    border: "1px solid #27272a",
  } as const;

  return (
    <main
      className="sw-root"
      style={{ minHeight: "100vh", background: S.bg, color: S.ink, fontFamily: "'Inter', sans-serif", paddingBottom: "4rem" }}
    >
      <StoreSEO
        title={`Sobre | ${tenant.name}`}
        description={about}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
        keywords={`${tenant.name}, streetwear, moda urbana, sobre`}
      />

      {/* ── Hero banner ── */}
      <section style={{ background: S.accent, color: "#000", padding: "4rem 1.5rem" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".22em", margin: "0 0 1.25rem" }}>
            Sobre a marca
          </p>
          <h1 style={{ fontSize: "clamp(2.5rem,8vw,5.5rem)", fontWeight: 900, textTransform: "uppercase", lineHeight: .82, letterSpacing: "-.06em", margin: 0 }}>
            CRIADA NAS RUAS,<br />
            <span style={{ color: "#fff", textShadow: "2px 2px 0 #000" }}>VIVIDA NO ASFALTO</span>
          </h1>
        </div>
      </section>

      {/* ── Content ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "3rem" }}>
          <style>{`@media (min-width: 768px) { .sw-about-grid { grid-template-columns: 1fr .9fr !important; } }`}</style>
          <div className="sw-about-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: "3rem" }}>
            {/* Text */}
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(250,204,21,.1)", border: "1px solid rgba(250,204,21,.3)", borderRadius: 9999, padding: "6px 14px", marginBottom: "1.25rem" }}>
                <span style={{ color: S.accent, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".14em" }}>Nossa essência</span>
              </div>
              <p style={{ fontSize: "1.05rem", color: "#d4d4d8", lineHeight: 1.75, whiteSpace: "pre-line", margin: "0 0 2rem" }}>
                {about}
              </p>

              {/* CTA buttons */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: ".75rem", marginBottom: "2.5rem" }}>
                <Link
                  to={path("/catalogo")}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    background: S.accent, color: "#000",
                    fontWeight: 700, fontSize: ".75rem", textTransform: "uppercase",
                    letterSpacing: ".1em", textDecoration: "none",
                    padding: "12px 24px", borderRadius: "10px",
                  }}
                >
                  Explorar o catálogo <ArrowRight size={13} />
                </Link>
                {tenant.whatsapp && (
                  <a
                    href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      background: "transparent", color: S.ink,
                      border: "1px solid #3f3f46",
                      fontWeight: 700, fontSize: ".75rem", textTransform: "uppercase",
                      letterSpacing: ".1em", textDecoration: "none",
                      padding: "12px 24px", borderRadius: "10px",
                    }}
                  >
                    <MessageCircle size={13} /> Falar com a loja
                  </a>
                )}
              </div>

              {/* Values */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                {[
                  { title: "Autenticidade", text: "Trabalhamos apenas com marcas autorizadas e drops legítimos." },
                  { title: "Comunidade", text: "Apoiadores de skatistas locais e da arte urbana independente." },
                ].map((item) => (
                  <div
                    key={item.title}
                    style={{
                      background: "rgba(24,24,27,.7)", backdropFilter: "blur(12px)",
                      border: "1px solid rgba(255,255,255,.08)",
                      borderLeft: `4px solid ${S.accent}`,
                      borderRadius: "10px", padding: "1rem",
                    }}
                  >
                    <h4 style={{ fontSize: ".75rem", fontWeight: 900, textTransform: "uppercase", color: S.ink, margin: "0 0 .4rem" }}>{item.title}</h4>
                    <p style={{ fontSize: ".7rem", color: S.muted, margin: 0, lineHeight: 1.5 }}>{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Image collage */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".75rem", minHeight: 340 }}>
              {images.length >= 2 ? (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: ".75rem" }}>
                    <img src={images[0]} alt="Produto" style={{ borderRadius: "12px", objectFit: "cover", height: 190, width: "100%", border: S.border }} />
                    <img src={images[1]} alt="Produto" style={{ borderRadius: "12px", objectFit: "cover", height: 250, width: "100%", border: S.border }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: ".75rem", paddingTop: "2.5rem" }}>
                    {images[2] && <img src={images[2]} alt="Produto" style={{ borderRadius: "12px", objectFit: "cover", height: 250, width: "100%", border: S.border }} />}
                    {images[3] && <img src={images[3]} alt="Produto" style={{ borderRadius: "12px", objectFit: "cover", height: 190, width: "100%", border: S.border }} />}
                  </div>
                </>
              ) : (
                <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", justifyContent: "center", background: S.surface, borderRadius: 12, border: S.border }}>
                  <p style={{ color: S.muted, fontSize: ".875rem" }}>As fotos dos seus produtos aparecem aqui.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 1, border: "1px solid #27272a", borderRadius: "1rem", overflow: "hidden", marginTop: "3rem", background: "#27272a" }}>
          <div style={{ background: S.surface, padding: "1.5rem" }}>
            <p style={{ fontSize: "2rem", fontWeight: 900, color: S.accent, margin: "0 0 .25rem" }}>{active.length}</p>
            <p style={{ fontSize: 10, fontWeight: 700, color: S.muted, textTransform: "uppercase", letterSpacing: ".14em", margin: 0 }}>Peças no catálogo</p>
          </div>
          <div style={{ background: S.surface, padding: "1.5rem" }}>
            <p style={{ fontSize: "2rem", fontWeight: 900, color: S.accent, margin: "0 0 .25rem" }}>{categories.length}</p>
            <p style={{ fontSize: 10, fontWeight: 700, color: S.muted, textTransform: "uppercase", letterSpacing: ".14em", margin: 0 }}>Linhas de produto</p>
          </div>
          <div style={{ background: S.surface, padding: "1.5rem" }}>
            {tenant.address ? (
              <>
                <MapPin size={20} style={{ color: S.accent }} />
                <p style={{ fontSize: ".9rem", fontWeight: 700, margin: ".75rem 0 0", color: S.ink }}>{tenant.address}</p>
              </>
            ) : (
              <>
                <ShieldCheck size={20} style={{ color: S.accent }} />
                <p style={{ fontSize: ".9rem", fontWeight: 700, margin: ".75rem 0 0", color: S.ink }}>Pedido online com confirmação da loja</p>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
