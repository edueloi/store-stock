import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Heart,
  MessageCircle,
  Minus,
  Plus,
  RefreshCw,
  Ruler,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  Zap,
} from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { useStore } from "../../StoreLayout";
import { buildStorePath, parseProductIdFromRoute, resolveStoreSlug } from "../../store-routing";
import { SwProductCard, swHidePrices, swImage, swMoney } from "./ThemeParts";

export default function StoreProduct() {
  const { slug: routeSlug, productId } = useParams();
  const { tenant, products, categories, addToCart, openCart, wishlist, toggleWishlist } = useStore();
  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);
  const product = products.find((p) => p.id === parseProductIdFromRoute(productId));

  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [added, setAdded] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [showSizeModal, setShowSizeModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"desc" | "specs" | "sizes" | "shipping">("desc");

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

  // Fallback default sizes if none configured in attributes
  const hasConfiguredSizes = choices.some((c) => /tamanho|tam|size/i.test(c.name));
  const defaultSizes = ["P", "M", "G", "GG"];
  const [fallbackSize, setFallbackSize] = useState<string>("M");

  if (!product) {
    return (
      <main
        style={{
          minHeight: "70vh",
          display: "grid",
          placeItems: "center",
          background: "#09090b",
          color: "#f4f4f5",
          fontFamily: "'Inter', sans-serif",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <div>
          <ShoppingBag size={54} style={{ color: "#facc15", marginBottom: "1rem" }} />
          <h1 style={{ fontSize: "1.5rem", fontWeight: 900, textTransform: "uppercase", margin: "0 0 1rem" }}>
            Peça não encontrada
          </h1>
          <p style={{ color: "#71717a", fontSize: ".9rem", margin: "0 0 1.5rem" }}>
            O produto procurado pode ter sido removido ou o link está incorreto.
          </p>
          <Link
            to={path("/catalogo")}
            style={{
              display: "inline-block",
              background: "#facc15",
              color: "#000",
              fontWeight: 800,
              fontSize: ".8rem",
              textTransform: "uppercase",
              letterSpacing: ".1em",
              textDecoration: "none",
              padding: "14px 28px",
              borderRadius: "12px",
            }}
          >
            Voltar ao catálogo
          </Link>
        </div>
      </main>
    );
  }

  // Gallery images
  const images: string[] = [];
  if (Array.isArray(product.images)) {
    product.images.forEach((img) => typeof img === "string" && images.push(img));
  }
  if (product.image_url && !images.includes(product.image_url)) {
    images.unshift(product.image_url);
  }
  const mainImage = images[activeImage] || swImage(product) || null;

  const hidePrices = swHidePrices(tenant);
  const price = Number(product.discount_price || product.price);
  const originalPrice = product.discount_price ? Number(product.price) : null;
  const discountPct = originalPrice ? Math.round((1 - price / originalPrice) * 100) : 0;
  const installment = (price / 6).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pixPrice = (price * 0.95).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const category = categories.find((c) => c.id === product.category_id)?.name || "Streetwear";
  const allSelected = choices.every((c) => selected[c.name]);
  const isSaved = wishlist.includes(product.id);

  // Related products
  const related = products
    .filter((p) => p.is_active && p.id !== product.id && (p.category_id === product.category_id || true))
    .slice(0, 4);

  const add = () => {
    if (!allSelected) return;
    const finalOpts = { ...selected };
    if (!hasConfiguredSizes) {
      finalOpts["Tamanho"] = fallbackSize;
    }
    if (note.trim()) {
      finalOpts["Observação"] = note.trim();
    }
    for (let i = 0; i < quantity; i++) {
      addToCart(product, Object.keys(finalOpts).length ? finalOpts : undefined);
    }
    setAdded(true);
  };

  const whatsappMessage = encodeURIComponent(
    `Salve! Tenho interesse na peça *${product.name}* (${hidePrices ? "Sob consulta" : swMoney(price)}) na loja. Pode me passar mais detalhes?`,
  );

  return (
    <main
      className="sw-root"
      style={{
        minHeight: "100vh",
        background: "#09090b",
        color: "#f4f4f5",
        fontFamily: "'Inter', sans-serif",
        paddingBottom: "5rem",
      }}
    >
      <StoreSEO
        title={`${product.name} | ${tenant.name}`}
        description={product.description || `${product.name} na ${tenant.name}.`}
        image={mainImage || ""}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "2rem 1.5rem" }}>
        {/* ── BREADCRUMB NAVIGATION ── */}
        <nav
          aria-label="Breadcrumb"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: ".1em",
            color: "#71717a",
            marginBottom: "2rem",
          }}
        >
          <Link to={path()} style={{ color: "#a1a1aa", textDecoration: "none" }}>
            Início
          </Link>
          <span>/</span>
          <Link to={path("/catalogo")} style={{ color: "#a1a1aa", textDecoration: "none" }}>
            Catálogo
          </Link>
          <span>/</span>
          {category && (
            <>
              <Link to={path(`/catalogo?cat=${product.category_id}`)} style={{ color: "#a1a1aa", textDecoration: "none" }}>
                {category}
              </Link>
              <span>/</span>
            </>
          )}
          <span style={{ color: "#facc15" }}>{product.name}</span>
        </nav>

        {/* ── TWO-COLUMN PRODUCT CONTAINER ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "3rem" }}>
          <style>{`
            @media (min-width: 1024px) {
              .sw-pdp-layout { grid-template-columns: 1.1fr 0.9fr !important; }
            }
          `}</style>
          <div className="sw-pdp-layout" style={{ display: "grid", gridTemplateColumns: "1fr", gap: "3rem", alignItems: "flex-start" }}>
            
            {/* ── LEFT COLUMN: GALLERY ── */}
            <div>
              {/* Main Preview Box */}
              <div
                style={{
                  position: "relative",
                  borderRadius: "1.75rem",
                  overflow: "hidden",
                  background: "#18181b",
                  border: "1px solid #27272a",
                  aspectRatio: "1/1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/* Badges on image */}
                <div style={{ position: "absolute", top: 16, left: 16, zIndex: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  <span
                    style={{
                      background: "rgba(9, 9, 11, 0.85)",
                      backdropFilter: "blur(8px)",
                      color: "#facc15",
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: ".08em",
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(250, 204, 21, 0.3)",
                    }}
                  >
                    100% ORIGINAL
                  </span>
                  {discountPct > 0 && (
                    <span
                      style={{
                        background: "#ef4444",
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: 800,
                        padding: "5px 10px",
                        borderRadius: 6,
                        display: "inline-block",
                      }}
                    >
                      -{discountPct}% OFF
                    </span>
                  )}
                </div>

                {/* Wishlist toggle */}
                <button
                  onClick={() => toggleWishlist(product.id)}
                  aria-label="Favoritar peça"
                  style={{
                    position: "absolute",
                    top: 16,
                    right: 16,
                    zIndex: 10,
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    border: "none",
                    background: isSaved ? "#facc15" : "rgba(24, 24, 27, 0.8)",
                    backdropFilter: "blur(8px)",
                    color: isSaved ? "#000" : "#f4f4f5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all .2s",
                  }}
                >
                  <Heart size={18} fill={isSaved ? "currentColor" : "none"} />
                </button>

                {/* Image */}
                {mainImage ? (
                  <img
                    src={mainImage}
                    alt={product.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transition: "transform .5s ease",
                    }}
                  />
                ) : (
                  <ShoppingBag size={80} style={{ color: "#27272a" }} />
                )}
              </div>

              {/* Thumbnails Strip */}
              {images.length > 1 && (
                <div
                  style={{
                    display: "flex",
                    gap: ".75rem",
                    marginTop: "1rem",
                    overflowX: "auto",
                    paddingBottom: 4,
                  }}
                >
                  {images.map((img, idx) => {
                    const isActive = idx === activeImage;
                    return (
                      <button
                        key={idx}
                        onClick={() => setActiveImage(idx)}
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: 12,
                          overflow: "hidden",
                          border: `2px solid ${isActive ? "#facc15" : "#27272a"}`,
                          background: "#18181b",
                          padding: 0,
                          cursor: "pointer",
                          flexShrink: 0,
                          transition: "border-color .2s",
                        }}
                      >
                        <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── RIGHT COLUMN: DETAILS & ACTIONS ── */}
            <div
              style={{
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: "1.75rem",
                padding: "2.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
              }}
            >
              {/* Category & Stock Status */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#71717a",
                    textTransform: "uppercase",
                    letterSpacing: ".14em",
                  }}
                >
                  {category}
                </span>

                <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span className="sw-pulse-dot" />
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#facc15", textTransform: "uppercase", letterSpacing: ".1em" }}>
                    Pronta Entrega
                  </span>
                </div>
              </div>

              {/* Product Title */}
              <div>
                <h1
                  style={{
                    fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    lineHeight: 1.05,
                    letterSpacing: "-0.04em",
                    margin: "0 0 .75rem",
                  }}
                >
                  {product.name}
                </h1>

                {/* Reviews Teaser */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".825rem", color: "#a1a1aa" }}>
                  <div style={{ display: "flex", color: "#facc15" }}>
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={14} fill="currentColor" />
                    ))}
                  </div>
                  <strong style={{ color: "#f4f4f5" }}>5.0</strong>
                  <span>(48 avaliações de clientes)</span>
                </div>
              </div>

              {/* Price Box */}
              <div
                style={{
                  background: "#09090b",
                  border: "1px solid #27272a",
                  borderRadius: "1.25rem",
                  padding: "1.25rem 1.5rem",
                }}
              >
                {originalPrice && (
                  <span style={{ fontSize: 13, color: "#71717a", textDecoration: "line-through", display: "block", marginBottom: 2 }}>
                    {swMoney(originalPrice)}
                  </span>
                )}
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: "2rem", fontWeight: 900, color: "#facc15", letterSpacing: "-0.03em" }}>
                    {hidePrices ? "Produto sob consulta" : swMoney(price)}
                  </span>
                  {!hidePrices && discountPct > 0 && (
                    <span style={{ background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 6 }}>
                      ECONOMIZE {discountPct}%
                    </span>
                  )}
                </div>

                {!hidePrices && price > 0 && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: ".85rem", color: "#a1a1aa" }}>
                    <p style={{ margin: 0 }}>
                      ou em até <strong style={{ color: "#f4f4f5" }}>6× de R$ {installment}</strong> sem juros no cartão
                    </p>
                    <p style={{ margin: 0, color: "#22c55e", fontSize: ".8rem", fontWeight: 700 }}>
                      ⚡ {pixPrice} à vista com 5% de desconto no Pix
                    </p>
                  </div>
                )}
              </div>

              {/* Configured Variations or Fallback Size Picker */}
              {choices.length > 0 ? (
                choices.map((choice) => (
                  <div key={choice.name}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: ".6rem" }}>
                      <label style={{ fontSize: ".85rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em" }}>
                        {choice.name}: <span style={{ color: "#facc15" }}>{selected[choice.name] || "Selecione"}</span>
                      </label>
                      {/tamanho|tam|size/i.test(choice.name) && (
                        <button
                          type="button"
                          onClick={() => setShowSizeModal(true)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#a1a1aa",
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: ".08em",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Ruler size={13} style={{ color: "#facc15" }} /> Guia de tamanhos
                        </button>
                      )}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem" }}>
                      {choice.options.map((opt) => {
                        const isChosen = selected[choice.name] === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setSelected((prev) => ({ ...prev, [choice.name]: opt.value }))}
                            className={`sw-size-btn${isChosen ? " active" : ""}`}
                          >
                            {isChosen && <Check size={12} style={{ marginRight: 4 }} />}
                            {opt.value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                /* Fallback size selector for streetwear apparel */
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: ".6rem" }}>
                    <label style={{ fontSize: ".85rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em" }}>
                      Tamanho: <span style={{ color: "#facc15" }}>{fallbackSize}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowSizeModal(true)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#a1a1aa",
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: ".08em",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Ruler size={13} style={{ color: "#facc15" }} /> Guia de tamanhos
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: ".5rem" }}>
                    {defaultSizes.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFallbackSize(s)}
                        className={`sw-size-btn${fallbackSize === s ? " active" : ""}`}
                      >
                        {fallbackSize === s && <Check size={12} style={{ marginRight: 4 }} />}
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Order customization note */}
              <div>
                <label style={{ fontSize: ".8rem", fontWeight: 800, textTransform: "uppercase", display: "block", marginBottom: ".4rem", letterSpacing: ".05em" }}>
                  Observações para a loja (opcional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 250))}
                  placeholder="Ex.: tamanho alternativo, embalagem de presente, instruções de entrega..."
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    minHeight: 70,
                    resize: "none",
                    background: "#09090b",
                    border: "1px solid #3f3f46",
                    borderRadius: "12px",
                    padding: "12px",
                    fontSize: ".825rem",
                    color: "#f4f4f5",
                    outline: "none",
                    fontFamily: "'Inter', sans-serif",
                  }}
                  onFocus={(e) => ((e.currentTarget as HTMLTextAreaElement).style.borderColor = "#facc15")}
                  onBlur={(e) => ((e.currentTarget as HTMLTextAreaElement).style.borderColor = "#3f3f46")}
                />
              </div>

              {/* Live stock indicator */}
              <StockAvailability product={product} tenant={tenant} selected={selected} className="sw-stock" />

              {/* Quantity + Add to Cart Action Row */}
              <div style={{ display: "flex", gap: ".75rem", marginTop: ".5rem" }}>
                {/* Stepper */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    border: "1px solid #3f3f46",
                    borderRadius: "14px",
                    background: "#09090b",
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    style={{
                      width: 44,
                      height: 52,
                      background: "none",
                      border: "none",
                      color: "#f4f4f5",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Minus size={15} />
                  </button>
                  <span style={{ width: 36, textAlign: "center", fontSize: ".95rem", fontWeight: 800 }}>
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    style={{
                      width: 44,
                      height: 52,
                      background: "none",
                      border: "none",
                      color: "#f4f4f5",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Plus size={15} />
                  </button>
                </div>

                {/* Primary CTA */}
                <button
                  onClick={add}
                  disabled={!allSelected}
                  style={{
                    flex: 1,
                    height: 52,
                    background: allSelected ? "#facc15" : "#3f3f46",
                    color: allSelected ? "#000" : "#71717a",
                    border: "none",
                    borderRadius: "14px",
                    cursor: allSelected ? "pointer" : "not-allowed",
                    fontWeight: 900,
                    fontSize: ".85rem",
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    boxShadow: allSelected ? "0 6px 20px rgba(250, 204, 21, 0.3)" : "none",
                    transition: "all .2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (allSelected) {
                      (e.currentTarget as HTMLElement).style.background = "#eab308";
                      (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (allSelected) {
                      (e.currentTarget as HTMLElement).style.background = "#facc15";
                      (e.currentTarget as HTMLElement).style.transform = "none";
                    }
                  }}
                >
                  <ShoppingBag size={18} /> Adicionar ao Carrinho
                </button>
              </div>

              {/* Fast WhatsApp Purchase Button */}
              {tenant.whatsapp && (
                <a
                  href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}?text=${whatsappMessage}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    background: "#09090b",
                    border: "1px solid #3f3f46",
                    borderRadius: "14px",
                    padding: "14px 20px",
                    color: "#f4f4f5",
                    fontSize: ".85rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    textDecoration: "none",
                    transition: "border-color .2s, color .2s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "#22c55e";
                    (e.currentTarget as HTMLElement).style.color = "#22c55e";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "#3f3f46";
                    (e.currentTarget as HTMLElement).style.color = "#f4f4f5";
                  }}
                >
                  <MessageCircle size={18} style={{ color: "#22c55e" }} /> Comprar via WhatsApp
                </a>
              )}

              {/* Added to cart notification */}
              {added && (
                <div
                  style={{
                    background: "rgba(250, 204, 21, 0.1)",
                    border: "1px solid #facc15",
                    borderRadius: "12px",
                    padding: "1rem 1.25rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "1rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Check size={18} style={{ color: "#facc15" }} />
                    <span style={{ fontSize: ".85rem", fontWeight: 800, textTransform: "uppercase" }}>
                      Item adicionado!
                    </span>
                  </div>
                  <button
                    onClick={openCart}
                    style={{
                      background: "#facc15",
                      color: "#000",
                      border: "none",
                      borderRadius: "8px",
                      padding: "8px 16px",
                      fontSize: 11,
                      fontWeight: 900,
                      textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >
                    Ver Carrinho
                  </button>
                </div>
              )}

              {/* Guarantees List */}
              <div
                style={{
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                  paddingTop: "1.25rem",
                  display: "grid",
                  gap: ".75rem",
                  fontSize: ".8rem",
                  color: "#a1a1aa",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Truck size={16} style={{ color: "#facc15" }} />
                  <span>Envio expresso para todo o Brasil em até 24h</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <RefreshCw size={16} style={{ color: "#facc15" }} />
                  <span>1ª Troca grátis em até 7 dias após o recebimento</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <ShieldCheck size={16} style={{ color: "#facc15" }} />
                  <span>Produto 100% autêntico com garantia contra defeitos</span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── ACCORDION / SPECIFICATIONS TABS ── */}
        <section
          style={{
            marginTop: "4rem",
            background: "#18181b",
            border: "1px solid #27272a",
            borderRadius: "1.75rem",
            padding: "2.5rem",
          }}
        >
          {/* Tab buttons */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "1rem",
              borderBottom: "1px solid #27272a",
              paddingBottom: "1.25rem",
              marginBottom: "2rem",
            }}
          >
            {[
              { id: "desc", label: "Descrição da Peça" },
              { id: "specs", label: "Especificações Técnicas" },
              { id: "sizes", label: "Tabela de Medidas" },
              { id: "shipping", label: "Envio & Trocas" },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    background: isActive ? "#facc15" : "transparent",
                    color: isActive ? "#000" : "#a1a1aa",
                    border: `1px solid ${isActive ? "#facc15" : "#3f3f46"}`,
                    borderRadius: "10px",
                    padding: "10px 20px",
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    cursor: "pointer",
                    transition: "all .2s",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Contents */}
          {activeTab === "desc" && (
            <div style={{ color: "#d4d4d8", fontSize: ".95rem", lineHeight: 1.8 }}>
              <p style={{ margin: "0 0 1rem" }}>
                {product.description ||
                  "Desenvolvida para quem vive o streetwear de verdade. Peça confeccionada em algodão pesado de altíssima gramatura com toque macio e caimento solto. Estrutura reforçada de ombro a ombro para aguentar tanto o rolê diário quanto as sessões mais intensas."}
              </p>
              <p style={{ margin: 0, color: "#a1a1aa" }}>
                • Modelagem oversized autêntica<br />
                • Tecido pré-encolhido que não deforma na lavagem<br />
                • Acabamentos e costuras industriais duplas<br />
                • Estampa de alta definição resistente ao tempo
              </p>
            </div>
          )}

          {activeTab === "specs" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
              {[
                { label: "Composição", val: "100% Algodão Premium 280g/m²" },
                { label: "Modelagem", val: "Oversized Streetwear Boxy" },
                { label: "Gola", val: "Ribana canelada 2.8cm com reforço" },
                { label: "Estampa", val: "Silk-Screen Industrial Alta Fixação" },
                { label: "Instruções", val: "Lavar à mão ou máquina no ciclo delicado" },
                { label: "Origem", val: "Nacional / Edição Limitada" },
              ].map((s, i) => (
                <div key={i} style={{ background: "#09090b", border: "1px solid #27272a", borderRadius: "12px", padding: "1.25rem" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#facc15", textTransform: "uppercase", letterSpacing: ".1em", display: "block", marginBottom: 4 }}>
                    {s.label}
                  </span>
                  <span style={{ fontSize: ".9rem", fontWeight: 700, color: "#f4f4f5" }}>
                    {s.val}
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "sizes" && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: ".875rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #3f3f46", color: "#facc15", textTransform: "uppercase", fontSize: 11, letterSpacing: ".08em" }}>
                    <th style={{ padding: "12px 16px" }}>Tamanho</th>
                    <th style={{ padding: "12px 16px" }}>Tórax (Largura)</th>
                    <th style={{ padding: "12px 16px" }}>Comprimento</th>
                    <th style={{ padding: "12px 16px" }}>Manga</th>
                  </tr>
                </thead>
                <tbody style={{ color: "#d4d4d8" }}>
                  {[
                    { t: "P", w: "54 cm", l: "74 cm", s: "23 cm" },
                    { t: "M", w: "56 cm", l: "76 cm", s: "24 cm" },
                    { t: "G", w: "58 cm", l: "78 cm", s: "25 cm" },
                    { t: "GG", w: "60 cm", l: "80 cm", s: "26 cm" },
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #27272a" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 900, color: "#facc15" }}>{row.t}</td>
                      <td style={{ padding: "12px 16px" }}>{row.w}</td>
                      <td style={{ padding: "12px 16px" }}>{row.l}</td>
                      <td style={{ padding: "12px 16px" }}>{row.s}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ color: "#71717a", fontSize: ".75rem", marginTop: "1rem" }}>
                * Medidas aproximadas com margem de tolerância de até 1,5cm. Modelo tem 1,82m e veste G.
              </p>
            </div>
          )}

          {activeTab === "shipping" && (
            <div style={{ color: "#d4d4d8", fontSize: ".9rem", lineHeight: 1.7 }}>
              <h4 style={{ color: "#facc15", textTransform: "uppercase", fontSize: ".95rem", margin: "0 0 .5rem" }}>
                Envio & Entrega
              </h4>
              <p style={{ margin: "0 0 1.25rem" }}>
                Todos os pedidos são postados em até 24 horas úteis após a confirmação. O código de rastreamento é enviado automaticamente para o seu e-mail e WhatsApp cadastrados.
              </p>
              <h4 style={{ color: "#facc15", textTransform: "uppercase", fontSize: ".95rem", margin: "0 0 .5rem" }}>
                Política de Troca Sem Estresse
              </h4>
              <p style={{ margin: 0 }}>
                Não serviu ou prefere outro modelo? Você tem até 7 dias corridos após o recebimento para solicitar a 1ª troca grátis diretamente pelo nosso canal de atendimento.
              </p>
            </div>
          )}
        </section>

        {/* ── RELATED PRODUCTS ── */}
        {related.length > 0 && (
          <section style={{ marginTop: "5rem" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "2rem" }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#facc15", textTransform: "uppercase", letterSpacing: ".16em" }}>
                  COMPLETE O FIT
                </span>
                <h3 style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.04em", margin: ".25rem 0 0" }}>
                  VOCÊ TAMBÉM PODE CURTIR
                </h3>
              </div>
              <Link
                to={path("/catalogo")}
                style={{
                  color: "#facc15",
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: ".1em",
                  textDecoration: "none",
                }}
              >
                Ver tudo →
              </Link>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: "1.25rem",
              }}
            >
              {related.map((item) => (
                <SwProductCard
                  key={item.id}
                  product={item}
                  category={categories.find((c) => c.id === item.category_id)?.name}
                  path={path}
                  saved={wishlist.includes(item.id)}
                  onFavorite={() => toggleWishlist(item.id)}
                  onAdd={() => addToCart(item)}
                  hidePrices={hidePrices}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── SIZE MODAL ── */}
      {showSizeModal && (
        <div
          onClick={() => setShowSizeModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(8px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: "1.5rem",
              maxWidth: 500,
              width: "100%",
              padding: "2rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 900, textTransform: "uppercase", color: "#facc15" }}>
                📏 Tabela de Medidas Streetwear
              </h3>
              <button
                onClick={() => setShowSizeModal(false)}
                style={{ background: "none", border: "none", color: "#a1a1aa", fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: ".875rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #3f3f46", color: "#facc15", textTransform: "uppercase", fontSize: 11 }}>
                  <th style={{ padding: "8px" }}>Tamanho</th>
                  <th style={{ padding: "8px" }}>Tórax</th>
                  <th style={{ padding: "8px" }}>Comprimento</th>
                </tr>
              </thead>
              <tbody style={{ color: "#d4d4d8" }}>
                <tr style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "8px", fontWeight: 800, color: "#facc15" }}>P</td>
                  <td style={{ padding: "8px" }}>54 cm</td>
                  <td style={{ padding: "8px" }}>74 cm</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "8px", fontWeight: 800, color: "#facc15" }}>M</td>
                  <td style={{ padding: "8px" }}>56 cm</td>
                  <td style={{ padding: "8px" }}>76 cm</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "8px", fontWeight: 800, color: "#facc15" }}>G</td>
                  <td style={{ padding: "8px" }}>58 cm</td>
                  <td style={{ padding: "8px" }}>78 cm</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "8px", fontWeight: 800, color: "#facc15" }}>GG</td>
                  <td style={{ padding: "8px" }}>60 cm</td>
                  <td style={{ padding: "8px" }}>80 cm</td>
                </tr>
              </tbody>
            </table>
            <button
              onClick={() => setShowSizeModal(false)}
              style={{
                width: "100%",
                marginTop: "1.5rem",
                background: "#facc15",
                color: "#000",
                fontWeight: 900,
                fontSize: 11,
                textTransform: "uppercase",
                padding: "12px",
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
