import React from "react";
import { Link } from "react-router-dom";
import { Heart, ShoppingBag } from "lucide-react";
import { productRouteSegment } from "../../store-routing";

export const auraImage = (product: { image_url?: string | null; images?: unknown }) =>
  (Array.isArray(product.images) && typeof product.images[0] === "string"
    ? product.images[0]
    : product.image_url) || null;

export const auraMoney = (val: number) =>
  val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const auraHidePrices = (tenant: any) =>
  tenant.policies?.storefront?.checkout_mode === "order_request" ||
  tenant.policies?.storefront?.hide_prices === true;

export function AuraProductCard({
  product,
  path,
  category,
  saved,
  onFavorite,
  onAdd,
  hidePrices,
}: any) {
  const image = auraImage(product);
  const price = Number(product.discount_price || product.price);
  const oldPrice = product.discount_price ? Number(product.price) : null;
  const installments = (price / 6).toFixed(2).replace(".", ",");

  return (
    <article
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "1rem",
        overflow: "hidden",
        border: "1px solid #E5DBD0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        transition: "all 0.3s ease",
      }}
      className="group hover:shadow-xl"
    >
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#F4EFEB",
          height: 320,
          cursor: "pointer",
        }}
      >
        <Link to={path(`/produto/${productRouteSegment(product)}`)} style={{ display: "block", width: "100%", height: "100%" }}>
          {image ? (
            <img
              src={image}
              alt={product.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transition: "transform 0.7s ease",
              }}
              className="group-hover:scale-105"
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#D1C2B2" }}>
              <ShoppingBag size={48} />
            </div>
          )}
        </Link>

        {product.discount_price && (
          <span
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              backgroundColor: "#dc2626",
              color: "#ffffff",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              padding: "4px 10px",
              borderRadius: 9999,
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            Sale
          </span>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onFavorite();
          }}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            backgroundColor: "rgba(255,255,255,0.85)",
            color: saved ? "#dc2626" : "#2A241F",
            width: 36,
            height: 36,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
            transition: "all 0.2s",
          }}
          title={saved ? "Remover dos favoritos" : "Salvar nos favoritos"}
        >
          <Heart size={16} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>

      <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
        <div>
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: "#8C7A6B", fontWeight: 600 }}>
            {category || "Coleção"}
          </span>
          <Link
            to={path(`/produto/${productRouteSegment(product)}`)}
            style={{ textDecoration: "none", color: "inherit", display: "block", marginTop: "4px" }}
          >
            <h3
              style={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 700,
                fontSize: "1rem",
                color: "#111111",
                margin: 0,
                lineHeight: 1.3,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
              className="hover:text-amber-700 transition-colors"
            >
              {product.name}
            </h3>
          </Link>
        </div>

        <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid #F4EFEB" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontSize: "1.15rem", fontWeight: 700, color: "#111111" }}>
              {hidePrices ? "Sob Consulta" : auraMoney(price)}
            </span>
            {oldPrice && !hidePrices && (
              <span style={{ fontSize: "0.75rem", color: "#8C7A6B", textDecoration: "line-through" }}>
                {auraMoney(oldPrice)}
              </span>
            )}
          </div>

          {!hidePrices && (
            <p style={{ fontSize: 11, color: "#8C7A6B", margin: "0 0 12px" }}>
              ou 6x de R$ {installments} s/ juros
            </p>
          )}

          <button
            type="button"
            onClick={onAdd}
            style={{
              width: "100%",
              backgroundColor: "#111111",
              color: "#FAF9F6",
              fontWeight: 500,
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              padding: "10px 0",
              borderRadius: "0.75rem",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "all 0.2s",
            }}
            className="hover:bg-amber-600 hover:text-white"
          >
            <ShoppingBag size={14} /> Compra Rápida
          </button>
        </div>
      </div>
    </article>
  );
}

export function AuraEmpty({ onClear }: { onClear?: () => void }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "4rem 1.5rem",
        backgroundColor: "#FBF9F7",
        borderRadius: "1.5rem",
        border: "1px dashed #D1C2B2",
      }}
    >
      <ShoppingBag size={40} style={{ color: "#8C7A6B", margin: "0 auto 12px" }} />
      <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.25rem", fontWeight: 700, color: "#111111" }}>
        Nenhuma peça encontrada
      </h3>
      <p style={{ fontSize: "0.75rem", color: "#8C7A6B", marginTop: "4px" }}>
        Tente buscar por outro termo ou categoria.
      </p>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          style={{
            marginTop: "16px",
            backgroundColor: "#111111",
            color: "#FAF9F6",
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            padding: "10px 24px",
            borderRadius: "9999px",
            border: "none",
            cursor: "pointer",
          }}
          className="hover:bg-amber-600"
        >
          Ver Todas as Peças
        </button>
      )}
    </div>
  );
}
