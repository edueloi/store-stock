import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit, useBuy, priceInfo, productImage, optionGroups } from "../street/kit";
import type { Product } from "../../../../types";
import "./styles.css";

export default function StoreProduct() {
  const { id } = useParams();
  const { tenant, active, categories, path, hidden, catName, addToCart, openCart } = useKit();

  const product = active.find((p) => p.id === Number(id));
  const { selected, setSelected, qty, setQty, photo, setPhoto, gallery } = useBuy(product);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  if (!product) {
    return (
      <div className="rua-root" style={{ padding: "120px 20px", textAlign: "center" }}>
        <h1 style={{ fontFamily: "var(--rua-display)", fontSize: 32 }}>PRODUTO NÃO ENCONTRADO</h1>
        <p style={{ color: "var(--rua-muted)", marginTop: 12 }}>
          Esta peça pode ter esgotado ou sido removida da coleção.
        </p>
        <Link to={path("/catalogo")} className="rua-btn" style={{ marginTop: 24 }}>
          Voltar ao catálogo ↗
        </Link>
      </div>
    );
  }

  const prices = priceInfo(product, hidden);
  const groups = optionGroups(product);
  const mainImage = gallery[photo] || productImage(product) || "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=800&q=85";
  const brand = product.attributes?.find((a) => a.name.toLowerCase() === "marca")?.values?.[0] || catName(product) || "STREET CULTURE";
  const category = categories.find((c) => c.id === product.category_id);

  // Produtos relacionados da mesma categoria
  const related = active
    .filter((p) => p.id !== product.id && p.category_id === product.category_id)
    .slice(0, 4);

  // Produtos recomendados
  const recommended = active
    .filter((p) => p.id !== product.id && p.category_id !== product.category_id)
    .slice(0, 4);

  const handleAddToCart = () => {
    // Validação se há grupos de opções não selecionados
    const missing = groups.find((g) => !selected[g.name]);
    if (missing) {
      setToastMsg(`Selecione ${missing.name} antes de adicionar.`);
      setTimeout(() => setToastMsg(null), 3000);
      return;
    }

    addToCart(product, qty, selected);
    setToastMsg("Peça adicionada ao carrinho!");
    setTimeout(() => {
      setToastMsg(null);
      openCart();
    }, 400);
  };

  const renderProductCard = (p: Product) => {
    const pPrices = priceInfo(p, hidden);
    const pImg = productImage(p) || "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=600&q=85";
    const pBrand = p.attributes?.find((a) => a.name.toLowerCase() === "marca")?.values?.[0] || catName(p) || "STREET";

    return (
      <Link key={p.id} to={path(`/produto/${p.id}`)} className="rua-product">
        <div className="rua-product-image">
          <img loading="lazy" src={pImg} alt={p.name} />
          {p.is_featured && <span className="rua-product-tag">BEST SELLER</span>}
          <div className="rua-product-quick">Ver detalhes ↗</div>
        </div>
        <div className="rua-product-brand">{pBrand}</div>
        <div className="rua-product-name">{p.name}</div>
        <div className="rua-price">
          {pPrices.now}
          {pPrices.old && <span className="rua-old-price">{pPrices.old}</span>}
        </div>
      </Link>
    );
  };

  return (
    <div className="rua-root">
      <StoreSEO
        title={`${product.name} | ${tenant.name || "RUA013"}`}
        description={product.description || `${product.name} — peça selecionada para quem vive a cultura streetwear.`}
        image={mainImage}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      {toastMsg && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#171717",
            color: "#fff",
            padding: "14px 22px",
            fontWeight: 700,
            fontSize: 13,
            zIndex: 9999,
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          }}
        >
          {toastMsg}
        </div>
      )}

      <div className="rua-container">
        {/* PRODUCT LAYOUT */}
        <div className="rua-product-layout">
          {/* GALLERY */}
          <div>
            <div className="rua-gallery-main">
              <img src={mainImage} alt={product.name} />
            </div>
            {gallery.length > 1 && (
              <div className="rua-thumbnails">
                {gallery.map((imgUrl, i) => (
                  <button
                    key={imgUrl}
                    type="button"
                    className={photo === i ? "chosen" : ""}
                    onClick={() => setPhoto(i)}
                    aria-label={`Foto ${i + 1}`}
                  >
                    <img src={imgUrl} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PRODUCT INFO */}
          <div className="rua-product-info">
            <div className="rua-breadcrumb">
              <Link to={path()}>Início</Link> / <Link to={path("/catalogo")}>Shop</Link>
              {category && (
                <> / <Link to={path(`/catalogo?categoria=${category.id}`)}>{category.name}</Link></>
              )}
            </div>

            <div className="rua-eyebrow" style={{ marginTop: 24 }}>
              {brand}
            </div>

            <h1>{product.name}</h1>

            <div className="rua-detail-price">{prices.now}</div>

            {!hidden && (
              <div className="rua-installments">
                ou até 3x de{" "}
                {(Number(product.discount_price || product.price) / 3).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}{" "}
                sem juros no cartão
              </div>
            )}

            <div className="rua-divider" />

            {/* OPTIONS (Sizes & Colors) */}
            {groups.map((group) => (
              <div key={group.name} style={{ marginBottom: 20 }}>
                <div className="rua-option-label">
                  {group.name}:{" "}
                  <span style={{ color: "var(--rua-muted)" }}>
                    {selected[group.name] || "Selecione"}
                  </span>
                </div>
                <div className="rua-options">
                  {group.values.map((val) => (
                    <button
                      key={val}
                      type="button"
                      className={`rua-option ${selected[group.name] === val ? "selected" : ""}`}
                      onClick={() => setSelected((prev) => ({ ...prev, [group.name]: val }))}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* BUY ROW */}
            <div className="rua-buy-row">
              <div className="rua-qty">
                <button
                  type="button"
                  aria-label="Diminuir quantidade"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                >
                  −
                </button>
                <span style={{ fontWeight: 800 }}>{qty}</span>
                <button
                  type="button"
                  aria-label="Aumentar quantidade"
                  onClick={() => setQty((q) => q + 1)}
                >
                  +
                </button>
              </div>

              <button
                type="button"
                className="rua-btn"
                onClick={handleAddToCart}
              >
                Adicionar ao carrinho ↗
              </button>
            </div>

            {/* DESCRIPTION */}
            <p className="rua-details-copy">
              {product.description ||
                `${product.name} — peça desenvolvida com foco em durabilidade, caimento streetwear autêntico e liberdade total para a sua rotina.`}
            </p>

            <div className="rua-detail-notes">↗ &nbsp; Envio para todo o Brasil com rastreamento</div>
            <div className="rua-detail-notes">✳ &nbsp; Troca garantida em até 7 dias corridos</div>
          </div>
        </div>

        {/* COMBINA COM ESSE (RELATED) */}
        {related.length > 0 && (
          <div className="rua-section">
            <div className="rua-section-title">
              <div>
                <div className="rua-eyebrow">Complete o look</div>
                <h2>COMBINA COM ESSE.</h2>
              </div>
            </div>
            <div className="rua-product-grid">
              {related.map(renderProductCard)}
            </div>
          </div>
        )}

        {/* VOCÊ TAMBÉM CURTE (RECOMMENDED) */}
        {recommended.length > 0 && (
          <div className="rua-section" style={{ paddingTop: 0 }}>
            <div className="rua-section-title">
              <div>
                <div className="rua-eyebrow">Indicações da crew</div>
                <h2>VOCÊ TAMBÉM CURTE.</h2>
              </div>
            </div>
            <div className="rua-product-grid">
              {recommended.map(renderProductCard)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
