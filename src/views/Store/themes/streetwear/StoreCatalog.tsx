import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import { SwProductCard, SwEmpty, swHidePrices } from "./ThemeParts";

export default function StoreCatalog() {
  const { slug: routeSlug } = useParams();
  const [params, setParams] = useSearchParams();
  const { tenant, products, categories, addToCart, wishlist, toggleWishlist } = useStore();
  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);
  const [query, setQuery] = useState(params.get("q") || "");
  const categoryId = params.get("cat") ? Number(params.get("cat")) : null;

  const visible = useMemo(
    () =>
      products.filter(
        (p) =>
          p.is_active &&
          (!categoryId || p.category_id === categoryId) &&
          (!query ||
            `${p.name} ${p.description || ""}`.toLowerCase().includes(query.toLowerCase())),
      ),
    [products, categoryId, query],
  );

  const choose = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("cat", String(id));
    else next.delete("cat");
    setParams(next);
  };

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
        title={`Catálogo | ${tenant.name}`}
        description={`Catálogo streetwear da ${tenant.name}.`}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
        keywords={`${tenant.name}, streetwear, catálogo, drops`}
      />

      {/* ── Header section ── */}
      <section style={{ background: S.surface, borderBottom: S.border, padding: "3.5rem 1.5rem 2.5rem" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: S.accent, textTransform: "uppercase", letterSpacing: ".22em", margin: "0 0 .75rem" }}>
            Catálogo / drop atual
          </p>
          <h1 style={{ fontSize: "clamp(2rem,6vw,4rem)", fontWeight: 900, textTransform: "uppercase", lineHeight: .85, letterSpacing: "-.05em", margin: 0 }}>
            Escolha sua<br />
            <span style={{ color: S.accent }}>próxima peça.</span>
          </h1>
        </div>
      </section>

      {/* ── Filters ── */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "2rem 1.5rem 0" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", borderBottom: S.border, paddingBottom: "1.5rem" }}>
          {/* Category pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", overflowX: "auto", scrollbarWidth: "none" }}>
            <button
              onClick={() => choose(null)}
              style={{
                flexShrink: 0, border: `1px solid ${!categoryId ? S.accent : "#3f3f46"}`,
                background: !categoryId ? S.accent : "transparent",
                color: !categoryId ? "#000" : "#a1a1aa",
                padding: "8px 16px", fontSize: 10, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: ".1em",
                borderRadius: 10, cursor: "pointer", transition: "all .2s",
              }}
            >
              Tudo ({products.filter((p) => p.is_active).length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => choose(cat.id)}
                style={{
                  flexShrink: 0,
                  border: `1px solid ${categoryId === cat.id ? S.accent : "#3f3f46"}`,
                  background: categoryId === cat.id ? S.accent : "transparent",
                  color: categoryId === cat.id ? "#000" : "#a1a1aa",
                  padding: "8px 16px", fontSize: 10, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: ".1em",
                  borderRadius: 10, cursor: "pointer", transition: "all .2s",
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: "relative", maxWidth: 380 }}>
            <Search size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: S.accent, pointerEvents: "none" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar no drop..."
              style={{
                width: "100%", boxSizing: "border-box",
                background: "#000", border: "1px solid #3f3f46",
                borderRadius: 10, padding: "10px 40px 10px 40px",
                fontSize: ".875rem", color: S.ink,
                outline: "none", fontFamily: "'Inter', sans-serif",
                transition: "border-color .2s",
              }}
              onFocus={(e) => ((e.currentTarget as HTMLInputElement).style.borderColor = S.accent)}
              onBlur={(e) => ((e.currentTarget as HTMLInputElement).style.borderColor = "#3f3f46")}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#71717a", cursor: "pointer" }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Results count */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "1.25rem", marginBottom: "1.5rem" }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: S.muted, textTransform: "uppercase", letterSpacing: ".12em", margin: 0 }}>
            {visible.length} peças encontradas
          </p>
          <p style={{ fontSize: 10, fontWeight: 700, color: S.accent, textTransform: "uppercase", letterSpacing: ".12em", margin: 0 }}>
            {categories.find((c) => c.id === categoryId)?.name || "Todos os drops"}
          </p>
        </div>

        {/* Grid */}
        {visible.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: ".75rem" }}>
            {visible.map((product) => (
              <SwProductCard
                key={product.id}
                product={product}
                category={categories.find((c) => c.id === product.category_id)?.name}
                path={path}
                saved={wishlist.includes(product.id)}
                onFavorite={() => toggleWishlist(product.id)}
                onAdd={() => addToCart(product)}
                hidePrices={swHidePrices(tenant)}
              />
            ))}
          </div>
        ) : (
          <SwEmpty onClear={() => { choose(null); setQuery(""); }} />
        )}
      </div>
    </main>
  );
}
