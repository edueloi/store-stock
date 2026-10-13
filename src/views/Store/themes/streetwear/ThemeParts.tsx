import { Link } from "react-router-dom";
import { Heart, ShoppingBag } from "lucide-react";
import { productRouteSegment } from "../../store-routing";

/* ── Helpers ── */
export const swImage = (product: { image_url?: string | null; images?: unknown }) =>
  (Array.isArray(product.images) && typeof product.images[0] === "string"
    ? product.images[0]
    : product.image_url) || null;

export const swMoney = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const swHidePrices = (tenant: any) =>
  tenant.policies?.storefront?.checkout_mode === "order_request" ||
  tenant.policies?.storefront?.hide_prices === true;

/* ── Product Card ── */
export function SwProductCard({
  product,
  path,
  category,
  saved,
  onFavorite,
  onAdd,
  hidePrices,
}: any) {
  const image = swImage(product);
  const price = Number(product.discount_price || product.price);
  const originalPrice = product.discount_price ? Number(product.price) : null;
  const discountPct = originalPrice
    ? Math.round((1 - price / originalPrice) * 100)
    : 0;
  const installment = (price / 6).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <article
      className="sw-product-card"
      style={{
        background: "rgba(24, 24, 27, 0.85)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "1.25rem",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* Image container */}
      <Link
        to={path(`/produto/${productRouteSegment(product)}`)}
        style={{
          display: "block",
          position: "relative",
          overflow: "hidden",
          aspectRatio: "1/1",
          background: "#121214",
        }}
      >
        {/* Brand/Category badge */}
        <span
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 10,
            background: "rgba(9, 9, 11, 0.85)",
            backdropFilter: "blur(8px)",
            color: "#facc15",
            fontSize: 9,
            fontWeight: 800,
            textTransform: "uppercase",
            padding: "5px 10px",
            borderRadius: 8,
            border: "1px solid rgba(250, 204, 21, 0.3)",
            letterSpacing: ".08em",
          }}
        >
          {category || "DROP EXCLUSIVO"}
        </span>

        {/* Discount badge */}
        {discountPct > 0 && (
          <span
            style={{
              position: "absolute",
              top: 12,
              right: 48,
              zIndex: 10,
              background: "#ef4444",
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              padding: "4px 8px",
              borderRadius: 6,
              letterSpacing: ".02em",
            }}
          >
            -{discountPct}%
          </span>
        )}

        {/* Wishlist Button */}
        <button
          aria-label="Favoritar"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onFavorite?.();
          }}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 10,
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "none",
            background: saved ? "#facc15" : "rgba(24, 24, 27, 0.75)",
            backdropFilter: "blur(6px)",
            color: saved ? "#000" : "#f4f4f5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          <Heart size={14} fill={saved ? "currentColor" : "none"} />
        </button>

        {/* Product Image */}
        {image ? (
          <img
            src={image}
            alt={product.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLImageElement).style.transform = "scale(1.08)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLImageElement).style.transform = "scale(1)")}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <ShoppingBag size={40} style={{ color: "#3f3f46" }} />
          </div>
        )}
      </Link>

      {/* Info Container */}
      <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: ".6rem", flex: 1, justifyContent: "space-between" }}>
        <div>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#71717a", textTransform: "uppercase", letterSpacing: ".1em", display: "block", marginBottom: 4 }}>
            {category || "Streetwear"}
          </span>
          <Link
            to={path(`/produto/${productRouteSegment(product)}`)}
            style={{ textDecoration: "none" }}
          >
            <h3
              style={{
                fontWeight: 800,
                color: "#f4f4f5",
                fontSize: ".95rem",
                lineHeight: 1.35,
                margin: "0 0 .35rem",
                textTransform: "uppercase",
                letterSpacing: "-0.01em",
                transition: "color .2s",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#facc15")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#f4f4f5")}
            >
              {product.name}
            </h3>
          </Link>
          {product.description && (
            <p style={{ color: "#71717a", fontSize: ".75rem", margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.4 }}>
              {product.description}
            </p>
          )}
        </div>

        {/* Price & Action Row */}
        <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: ".85rem", marginTop: ".25rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".5rem" }}>
          <div>
            {originalPrice && (
              <span style={{ fontSize: 11, color: "#71717a", textDecoration: "line-through", display: "block", lineHeight: 1.2 }}>
                {swMoney(originalPrice)}
              </span>
            )}
            <span style={{ fontSize: "1.15rem", fontWeight: 900, color: "#facc15", letterSpacing: "-0.02em", display: "block" }}>
              {hidePrices ? "Sob consulta" : swMoney(price)}
            </span>
            {!hidePrices && price > 0 && (
              <span style={{ fontSize: 10, color: "#a1a1aa", display: "block", marginTop: 2 }}>
                6x de R$ {installment}
              </span>
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdd?.();
            }}
            aria-label="Adicionar ao carrinho"
            style={{
              background: "#27272a",
              border: "1px solid #3f3f46",
              borderRadius: "12px",
              padding: "10px 14px",
              color: "#f4f4f5",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: ".05em",
              transition: "all .2s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#facc15";
              (e.currentTarget as HTMLElement).style.color = "#000";
              (e.currentTarget as HTMLElement).style.borderColor = "#facc15";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 12px rgba(250, 204, 21, 0.4)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#27272a";
              (e.currentTarget as HTMLElement).style.color = "#f4f4f5";
              (e.currentTarget as HTMLElement).style.borderColor = "#3f3f46";
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
          >
            <ShoppingBag size={14} />
            <span>Comprar</span>
          </button>
        </div>
      </div>
    </article>
  );
}

/* ── Empty State ── */
export function SwEmpty({ onClear }: { onClear?: () => void }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: 300, textAlign: "center", color: "#f4f4f5",
      border: "1px dashed #3f3f46", borderRadius: "1rem",
      background: "rgba(24,24,27,.4)", padding: "2rem",
    }}>
      <ShoppingBag size={44} style={{ color: "#3f3f46", marginBottom: "1rem" }} />
      <h3 style={{ fontSize: "1.2rem", fontWeight: 700, textTransform: "uppercase", margin: "0 0 .5rem" }}>
        Nenhum produto encontrado
      </h3>
      <p style={{ color: "#71717a", fontSize: ".875rem", margin: "0 0 1.25rem" }}>
        Tente buscar por outro termo ou categoria.
      </p>
      {onClear && (
        <button
          onClick={onClear}
          style={{
            background: "#facc15", color: "#000",
            border: "none", borderRadius: "10px",
            padding: "10px 20px", fontWeight: 700,
            fontSize: ".75rem", textTransform: "uppercase",
            letterSpacing: ".08em", cursor: "pointer",
          }}
        >
          Ver todos os produtos
        </button>
      )}
    </div>
  );
}
