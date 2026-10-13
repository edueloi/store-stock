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

  return (
    <article
      className="sw-product-card"
      style={{
        background: "rgba(24,24,27,.7)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: "1rem",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        transition: "border-color .25s",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "#facc15")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.08)")}
    >
      {/* Image */}
      <Link
        to={path(`/produto/${productRouteSegment(product)}`)}
        style={{ display: "block", position: "relative", overflow: "hidden", aspectRatio: "1/1", background: "#09090b" }}
      >
        {/* Brand badge */}
        <span style={{
          position: "absolute", top: 10, left: 10, zIndex: 10,
          background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)",
          color: "#facc15", fontSize: 10, fontWeight: 700, textTransform: "uppercase",
          padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(250,204,21,.3)",
          letterSpacing: ".06em",
        }}>
          {category || "Coleção"}
        </span>
        {/* Discount badge */}
        {discountPct > 0 && (
          <span style={{
            position: "absolute", top: 10, right: 44, zIndex: 10,
            background: "#ef4444", color: "#fff",
            fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 999,
          }}>
            -{discountPct}%
          </span>
        )}
        {/* Favorite */}
        <button
          aria-label="Favoritar"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onFavorite(); }}
          style={{
            position: "absolute", top: 10, right: 10, zIndex: 10,
            width: 32, height: 32, borderRadius: "50%", border: "none",
            background: saved ? "#facc15" : "rgba(255,255,255,.15)",
            color: saved ? "#000" : "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: "background .2s",
          }}
        >
          <Heart size={14} fill={saved ? "currentColor" : "none"} />
        </button>
        {image ? (
          <img
            src={image}
            alt={product.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform .5s" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLImageElement).style.transform = "scale(1.1)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLImageElement).style.transform = "scale(1)")}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <ShoppingBag size={40} style={{ color: "#3f3f46" }} />
          </div>
        )}
      </Link>

      {/* Info */}
      <div style={{ padding: "1.1rem", display: "flex", flexDirection: "column", gap: ".75rem", flex: 1 }}>
        <div style={{ flex: 1 }}>
          <Link
            to={path(`/produto/${productRouteSegment(product)}`)}
            style={{ textDecoration: "none" }}
          >
            <h3 style={{
              fontWeight: 700, color: "#f4f4f5", fontSize: ".9rem", lineHeight: 1.3,
              margin: "0 0 .3rem", transition: "color .2s",
            }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#facc15")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#f4f4f5")}
            >
              {product.name}
            </h3>
          </Link>
          {product.description && (
            <p style={{ color: "#71717a", fontSize: ".75rem", margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {product.description}
            </p>
          )}
        </div>

        {/* Price + Add */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #27272a", paddingTop: ".75rem" }}>
          <div>
            {originalPrice && (
              <span style={{ fontSize: 11, color: "#52525b", textDecoration: "line-through", display: "block" }}>
                {swMoney(originalPrice)}
              </span>
            )}
            <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#facc15" }}>
              {hidePrices ? "Sob consulta" : swMoney(price)}
            </span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            aria-label="Adicionar ao carrinho"
            style={{
              background: "#27272a",
              border: "none",
              borderRadius: "10px",
              padding: "10px 14px",
              color: "#f4f4f5",
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 11, fontWeight: 700,
              transition: "background .2s, color .2s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#facc15"; (e.currentTarget as HTMLElement).style.color = "#000"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#27272a"; (e.currentTarget as HTMLElement).style.color = "#f4f4f5"; }}
          >
            <ShoppingBag size={15} />
            <span style={{ display: "none" }} className="sm:inline">Comprar</span>
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
