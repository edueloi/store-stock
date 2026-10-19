import { Link } from "react-router-dom";
import { ArrowRight, ShoppingBag } from "lucide-react";
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

export function VitraProductCard({ product, path, category, hidePrices }: any) {
  const image = vitraImage(product);
  const full = Number(product.price);
  const price = Number(product.discount_price || product.price);
  const discounted = product.discount_price != null && price < full;
  const href = path(`/produto/${productRouteSegment(product)}`);

  return (
    <article className="vitra-product-card">
      <Link to={href} className="vitra-product-img" aria-label={`Ver ${product.name}`}>
        {image ? <img src={image} alt="" loading="lazy" /> : <ShoppingBag size={40} className="vitra-noimg" />}
        <span className="vitra-pill">{discounted ? "Oferta" : category || "Sob medida"}</span>
      </Link>
      <div className="vitra-product-body">
        <span className="vitra-product-cat">{category || "Projetos em vidro"}</span>
        <Link to={href} className="vitra-product-name">{product.name}</Link>
        <div className="vitra-product-price">
          {hidePrices ? (
            <b>Sob consulta</b>
          ) : (
            <>
              <b>{vitraMoney(price)}</b>
              {discounted && <s>{vitraMoney(full)}</s>}
            </>
          )}
          <small>A partir de • orçamento sob medida</small>
        </div>
        <Link to={href} className="vitra-product-btn">Ver detalhes <ArrowRight size={14} /></Link>
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
        borderRadius: 28,
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
