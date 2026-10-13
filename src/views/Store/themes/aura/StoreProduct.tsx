import React, { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Heart, Minus, Plus, RotateCcw, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { useStore } from "../../StoreLayout";
import { buildStorePath, parseProductIdFromRoute, resolveStoreSlug } from "../../store-routing";
import { auraHidePrices, auraImage, auraMoney } from "./ThemeParts";

export default function StoreProduct() {
  const { slug: routeSlug, productId } = useParams();
  const { tenant, products, categories, addToCart, openCart, wishlist, toggleWishlist } = useStore();
  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);
  const product = products.find((p) => p.id === parseProductIdFromRoute(productId));

  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [activeImage, setActiveImage] = useState(0);
  const [added, setAdded] = useState(false);

  const choices = useMemo(
    () =>
      Array.isArray(product?.variations)
        ? (product!.variations as Array<{ name: string; options: Array<{ value: string }> }>)
        : Array.isArray(product?.attributes)
          ? (product!.attributes as any[]).map((a: any) => ({
              name: a.name,
              options: (a.values || []).map((v: string) => ({ value: v })),
            }))
          : [],
    [product],
  );

  if (!product) {
    return (
      <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", backgroundColor: "#FAF9F6", padding: "2rem" }}>
        <div style={{ textAlign: "center" }}>
          <ShoppingBag size={48} style={{ color: "#8C7A6B", margin: "0 auto 1rem" }} />
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.5rem", fontWeight: 700 }}>
            Peça não encontrada
          </h2>
          <Link
            to={path("/catalogo")}
            style={{
              display: "inline-block",
              marginTop: "1rem",
              backgroundColor: "#111111",
              color: "#ffffff",
              padding: "10px 24px",
              borderRadius: "9999px",
              textDecoration: "none",
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Voltar ao Catálogo
          </Link>
        </div>
      </main>
    );
  }

  const images: string[] = [];
  if (Array.isArray(product.images)) product.images.forEach((img) => typeof img === "string" && images.push(img));
  if (product.image_url && !images.includes(product.image_url)) images.unshift(product.image_url);
  const mainImage = images[activeImage] || auraImage(product) || null;

  const price = Number(product.discount_price || product.price);
  const oldPrice = product.discount_price ? Number(product.price) : null;
  const installments = (price / 6).toFixed(2).replace(".", ",");
  const hidePrices = auraHidePrices(tenant);
  const category = categories.find((c) => c.id === product.category_id)?.name || "Coleção";
  const allSelected = choices.every((c) => selectedOptions[c.name]);
  const isFavorited = wishlist.includes(product.id);

  const handleAdd = () => {
    if (!allSelected) return;
    for (let i = 0; i < quantity; i++) {
      addToCart(product, Object.keys(selectedOptions).length ? selectedOptions : undefined);
    }
    setAdded(true);
  };

  return (
    <main className="aura-root" style={{ minHeight: "100vh", paddingBottom: "5rem" }}>
      <StoreSEO
        title={`${product.name} | ${tenant.name}`}
        description={product.description || `${product.name} na ${tenant.name}.`}
        image={mainImage || ""}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <Link
          to={path("/catalogo")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            color: "#8C7A6B",
            textDecoration: "none",
            marginBottom: "2rem",
          }}
          className="hover:text-stone-900"
        >
          <ArrowLeft size={14} /> Voltar à Coleção
        </Link>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "3rem" }}>
          {/* Imagens */}
          <div>
            <div
              style={{
                position: "relative",
                backgroundColor: "#F4EFEB",
                borderRadius: "1.5rem",
                overflow: "hidden",
                height: 500,
                boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)",
              }}
            >
              {mainImage ? (
                <img
                  src={mainImage}
                  alt={product.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#D1C2B2" }}>
                  <ShoppingBag size={64} />
                </div>
              )}

              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  backgroundColor: "rgba(255,255,255,0.85)",
                  color: isFavorited ? "#dc2626" : "#2A241F",
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
                }}
              >
                <Heart size={18} fill={isFavorited ? "currentColor" : "none"} />
              </button>
            </div>

            {images.length > 1 && (
              <div style={{ display: "flex", gap: "12px", marginTop: "1rem", overflowX: "auto", paddingBottom: 4 }}>
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImage(idx)}
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: "0.75rem",
                      overflow: "hidden",
                      border: idx === activeImage ? "2px solid #D4AF37" : "1px solid #E5DBD0",
                      padding: 0,
                      backgroundColor: "#F4EFEB",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Detalhes da Peça */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", color: "#8C7A6B", fontWeight: 600 }}>
                {category}
              </span>

              <h1
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "clamp(1.8rem, 3.5vw, 2.5rem)",
                  fontWeight: 700,
                  color: "#111111",
                  margin: "8px 0 16px",
                  lineHeight: 1.2,
                }}
              >
                {product.name}
              </h1>

              {/* Preço */}
              <div style={{ backgroundColor: "#FBF9F7", border: "1px solid #E5DBD0", borderRadius: "1rem", padding: "1.25rem", marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <span style={{ fontSize: "2rem", fontWeight: 700, color: "#111111" }}>
                    {hidePrices ? "Sob Consulta" : auraMoney(price)}
                  </span>
                  {oldPrice && !hidePrices && (
                    <span style={{ fontSize: "1rem", color: "#8C7A6B", textDecoration: "line-through" }}>
                      {auraMoney(oldPrice)}
                    </span>
                  )}
                </div>

                {!hidePrices && (
                  <p style={{ fontSize: 12, color: "#8C7A6B", margin: "4px 0 0" }}>
                    ou em até <strong>6x de R$ {installments}</strong> sem juros
                  </p>
                )}
              </div>

              {product.description && (
                <p style={{ fontSize: "0.9rem", color: "#4A3F35", lineHeight: 1.7, margin: "0 0 1.5rem", fontWeight: 300 }}>
                  {product.description}
                </p>
              )}

              {/* Variações */}
              {choices.map((choice) => (
                <div key={choice.name} style={{ marginBottom: "1.25rem" }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#111111", marginBottom: 8 }}>
                    {choice.name}
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {choice.options.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setSelectedOptions((prev) => ({
                            ...prev,
                            [choice.name]: opt.value,
                          }))
                        }
                        style={{
                          backgroundColor: selectedOptions[choice.name] === opt.value ? "#111111" : "#FAF9F6",
                          color: selectedOptions[choice.name] === opt.value ? "#FAF9F6" : "#111111",
                          border: "1px solid",
                          borderColor: selectedOptions[choice.name] === opt.value ? "#111111" : "#D1C2B2",
                          borderRadius: "0.75rem",
                          padding: "8px 18px",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                      >
                        {selectedOptions[choice.name] === opt.value && <Check size={12} style={{ display: "inline", marginRight: 4 }} />}
                        {opt.value}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <StockAvailability product={product} tenant={tenant} selected={selectedOptions} className="mt-4" />
            </div>

            {/* Ações */}
            <div style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid #E5DBD0" }}>
              <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", border: "1px solid #D1C2B2", borderRadius: "0.75rem", backgroundColor: "#fff" }}>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    style={{ padding: "0 14px", height: 48, background: "none", border: "none", cursor: "pointer", color: "#111111" }}
                  >
                    <Minus size={14} />
                  </button>
                  <span style={{ width: 28, textAlign: "center", fontSize: 13, fontWeight: 700 }}>{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    style={{ padding: "0 14px", height: 48, background: "none", border: "none", cursor: "pointer", color: "#111111" }}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!allSelected}
                  style={{
                    flex: 1,
                    backgroundColor: allSelected ? "#111111" : "#8C7A6B",
                    color: "#FAF9F6",
                    fontWeight: 600,
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    borderRadius: "0.75rem",
                    border: "none",
                    cursor: allSelected ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    height: 48,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                  className="hover:bg-amber-600"
                >
                  <ShoppingBag size={16} /> Adicionar à Sacola
                </button>
              </div>

              {added && (
                <div style={{ backgroundColor: "#F4EFEB", border: "1px solid #D4AF37", borderRadius: "0.75rem", padding: "1rem", marginBottom: "1rem" }}>
                  <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#111111", display: "flex", alignItems: "center", gap: 6 }}>
                    <Check size={16} style={{ color: "#D4AF37" }} /> Peça adicionada à sacola!
                  </p>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Link
                      to={path("/catalogo")}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "9999px",
                        border: "1px solid #111111",
                        fontSize: 11,
                        textTransform: "uppercase",
                        color: "#111111",
                        textDecoration: "none",
                        fontWeight: 600,
                      }}
                    >
                      Continuar Comprando
                    </Link>
                    <button
                      type="button"
                      onClick={openCart}
                      style={{
                        padding: "8px 20px",
                        borderRadius: "9999px",
                        backgroundColor: "#111111",
                        color: "#FAF9F6",
                        fontSize: 11,
                        textTransform: "uppercase",
                        border: "none",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Ver Sacola
                    </button>
                  </div>
                </div>
              )}

              {/* Benefícios */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "1rem" }}>
                <div style={{ backgroundColor: "#FBF9F7", padding: "10px", borderRadius: "8px", fontSize: 11, color: "#4A3F35", display: "flex", alignItems: "center", gap: 6 }}>
                  <Truck size={14} style={{ color: "#D4AF37" }} /> Envio rápido e seguro
                </div>
                <div style={{ backgroundColor: "#FBF9F7", padding: "10px", borderRadius: "8px", fontSize: 11, color: "#4A3F35", display: "flex", alignItems: "center", gap: 6 }}>
                  <RotateCcw size={14} style={{ color: "#D4AF37" }} /> Troca fácil em 30 dias
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
