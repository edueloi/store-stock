import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Compass,
  MessageCircle,
  Minus,
  Plus,
  Ruler,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
} from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import StockAvailability from "../../../../components/store/StockAvailability";
import { useStore } from "../../StoreLayout";
import { buildStorePath, parseProductIdFromRoute, resolveStoreSlug } from "../../store-routing";
import { VitraProductCard, vitraHidePrices, vitraImage, vitraMoney } from "./ThemeParts";

export default function StoreProduct() {
  const { slug: routeSlug, productId } = useParams();
  const { tenant, products, categories, addToCart, openCart } = useStore();
  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);
  const product = products.find((p) => p.id === parseProductIdFromRoute(productId));

  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [activeImage, setActiveImage] = useState(0);
  const [activeTab, setActiveTab] = useState<"desc" | "specs" | "delivery">("desc");
  const [added, setAdded] = useState(false);

  // Dynamic choices from product variations/attributes or smart fallbacks for glass
  const choices = useMemo(() => {
    if (Array.isArray(product?.variations) && product!.variations.length > 0) {
      return product!.variations as Array<{ name: string; options: Array<{ value: string }> }>;
    }
    if (Array.isArray(product?.attributes) && product!.attributes.length > 0) {
      return (product!.attributes as any[]).map((a: any) => ({
        name: a.name,
        options: (a.values || []).map((v: string) => ({ value: v })),
      }));
    }
    // Default smart options for architectural glass / glazing products
    return [
      {
        name: "Espessura",
        options: [{ value: "8 mm" }, { value: "10 mm (+ R$ 120)" }],
      },
      {
        name: "Dimensão",
        options: [{ value: "Padrão" }, { value: "Sob medida (sob consulta)" }],
      },
      {
        name: "Acabamento",
        options: [{ value: "Incolor" }, { value: "Fumê (+ R$ 130)" }, { value: "Verde (+ R$ 90)" }],
      },
    ];
  }, [product]);

  if (!product) {
    return (
      <main className="vitra-root" style={{ minHeight: "70vh", display: "grid", placeItems: "center", textAlign: "center", padding: "2rem" }}>
        <div>
          <ShoppingBag size={50} style={{ color: "var(--vitra-accent)", marginBottom: 14 }} />
          <h1 style={{ fontFamily: "'Manrope', sans-serif", fontSize: "1.4rem", fontWeight: 800, margin: "0 0 10px" }}>
            Produto não encontrado
          </h1>
          <p style={{ color: "var(--vitra-muted)", fontSize: 14, margin: "0 0 20px" }}>
            A peça procurada não existe ou foi atualizada.
          </p>
          <Link to={path("/catalogo")} className="vitra-btn-primary">
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
  const mainImage = images[activeImage] || vitraImage(product) || null;

  const hidePrices = vitraHidePrices(tenant);
  const basePrice = Number(product.discount_price || product.price);

  // Extra price calculation if options have (+ R$ XX)
  const extraTotal = Object.values(selected).reduce((sum, val) => {
    const match = val.match(/\(\+ R\$ (\d+)\)/);
    return sum + (match ? Number(match[1]) : 0);
  }, 0);

  const price = basePrice + extraTotal;
  const category = categories.find((c) => c.id === product.category_id)?.name || "Vidros & Design";

  const add = () => {
    const opts = { ...selected };
    if (note.trim()) {
      opts["Observação"] = note.trim();
    }
    for (let i = 0; i < quantity; i++) {
      addToCart(product, Object.keys(opts).length ? opts : undefined);
    }
    setAdded(true);
  };

  const whatsappMessage = encodeURIComponent(
    `Olá! Gostaria de um orçamento detalhado para a peça: *${product.name}* (${hidePrices ? "Sob consulta" : vitraMoney(price)}). Poderiam confirmar prazos e visita técnica para medidas?`,
  );

  const related = products
    .filter((p) => p.is_active && p.id !== product.id && (p.category_id === product.category_id || true))
    .slice(0, 4);

  return (
    <main className="vitra-root" style={{ minHeight: "100vh", paddingBottom: "80px" }}>
      <StoreSEO
        title={`${product.name} | ${tenant.name}`}
        description={product.description || `${product.name} na ${tenant.name}.`}
        image={mainImage || ""}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      <div style={{ maxWidth: 1250, margin: "0 auto", padding: "24px 1.5rem 0" }}>
        {/* ── BREADCRUMB ── */}
        <div style={{ color: "var(--vitra-muted)", fontSize: 12, marginBottom: 28 }}>
          <Link to={path()} style={{ textDecoration: "none", color: "inherit" }}>Início</Link>
          {" / "}
          <Link to={path("/catalogo")} style={{ textDecoration: "none", color: "inherit" }}>Catálogo</Link>
          {" / "}
          <b style={{ color: "var(--vitra-ink)" }}>{product.name}</b>
        </div>

        {/* ── PRODUCT MAIN LAYOUT (2 COLUMNS) ── */}
        <style>{`
          @media (min-width: 900px) {
            .vitra-pdp-grid { grid-template-columns: 1.1fr 1fr !important; }
          }
        `}</style>
        <div
          className="vitra-pdp-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "55px",
            alignItems: "flex-start",
          }}
        >
          {/* ── LEFT: GALLERY ── */}
          <div>
            <div
              style={{
                height: "clamp(350px, 46vw, 530px)",
                background: "var(--vitra-bg)",
                borderRadius: 24,
                overflow: "hidden",
                border: "1px solid var(--vitra-line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {mainImage ? (
                <img
                  src={mainImage}
                  alt={product.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <ShoppingBag size={64} style={{ color: "#a5b5b2" }} />
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div style={{ display: "flex", gap: 11, marginTop: 14, overflowX: "auto" }}>
                {images.map((img, i) => {
                  const isSelected = i === activeImage;
                  return (
                    <button
                      key={i}
                      onClick={() => setActiveImage(i)}
                      style={{
                        width: 95,
                        height: 90,
                        overflow: "hidden",
                        background: "var(--vitra-bg)",
                        border: `2px solid ${isSelected ? "var(--vitra-accent)" : "transparent"}`,
                        borderRadius: 14,
                        padding: 0,
                        cursor: "pointer",
                        flexShrink: 0,
                        transition: "border-color 0.2s",
                      }}
                    >
                      <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── RIGHT: DETAILS & ACTIONS ── */}
          <div>
            <span
              style={{
                fontWeight: 800,
                fontSize: 11,
                letterSpacing: "1.4px",
                color: "var(--vitra-accent-dark)",
                textTransform: "uppercase",
                display: "block",
              }}
            >
              {category}
            </span>

            <h1
              style={{
                fontFamily: "'Manrope', sans-serif",
                fontWeight: 800,
                fontSize: "clamp(1.85rem, 3.2vw, 2.6rem)",
                lineHeight: 1.25,
                letterSpacing: "-1.5px",
                margin: "14px 0 10px",
                color: "var(--vitra-ink)",
              }}
            >
              {product.name}
            </h1>

            {/* Rating */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#b98a4c", marginBottom: 18 }}>
              <span>★★★★★</span>
              <span style={{ color: "var(--vitra-muted)", fontSize: 12 }}>
                Qualidade e acabamento selecionados
              </span>
            </div>

            {/* Price */}
            <div style={{ margin: "20px 0 6px" }}>
              <div
                style={{
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: 800,
                  fontSize: 32,
                  color: "var(--vitra-ink)",
                }}
              >
                {hidePrices ? "Produto sob consulta" : vitraMoney(price)}
              </div>
              <small style={{ display: "block", color: "var(--vitra-muted)", fontSize: 12, marginTop: 4 }}>
                Preço de referência; confirme medidas e instalação no orçamento.
              </small>
            </div>

            {/* Description */}
            <p
              style={{
                lineHeight: 1.85,
                margin: "20px 0 24px",
                color: "#62747a",
                fontSize: 14,
              }}
            >
              {product.description ||
                "Solução em vidro projetada com os mais altos padrões de segurança, elegância e durabilidade. Consulte nossa equipe técnica para adequar medidas e acabamentos ao seu projeto."}
            </p>

            {/* Options / Selectors */}
            {choices.map((choice) => (
              <div key={choice.name} style={{ margin: "18px 0" }}>
                <label style={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em", display: "block", marginBottom: 8, color: "var(--vitra-ink)" }}>
                  {choice.name}
                </label>
                <select
                  value={selected[choice.name] || choice.options[0]?.value || ""}
                  onChange={(e) => setSelected((prev) => ({ ...prev, [choice.name]: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "13px 14px",
                    border: "1px solid #d6dfdc",
                    background: "#ffffff",
                    borderRadius: 14,
                    fontSize: 13,
                    color: "var(--vitra-ink)",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  {choice.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.value}
                    </option>
                  ))}
                </select>
              </div>
            ))}

            {/* Custom Notes */}
            <div style={{ margin: "18px 0" }}>
              <label style={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em", display: "block", marginBottom: 8, color: "var(--vitra-ink)" }}>
                Medidas aproximadas / Observações
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 250))}
                placeholder="Ex.: Largura 1,40m × Altura 1,90m, com puxador especial..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  minHeight: 70,
                  resize: "none",
                  border: "1px solid #d6dfdc",
                  borderRadius: 14,
                  padding: "10px 14px",
                  fontSize: 13,
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
            </div>

            {/* Quantity and Actions Row */}
            <div style={{ display: "flex", gap: 12, marginTop: 24, alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  border: "1px solid var(--vitra-line)",
                  height: 48,
                  alignItems: "center",
                  borderRadius: 14,
                  background: "#ffffff",
                }}
              >
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Diminuir quantidade"
                  style={{ border: 0, background: "#ffffff", width: 40, fontSize: 18, color: "var(--vitra-ink)", cursor: "pointer" }}
                >
                  −
                </button>
                <strong style={{ minWidth: 28, textAlign: "center", fontSize: 14 }}>
                  {quantity}
                </strong>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  aria-label="Aumentar quantidade"
                  style={{ border: 0, background: "#ffffff", width: 40, fontSize: 18, color: "var(--vitra-ink)", cursor: "pointer" }}
                >
                  +
                </button>
              </div>

              <button
                onClick={add}
                className="vitra-btn-primary"
                style={{ flex: 1, height: 48, borderRadius: 999 }}
              >
                Adicionar ao carrinho ↗
              </button>
            </div>

            {/* WhatsApp Purchase Button */}
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
                  width: "100%",
                  height: 46,
                  border: "1px solid #bcd0c7",
                  borderRadius: 14,
                  background: "#f0f6f4",
                  color: "#1c5643",
                  fontWeight: 800,
                  fontSize: 13,
                  textDecoration: "none",
                  marginTop: 10,
                  transition: "background 0.2s",
                }}
              >
                <MessageCircle size={16} /> Solicitar orçamento via WhatsApp
              </a>
            )}

            {/* Added confirmation */}
            {added && (
              <div
                style={{
                  marginTop: 14,
                  background: "var(--vitra-bg)",
                  border: "1px solid var(--vitra-accent)",
                  borderRadius: 14,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--vitra-ink)" }}>
                  ✓ Produto adicionado ao carrinho!
                </span>
                <button
                  onClick={openCart}
                  style={{
                    background: "var(--vitra-accent)",
                    color: "#ffffff",
                    border: 0,
                    borderRadius: 14,
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Ver carrinho
                </button>
              </div>
            )}

            {/* Metadata & Guarantees */}
            <div
              style={{
                borderTop: "1px solid var(--vitra-line)",
                paddingTop: 20,
                marginTop: 24,
                color: "var(--vitra-muted)",
                fontSize: 12,
                lineHeight: 2,
              }}
            >
              <div>
                <b style={{ color: "var(--vitra-ink)" }}>Disponibilidade:</b> Sob encomenda / consulte o prazo
              </div>
              <div>
                <b style={{ color: "var(--vitra-ink)" }}>Medidas especiais:</b> Atendimento personalizado para seu projeto
              </div>
              <div>
                <b style={{ color: "var(--vitra-ink)" }}>Importante:</b> Os valores apresentados são de referência e sujeitos à confirmação de medidas.
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <StockAvailability product={product} tenant={tenant} selected={selected} />
            </div>
          </div>
        </div>

        {/* ── TABS ── */}
        <section style={{ marginTop: 70 }}>
          <div
            style={{
              borderBottom: "1px solid var(--vitra-line)",
              display: "flex",
              gap: 32,
              overflowX: "auto",
            }}
          >
            {[
              { id: "desc", label: "Descrição" },
              { id: "specs", label: "Especificações" },
              { id: "delivery", label: "Entrega e instalação" },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    border: 0,
                    background: "transparent",
                    padding: "16px 4px",
                    fontWeight: 800,
                    fontSize: 14,
                    color: active ? "var(--vitra-ink)" : "var(--vitra-muted)",
                    borderBottom: active ? "2px solid var(--vitra-accent)" : "2px solid transparent",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: ".05em",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div style={{ color: "var(--vitra-muted)", lineHeight: 1.9, padding: "24px 0 0", maxWidth: 900, minHeight: 95, fontSize: 14 }}>
            {activeTab === "desc" && (
              <p style={{ margin: 0 }}>
                {product.description ||
                  "Solução arquitetônica em vidro de alta performance. Desenvolvida para resistir ao uso contínuo, conferindo luminosidade, sofisticação e amplitude ao ambiente."}
              </p>
            )}

            {activeTab === "specs" && (
              <div style={{ display: "grid", gap: 8 }}>
                <div><strong>Categoria:</strong> {category}</div>
                <div><strong>Espessuras recomendadas:</strong> 8 mm temperado, 10 mm temperado ou laminado conforme a norma técnica ABNT NBR 14207.</div>
                <div><strong>Acabamentos:</strong> Incolor, Fumê, Verde, Bronze, Lapidado, Bisotê ou Jateado.</div>
                <div><strong>Ferragens:</strong> Alumínio anodizado, inox ou latão de alta durabilidade com vedação antiumidade.</div>
              </div>
            )}

            {activeTab === "delivery" && (
              <p style={{ margin: 0 }}>
                Prazos, frete, visita técnica e instalação especializada são confirmados pela loja após análise de medidas, endereço e características do local do serviço. Atendemos projetos residenciais, comerciais e corporativos.
              </p>
            )}
          </div>
        </section>

        {/* ── RELATED PRODUCTS ── */}
        {related.length > 0 && (
          <section style={{ marginTop: 65, borderTop: "1px solid var(--vitra-line)", paddingTop: 50 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 30 }}>
              <div>
                <div className="vitra-eyebrow">Você também pode gostar</div>
                <h2
                  style={{
                    fontFamily: "'Manrope', sans-serif",
                    fontWeight: 800,
                    fontSize: "clamp(1.5rem, 2.5vw, 2rem)",
                    letterSpacing: "-1px",
                    margin: "8px 0 0",
                    color: "var(--vitra-ink)",
                  }}
                >
                  Produtos semelhantes
                </h2>
              </div>
              <Link
                to={path("/catalogo")}
                style={{
                  border: 0,
                  background: "transparent",
                  color: "var(--vitra-accent-dark)",
                  fontWeight: 800,
                  fontSize: 13,
                  textDecoration: "none",
                  borderBottom: "1px solid var(--vitra-accent)",
                  paddingBottom: 2,
                }}
              >
                Ver todos →
              </Link>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
                gap: 20,
              }}
            >
              {related.map((p) => (
                <VitraProductCard
                  key={p.id}
                  product={p}
                  category={categories.find((c) => c.id === p.category_id)?.name}
                  path={path}
                  onAdd={() => addToCart(p)}
                  hidePrices={hidePrices}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
