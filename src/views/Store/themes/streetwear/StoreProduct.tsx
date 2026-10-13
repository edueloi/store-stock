import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, MessageCircle, Minus, Plus, ShoppingBag } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { useStore } from "../../StoreLayout";
import { buildStorePath, parseProductIdFromRoute, resolveStoreSlug } from "../../store-routing";
import { swHidePrices, swImage, swMoney } from "./ThemeParts";

export default function StoreProduct() {
  const { slug: routeSlug, productId } = useParams();
  const { tenant, products, categories, addToCart, openCart } = useStore();
  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);
  const product = products.find((p) => p.id === parseProductIdFromRoute(productId));

  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [added, setAdded] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

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

  const S = {
    bg: "#09090b",
    surface: "#18181b",
    accent: "#facc15",
    ink: "#f4f4f5",
    muted: "#71717a",
    border: "1px solid #27272a",
  } as const;

  if (!product)
    return (
      <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", background: S.bg, color: S.ink, fontFamily: "'Inter', sans-serif", textAlign: "center", padding: "2rem" }}>
        <div>
          <ShoppingBag size={44} style={{ color: S.accent, marginBottom: "1rem" }} />
          <h1 style={{ fontSize: "1.2rem", fontWeight: 900, textTransform: "uppercase", margin: "0 0 1rem" }}>Peça não encontrada</h1>
          <Link to={path("/catalogo")} style={{ display: "inline-block", background: S.accent, color: "#000", fontWeight: 700, fontSize: ".75rem", textTransform: "uppercase", letterSpacing: ".1em", textDecoration: "none", padding: "12px 24px", borderRadius: 10 }}>
            Voltar ao catálogo
          </Link>
        </div>
      </main>
    );

  const images: string[] = [];
  if (Array.isArray(product.images)) product.images.forEach((img) => typeof img === "string" && images.push(img));
  if (product.image_url && !images.includes(product.image_url)) images.unshift(product.image_url);
  const mainImage = images[activeImage] || swImage(product) || null;
  const hidePrices = swHidePrices(tenant);
  const price = Number(product.discount_price || product.price);
  const originalPrice = product.discount_price ? Number(product.price) : null;
  const installment = (price / 6).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const category = categories.find((c) => c.id === product.category_id)?.name || "Coleção";
  const allSelected = choices.every((c) => selected[c.name]);

  const add = () => {
    if (!allSelected) return;
    const opts = { ...selected, ...(note.trim() ? { Observação: note.trim() } : {}) };
    for (let i = 0; i < quantity; i++) addToCart(product, Object.keys(opts).length ? opts : undefined);
    setAdded(true);
  };

  return (
    <main
      className="sw-root"
      style={{ minHeight: "100vh", background: S.bg, color: S.ink, fontFamily: "'Inter', sans-serif", paddingBottom: "4rem" }}
    >
      <StoreSEO
        title={`${product.name} | ${tenant.name}`}
        description={product.description || `${product.name} na ${tenant.name}.`}
        image={mainImage || ""}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>
        {/* Back link */}
        <Link
          to={path("/catalogo")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, color: S.accent, textDecoration: "none", textTransform: "uppercase", letterSpacing: ".14em", marginBottom: "1.5rem" }}
        >
          <ArrowLeft size={14} /> Voltar ao catálogo
        </Link>

        {/* Product layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "2rem" }}>
          <style>{`@media (min-width: 768px) { .sw-pdp-grid { grid-template-columns: 1fr 440px !important; } }`}</style>
          <div className="sw-pdp-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: "2rem", background: S.surface, border: S.border, borderRadius: "1.25rem", overflow: "hidden" }}>

            {/* Gallery */}
            <div>
              <div style={{ position: "relative", background: "#e5e5e0", minHeight: 380, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {mainImage
                  ? <img src={mainImage} alt={product.name} style={{ maxHeight: 460, width: "100%", height: "100%", objectFit: "contain", padding: "1rem" }} />
                  : <ShoppingBag size={54} style={{ color: "#27272a" }} />}
              </div>
              {images.length > 1 && (
                <div style={{ display: "flex", gap: ".5rem", padding: "1rem", overflowX: "auto", background: S.surface }}>
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImage(idx)}
                      style={{
                        flexShrink: 0, width: 64, height: 64,
                        border: `2px solid ${idx === activeImage ? S.accent : "#3f3f46"}`,
                        borderRadius: 8, overflow: "hidden",
                        background: "#e5e5e0", cursor: "pointer", padding: 0,
                        transition: "border-color .2s",
                      }}
                    >
                      <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <section style={{ padding: "2rem", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                {/* Category & stock */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".5rem" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: S.muted, textTransform: "uppercase", letterSpacing: ".16em" }}>{category}</span>
                  <span style={{ background: "rgba(250,204,21,.1)", color: S.accent, border: "1px solid rgba(250,204,21,.3)", borderRadius: 9999, fontSize: 10, fontWeight: 700, padding: "3px 12px", textTransform: "uppercase", letterSpacing: ".1em" }}>
                    Em estoque
                  </span>
                </div>

                {/* Name */}
                <h1 style={{ fontSize: "clamp(1.4rem,4vw,2rem)", fontWeight: 900, textTransform: "uppercase", lineHeight: .95, letterSpacing: "-.04em", margin: "0 0 1.25rem" }}>
                  {product.name}
                </h1>

                {/* Price */}
                <div style={{ background: "#09090b", border: S.border, borderRadius: "12px", padding: "1rem", marginBottom: "1.25rem" }}>
                  {originalPrice && (
                    <span style={{ fontSize: 11, color: "#52525b", textDecoration: "line-through", display: "block" }}>
                      {swMoney(originalPrice)}
                    </span>
                  )}
                  {hidePrices ? (
                    <span style={{ fontSize: "1.4rem", fontWeight: 900, color: S.ink }}>Produto sob consulta</span>
                  ) : (
                    <span style={{ fontSize: "1.6rem", fontWeight: 900, color: S.accent }}>{swMoney(price)}</span>
                  )}
                  {!hidePrices && (
                    <p style={{ fontSize: 11, color: S.muted, margin: ".25rem 0 0" }}>
                      ou em até <strong style={{ color: S.ink }}>6× de R$ {installment}</strong> sem juros
                    </p>
                  )}
                </div>

                {/* Description */}
                {product.description && (
                  <p style={{ fontSize: ".8rem", color: "#a1a1aa", lineHeight: 1.65, margin: "0 0 1.25rem", borderTop: S.border, borderBottom: S.border, padding: "1rem 0" }}>
                    {product.description}
                  </p>
                )}

                {/* Variations */}
                {choices.map((choice) => (
                  <div key={choice.name} style={{ marginBottom: "1rem" }}>
                    <p style={{ fontSize: ".8rem", fontWeight: 700, margin: "0 0 .5rem" }}>
                      {choice.name}{" "}
                      <span style={{ fontSize: 10, fontWeight: 400, color: S.accent }}>obrigatório</span>
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: ".4rem" }}>
                      {choice.options.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setSelected((prev) => ({ ...prev, [choice.name]: opt.value }))}
                          style={{
                            border: `1px solid ${selected[choice.name] === opt.value ? S.accent : "#3f3f46"}`,
                            background: selected[choice.name] === opt.value ? S.accent : "transparent",
                            color: selected[choice.name] === opt.value ? "#000" : S.ink,
                            padding: "8px 16px", fontSize: ".8rem", fontWeight: 700,
                            textTransform: "uppercase", borderRadius: 10, cursor: "pointer",
                            transition: "all .2s",
                          }}
                        >
                          {selected[choice.name] === opt.value && <Check size={12} style={{ display: "inline", marginRight: 4 }} />}
                          {opt.value}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Note */}
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ fontSize: ".8rem", fontWeight: 700, display: "block", marginBottom: ".4rem" }}>Observação do pedido</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 250))}
                    placeholder="Ex.: entrega, presente, dúvida sobre tamanho"
                    style={{
                      width: "100%", boxSizing: "border-box", minHeight: 80, resize: "none",
                      background: "#000", border: "1px solid #3f3f46", borderRadius: 10,
                      padding: "12px", fontSize: ".8rem", color: S.ink,
                      outline: "none", fontFamily: "'Inter', sans-serif",
                    }}
                    onFocus={(e) => ((e.currentTarget as HTMLTextAreaElement).style.borderColor = S.accent)}
                    onBlur={(e) => ((e.currentTarget as HTMLTextAreaElement).style.borderColor = "#3f3f46")}
                  />
                </div>

                <StockAvailability product={product} tenant={tenant} selected={selected} className="sw-stock" />
              </div>

              {/* Actions */}
              <div style={{ marginTop: "1.5rem", borderTop: S.border, paddingTop: "1.25rem" }}>
                {/* Quantity + Add */}
                <div style={{ display: "flex", gap: ".75rem", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", border: "1px solid #3f3f46", borderRadius: 10, overflow: "hidden" }}>
                    <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} style={{ width: 40, height: 48, background: "none", border: "none", color: S.ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Minus size={14} />
                    </button>
                    <span style={{ width: 32, textAlign: "center", fontSize: ".9rem", fontWeight: 700 }}>{quantity}</span>
                    <button onClick={() => setQuantity((q) => q + 1)} style={{ width: 40, height: 48, background: "none", border: "none", color: S.ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Plus size={14} />
                    </button>
                  </div>
                  <button
                    onClick={add}
                    disabled={!allSelected}
                    style={{
                      flex: 1, height: 48, background: allSelected ? S.accent : "#374151",
                      color: allSelected ? "#000" : "#6b7280",
                      border: "none", borderRadius: 10, cursor: allSelected ? "pointer" : "not-allowed",
                      fontWeight: 700, fontSize: ".75rem", textTransform: "uppercase",
                      letterSpacing: ".1em", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      transition: "background .2s",
                    }}
                  >
                    <ShoppingBag size={16} /> Adicionar ao pedido
                  </button>
                </div>

                {/* Added confirmation */}
                {added && (
                  <div style={{ background: "#182000", border: "1px solid #facc15", borderRadius: 10, padding: "1rem", marginBottom: "1rem" }}>
                    <p style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ".875rem", fontWeight: 700, margin: "0 0 .75rem" }}>
                      <Check size={16} style={{ color: S.accent }} /> Adicionado ao pedido
                    </p>
                    <div style={{ display: "flex", gap: ".5rem" }}>
                      <Link to={path("/catalogo")} style={{ border: "1px solid #3f3f46", borderRadius: 8, padding: "8px 16px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: S.ink, textDecoration: "none" }}>
                        Continuar
                      </Link>
                      <button onClick={openCart} style={{ background: S.accent, color: "#000", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", cursor: "pointer" }}>
                        Ver pedido
                      </button>
                    </div>
                  </div>
                )}

                <p style={{ fontSize: ".75rem", color: S.muted, display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
                  <MessageCircle size={13} style={{ color: S.accent }} />
                  Finalize o pedido online e receba a confirmação da loja.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
