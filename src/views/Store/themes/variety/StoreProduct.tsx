import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Minus, Plus, ShieldCheck, ShoppingBag, Store, Truck } from "lucide-react";
import StockAvailability from "../../../../components/store/StockAvailability";
import StoreSEO from "../../../../components/store/StoreSEO";
import { StoreButton } from "../../../../components/store/StoreButton";
import { parseProductIdFromRoute } from "../../store-routing";
import { availableUnits } from "../../../../utils/storeStock";
import { getVariationImages } from "../../../../utils/variationImages";
import { VarietyProductCard, varietyChoices, varietyPrice, useVariety } from "./ThemeParts";
import "./styles.css";

export default function StoreProduct() {
  const { productId } = useParams();
  const { tenant, products, active, catName, cart, tracks, hidden, addToCart, openCart, path } = useVariety();
  const product = products.find((item) => item.id === parseProductIdFromRoute(productId));
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [added, setAdded] = useState(false);
  const [photo, setPhoto] = useState(0);
  const choices = useMemo(() => varietyChoices(product), [product]);

  useEffect(() => {
    setSelected({});
    setQuantity(1);
    setNote("");
    setAdded(false);
    setPhoto(0);
  }, [product?.id]);

  if (!product) {
    return (
      <main className="variety-page">
        <div className="variety-wrap variety-block">
          <div className="variety-empty">
            <Store size={44} aria-hidden="true" />
            <h1>Produto não encontrado</h1>
            <StoreButton asChild className="variety-btn-solid">
              <Link to={path("/catalogo")}>Voltar ao catálogo</Link>
            </StoreButton>
          </div>
        </div>
      </main>
    );
  }

  const complete = choices.every((choice) => selected[choice.name]);
  const baseImages = Array.isArray(product.images) && product.images.length ? product.images : product.image_url ? [product.image_url] : [];
  const variationImages = getVariationImages(product, selected);
  const gallery = variationImages.length ? variationImages : baseImages;
  const price = varietyPrice(product, hidden);
  const units = tracks ? availableUnits(product, complete ? selected : undefined) : null;
  const inCart = cart
    .filter((i) => i.id === product.id && choices.every((g) => i.selectedOptions?.[g.name] === selected[g.name]))
    .reduce((s, i) => s + i.quantity, 0);
  const maxQty = units === null ? 99 : Math.max(0, units - (complete ? inCart : 0));
  const soldOut = units !== null && complete && maxQty <= 0;
  const canAdd = complete && !soldOut && quantity >= 1 && quantity <= maxQty;
  const lowStock = units !== null && units > 0 && units <= 5;
  const related = active.filter((p) => p.id !== product.id && p.category_id === product.category_id).slice(0, 4);
  const label = soldOut ? "Esgotado" : !complete ? "Escolha as opções" : "Adicionar ao pedido";

  const add = () => {
    if (!canAdd) return;
    const options = { ...selected, ...(note.trim() ? { Observação: note.trim() } : {}) };
    for (let i = 0; i < quantity; i += 1) addToCart(product, Object.keys(options).length ? options : undefined);
    setAdded(true);
  };

  return (
    <main className="variety-page variety-page-product">
      <StoreSEO
        title={`${product.name} | ${tenant.name}`}
        description={product.description || product.name}
        image={gallery[0] || null}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />
      <div className="variety-wrap variety-block">
        <Link to={path("/catalogo")} className="variety-back"><ArrowLeft size={15} /> Voltar ao catálogo</Link>

        <div className="variety-product">
          <div className="variety-gallery">
            <div className="variety-gallery-main">
              {gallery[photo] ? <img src={gallery[photo]} alt={product.name} /> : <Store size={54} aria-hidden="true" />}
              {price.off && <span className="variety-tag variety-tag-sale">Oferta</span>}
            </div>
            {gallery.length > 1 && (
              <div className="variety-thumbs">
                {gallery.slice(0, 6).map((src, i) => (
                  <button key={src} type="button" aria-label={`Foto ${i + 1}`} aria-pressed={i === photo} onClick={() => setPhoto(i)}>
                    <img src={src} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <section className="variety-buy">
            <span className="variety-eyebrow">{catName(product) || "Variedades"}</span>
            <h1>{product.name}</h1>
            <div className="variety-price variety-price-lg">
              <strong>{hidden ? "Produto sob consulta" : price.now}</strong>
              {price.old && <s>{price.old}</s>}
              {lowStock && <span className="variety-low">Restam {units}</span>}
            </div>
            {product.description && <p className="variety-desc">{product.description}</p>}

            {choices.map((choice) => (
              <fieldset key={choice.name} className="variety-option-group">
                <legend>{choice.name} <span>obrigatório</span></legend>
                <div className="variety-options">
                  {choice.options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected[choice.name] === option.value}
                      onClick={() => setSelected((cur) => ({ ...cur, [choice.name]: option.value }))}
                    >
                      {selected[choice.name] === option.value && <Check size={14} />} {option.value}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}

            <textarea
              className="variety-note-input"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 250))}
              placeholder="Observação do pedido (opcional)"
              aria-label="Observação do pedido"
            />
            <StockAvailability product={product} tenant={tenant} selected={selected} className="mt-4" />

            <div className="variety-buyrow">
              <div className="variety-qty" role="group" aria-label="Quantidade">
                <button type="button" aria-label="Diminuir" onClick={() => setQuantity((v) => Math.max(1, v - 1))}><Minus size={15} /></button>
                <span>{quantity}</span>
                <button type="button" aria-label="Aumentar" disabled={quantity >= maxQty} onClick={() => setQuantity((v) => Math.min(maxQty || 1, v + 1))}><Plus size={15} /></button>
              </div>
              <StoreButton className="variety-btn-solid variety-buy-btn" onClick={add} disabled={!canAdd}>
                <ShoppingBag size={17} /> {label}
              </StoreButton>
            </div>

            {added && (
              <div className="variety-added" role="status">
                <p><Check size={16} /> Adicionado ao pedido online</p>
                <StoreButton size="sm" className="variety-btn-solid" onClick={openCart}>Ver pedido</StoreButton>
              </div>
            )}

            <ul className="variety-trust">
              <li><Truck size={17} aria-hidden="true" /> Entrega combinada com a loja</li>
              <li><ShieldCheck size={17} aria-hidden="true" /> Compra simples e segura</li>
            </ul>
          </section>
        </div>

        {related.length > 0 && (
          <section className="variety-related">
            <h2>Veja também</h2>
            <div className="variety-grid variety-grid-4">
              {related.map((p) => <VarietyProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
