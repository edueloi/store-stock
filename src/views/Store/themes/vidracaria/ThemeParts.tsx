import { Link } from "react-router-dom";
import { ArrowRight, Eye, ShoppingBag } from "lucide-react";
import { productRouteSegment } from "../../store-routing";

export const vitraImage = (product: { image_url?: string | null; images?: unknown }) =>
  (Array.isArray(product.images) && typeof product.images[0] === "string"
    ? product.images[0]
    : product.image_url) || null;

export const vitraMoney = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const vitraHidePrices = (tenant: any) =>
  tenant.policies?.storefront?.checkout_mode === "order_request" ||
  tenant.policies?.storefront?.hide_prices === true;

export function VitraProductCard({
  product,
  path,
  category,
  onAdd,
  hidePrices,
}: any) {
  const image = vitraImage(product);
  const price = Number(product.discount_price || product.price);

  return (
    <article className="vitra-product-card">
      <Link
        to={path(`/produto/${productRouteSegment(product)}`)}
        className="vitra-product-img"
        style={{ display: "block", textDecoration: "none" }}
      >
        {image ? (
          <img src={image} alt={product.name} loading="lazy" />
        ) : (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShoppingBag size={40} style={{ color: "#a5b5b2" }} />
          </div>
        )}
        <span className="vitra-pill">
          {category || "Sob medida"}
        </span>
      </Link>

      <div style={{ padding: "18px", display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
        <div>
          <span
            style={{
              color: "var(--vitra-accent-dark)",
              textTransform: "uppercase",
              letterSpacing: "1.3px",
              fontSize: 10,
              fontWeight: 800,
              display: "block",
            }}
          >
            {category || "Projetos em vidro"}
          </span>
          <Link
            to={path(`/produto/${productRouteSegment(product)}`)}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <h3
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 15,
                lineHeight: 1.45,
                margin: "8px 0 10px",
                fontWeight: 700,
                color: "var(--vitra-ink)",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                minHeight: 44,
              }}
            >
              {product.name}
            </h3>
          </Link>

          {product.description && (
            <p
              style={{
                color: "var(--vitra-muted)",
                fontSize: 12,
                margin: "0 0 12px",
                lineHeight: 1.5,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {product.description}
            </p>
          )}
        </div>

        <div>
          <div style={{ margin: "8px 0 12px" }}>
            <span
              style={{
                fontFamily: "'Manrope', sans-serif",
                fontWeight: 800,
                fontSize: 19,
                color: "var(--vitra-ink)",
                display: "block",
              }}
            >
              {hidePrices ? "Sob consulta" : vitraMoney(price)}
            </span>
            <small
              style={{
                display: "block",
                color: "var(--vitra-muted)",
                fontSize: 11,
                marginTop: 2,
              }}
            >
              A partir de • orçamento sob medida
            </small>
          </div>

          <Link
            to={path(`/produto/${productRouteSegment(product)}`)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              width: "100%",
              height: 40,
              background: "#ffffff",
              border: "1px solid var(--vitra-line)",
              borderRadius: 6,
              color: "var(--vitra-ink)",
              fontWeight: 800,
              fontSize: 12,
              textDecoration: "none",
              textTransform: "uppercase",
              letterSpacing: ".04em",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--vitra-ink)";
              (e.currentTarget as HTMLElement).style.color = "#ffffff";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#ffffff";
              (e.currentTarget as HTMLElement).style.color = "var(--vitra-ink)";
            }}
          >
            Ver detalhes <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </article>
  );
}

export function VitraEmpty({ onClear }: { onClear?: () => void }) {
  return (
    <div
      style={{
        gridColumn: "1 / -1",
        padding: "60px 20px",
        textAlign: "center",
        color: "var(--vitra-muted)",
        background: "var(--vitra-bg)",
        border: "1px dashed var(--vitra-line)",
        borderRadius: 8,
      }}
    >
      <ShoppingBag size={44} style={{ color: "#a5b5b2", marginBottom: 14 }} />
      <h3 style={{ fontFamily: "'Manrope', sans-serif", fontSize: "1.2rem", fontWeight: 800, color: "var(--vitra-ink)", margin: "0 0 8px" }}>
        Nenhuma peça encontrada
      </h3>
      <p style={{ margin: "0 0 1.25rem", fontSize: 13 }}>
        Não encontramos produtos com os filtros selecionados. Tente buscar por outros termos.
      </p>
      {onClear && (
        <button
          onClick={onClear}
          className="vitra-btn-primary"
          style={{ padding: "10px 22px", fontSize: 12 }}
        >
          Limpar filtros e ver tudo
        </button>
      )}
    </div>
  );
}
