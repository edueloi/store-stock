import { Link, useParams } from "react-router-dom";
import { ArrowRight, MessageCircle, ShoppingBag, Zap } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import { SwProductCard, swHidePrices, swImage } from "./ThemeParts";

export default function StoreFront() {
  const { slug: routeSlug } = useParams();
  const { tenant, products, categories, addToCart, wishlist, toggleWishlist } = useStore();
  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);

  const active = products.filter((p) => p.is_active);
  const featured = (active.filter((p) => p.is_featured).length
    ? active.filter((p) => p.is_featured)
    : active
  ).slice(0, 4);
  const shownCategories = categories
    .filter((c) => active.some((p) => p.category_id === c.id))
    .slice(0, 6);
  const heroImage = tenant.banner_url || swImage(featured[0] as any);
  const hidePrices = swHidePrices(tenant);

  /* -- Inline style tokens -- */
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
      style={{ minHeight: "100vh", background: S.bg, color: S.ink, fontFamily: "'Inter', sans-serif", overflowX: "hidden" }}
    >
      <StoreSEO
        title={`${tenant.name} | Streetwear`}
        description={tenant.about_text || `Drops, moda urbana e acessórios na ${tenant.name}.`}
        image={heroImage || ""}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
        keywords={`${tenant.name}, streetwear, moda urbana, sneakers`}
      />

      {/* ── Announcement bar ── */}
      <section style={{ background: S.accent, color: "#000", textAlign: "center", fontSize: 9, fontWeight: 700, letterSpacing: ".22em", textTransform: "uppercase", padding: "8px 16px" }}>
        Drop ativo · Pedido online · Envio para todo Brasil
      </section>

      {/* ── HERO ── */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          minHeight: 600,
          borderBottom: S.border,
          padding: "4rem 1.5rem 6rem",
          display: "flex",
          alignItems: "flex-end",
        }}
      >
        {/* Background */}
        <div
          style={{
            position: "absolute", inset: 0, zIndex: 0,
            ...(heroImage
              ? {
                  backgroundImage: `linear-gradient(90deg,rgba(0,0,0,.92) 0%,rgba(0,0,0,.5) 55%,rgba(0,0,0,.15) 100%),url(${heroImage})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : { background: "radial-gradient(circle at 78% 32%,#3f3f46 0,transparent 25%),linear-gradient(135deg,#18181b 0%,#09090b 60%)" }),
          }}
        />
        {/* Dot grid overlay */}
        <div
          style={{
            position: "absolute", inset: 0, zIndex: 0, opacity: .15,
            backgroundImage: "radial-gradient(#facc15 1px,transparent 1px)",
            backgroundSize: "24px 24px",
            pointerEvents: "none",
          }}
        />

        {/* Content */}
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto", width: "100%" }}>
          {/* Tag */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(250,204,21,.1)", border: "1px solid rgba(250,204,21,.3)", borderRadius: 9999, padding: "6px 14px", marginBottom: "1.5rem" }}>
            <Zap size={12} style={{ color: S.accent }} />
            <span style={{ color: S.accent, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".14em" }}>
              {tenant.hero_tagline || "Nova Coleção 2026"}
            </span>
          </div>

          <h1 style={{ fontSize: "clamp(2.5rem,8vw,6rem)", fontWeight: 900, textTransform: "uppercase", lineHeight: .9, letterSpacing: "-.05em", margin: "0 0 1.25rem" }}>
            STREETWEAR<br />
            <span style={{ color: S.accent }}>& CULTURA</span>
          </h1>
          <p style={{ color: "#a1a1aa", fontSize: "clamp(.9rem,2vw,1.1rem)", maxWidth: 480, lineHeight: 1.6, margin: "0 0 2rem" }}>
            {tenant.about_text || "Peças, acessórios e lançamentos para quem transforma a rua em identidade."}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: ".75rem" }}>
            <Link
              to={path("/catalogo")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: S.accent, color: "#000",
                fontWeight: 700, fontSize: ".75rem", textTransform: "uppercase",
                letterSpacing: ".1em", textDecoration: "none",
                padding: "14px 28px", borderRadius: "12px",
              }}
            >
              Explorar Catálogo <ArrowRight size={14} />
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
                  padding: "14px 28px", borderRadius: "12px",
                }}
              >
                <MessageCircle size={14} /> WhatsApp
              </a>
            )}
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,auto)", gap: "1.5rem", marginTop: "3rem", paddingTop: "2rem", borderTop: "1px solid rgba(255,255,255,.08)", maxWidth: 380 }}>
            <div>
              <div style={{ fontSize: "1.5rem", fontWeight: 900, color: S.accent }}>+{active.length}</div>
              <div style={{ fontSize: 10, color: S.muted, textTransform: "uppercase", letterSpacing: ".1em" }}>Produtos</div>
            </div>
            <div>
              <div style={{ fontSize: "1.5rem", fontWeight: 900, color: S.ink }}>100%</div>
              <div style={{ fontSize: 10, color: S.muted, textTransform: "uppercase", letterSpacing: ".1em" }}>Original</div>
            </div>
            <div>
              <div style={{ fontSize: "1.5rem", fontWeight: 900, color: S.accent }}>24h</div>
              <div style={{ fontSize: 10, color: S.muted, textTransform: "uppercase", letterSpacing: ".1em" }}>Envio rápido</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Category pills ── */}
      {shownCategories.length > 0 && (
        <section style={{ background: S.surface, borderBottom: S.border, padding: "1rem 1.5rem" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", gap: ".5rem", overflowX: "auto", scrollbarWidth: "none" }}>
            <span style={{ background: S.accent, color: "#000", flexShrink: 0, padding: "10px 16px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", borderRadius: 8 }}>
              Shop por categoria
            </span>
            {shownCategories.map((cat) => (
              <Link
                key={cat.id}
                to={path(`/catalogo?cat=${cat.id}`)}
                style={{
                  flexShrink: 0, border: "1px solid #3f3f46",
                  padding: "10px 16px", fontSize: 10, fontWeight: 600,
                  textTransform: "uppercase", letterSpacing: ".1em",
                  color: "#a1a1aa", textDecoration: "none", borderRadius: 8,
                  transition: "border-color .2s, color .2s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = S.accent; (e.currentTarget as HTMLElement).style.color = S.accent; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#3f3f46"; (e.currentTarget as HTMLElement).style.color = "#a1a1aa"; }}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Featured products ── */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "4rem 1.5rem" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "2rem" }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: S.accent, textTransform: "uppercase", letterSpacing: ".2em", margin: 0 }}>Em destaque</p>
            <h2 style={{ fontSize: "clamp(1.8rem,4vw,3rem)", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-.04em", margin: ".5rem 0 0" }}>No Radar Agora.</h2>
          </div>
          <Link to={path("/catalogo")} style={{ fontSize: 10, fontWeight: 700, color: S.accent, textTransform: "uppercase", letterSpacing: ".12em", textDecoration: "none" }}>
            Ver tudo →
          </Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: ".75rem" }}>
          {featured.map((product) => (
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

      {/* ── Trust bar ── */}
      <section style={{ background: S.accent, color: "#000", borderTop: "1px solid #3f3f46", borderBottom: "1px solid #3f3f46" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "3rem 1.5rem", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "2rem" }}>
          {[
            { icon: <ShoppingBag size={22} />, title: "Pedido sem enrolação", text: "Escolha, adicione e envie seu pedido online." },
            { icon: <Zap size={22} />, title: "Drops atualizados", text: "O catálogo acompanha o estoque da loja." },
            { icon: <MessageCircle size={22} />, title: "Atendimento real", text: "Dúvidas? A equipe responde no WhatsApp." },
          ].map((item) => (
            <div key={item.title}>
              {item.icon}
              <p style={{ margin: "1rem 0 .25rem", fontSize: "1rem", fontWeight: 900, textTransform: "uppercase" }}>{item.title}</p>
              <p style={{ margin: 0, fontSize: ".875rem" }}>{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
