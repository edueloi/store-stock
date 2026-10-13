import React, { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import { AuraEmpty, AuraProductCard, auraHidePrices } from "./ThemeParts";

export default function StoreCatalog() {
  const { slug: routeSlug } = useParams();
  const [params, setParams] = useSearchParams();
  const { tenant, products, categories, addToCart, wishlist, toggleWishlist } = useStore();
  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);

  const [query, setQuery] = useState(params.get("q") || "");
  const [sort, setSort] = useState<"featured" | "asc" | "desc">("featured");
  const categoryId = params.get("cat") ? Number(params.get("cat")) : null;

  const choose = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("cat", String(id));
    else next.delete("cat");
    setParams(next);
  };

  const visible = useMemo(() => {
    let list = products.filter(
      (item) =>
        item.is_active &&
        (!categoryId || item.category_id === categoryId) &&
        (!query ||
          `${item.name} ${item.description || ""}`
            .toLowerCase()
            .includes(query.toLowerCase())),
    );

    if (sort === "asc") {
      list = [...list].sort(
        (a, b) =>
          Number(a.discount_price || a.price) - Number(b.discount_price || b.price),
      );
    } else if (sort === "desc") {
      list = [...list].sort(
        (a, b) =>
          Number(b.discount_price || b.price) - Number(a.discount_price || a.price),
      );
    }
    return list;
  }, [products, categoryId, query, sort]);

  const hidePrices = auraHidePrices(tenant);

  return (
    <main className="aura-root" style={{ minHeight: "100vh", paddingBottom: "5rem" }}>
      <StoreSEO
        title={`Coleção Completa | ${tenant.name}`}
        description={`Catálogo de moda feminina exclusiva da ${tenant.name}.`}
        image={tenant.banner_url || tenant.logo_url}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      {/* Top Banner */}
      <section style={{ backgroundColor: "#F4EFEB", borderBottom: "1px solid #E5DBD0", padding: "3.5rem 1.5rem" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", textAlign: "center" }}>
          <span style={{ color: "#8C7A6B", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.25em" }}>
            Vitrine Exclusiva
          </span>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(2rem, 4vw, 3rem)",
              fontWeight: 700,
              color: "#111111",
              margin: "6px 0 0",
            }}
          >
            Coleção Completa
          </h1>
        </div>
      </section>

      {/* Controls */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "2.5rem 1.5rem 0" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "2rem" }}>
          {/* Pills Categorias */}
          <div style={{ display: "flex", gap: "6px", overflowX: "auto", maxWidth: "100%", paddingBottom: 4 }}>
            <button
              type="button"
              onClick={() => choose(null)}
              style={{
                backgroundColor: !categoryId ? "#111111" : "transparent",
                color: !categoryId ? "#FAF9F6" : "#4A3F35",
                border: "1px solid",
                borderColor: !categoryId ? "#111111" : "#D1C2B2",
                borderRadius: 9999,
                padding: "8px 18px",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s",
              }}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => choose(cat.id)}
                style={{
                  backgroundColor: categoryId === cat.id ? "#111111" : "transparent",
                  color: categoryId === cat.id ? "#FAF9F6" : "#4A3F35",
                  border: "1px solid",
                  borderColor: categoryId === cat.id ? "#111111" : "#D1C2B2",
                  borderRadius: 9999,
                  padding: "8px 18px",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.2s",
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Search & Sort */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", maxWidth: 440 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#8C7A6B" }} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  backgroundColor: "#FBF9F7",
                  border: "1px solid #E5DBD0",
                  borderRadius: 9999,
                  padding: "9px 36px 9px 38px",
                  fontSize: 12,
                  outline: "none",
                }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#8C7A6B" }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              style={{
                backgroundColor: "#FBF9F7",
                border: "1px solid #E5DBD0",
                borderRadius: 9999,
                padding: "9px 16px",
                fontSize: 12,
                color: "#111111",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="featured">Destaques</option>
              <option value="asc">Menor Preço</option>
              <option value="desc">Maior Preço</option>
            </select>
          </div>
        </div>

        {/* Results */}
        {visible.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "2rem",
            }}
          >
            {visible.map((product) => (
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
        ) : (
          <AuraEmpty
            onClear={() => {
              choose(null);
              setQuery("");
            }}
          />
        )}
      </div>
    </main>
  );
}
