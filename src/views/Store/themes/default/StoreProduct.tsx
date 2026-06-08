import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ShoppingCart, Heart, Share2, ChevronLeft, ChevronRight,
  Package, Plus, Minus, Check, Flame, Tag, AlertCircle, Leaf,
} from "lucide-react";
import { cn } from "../../../../lib/utils";
import { useStore } from "../../StoreLayout";
import StoreSEO from "../../../../components/store/StoreSEO";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";

export default function StoreProduct() {
  const { slug: routeSlug, productId } = useParams();
  const { products, categories, addToCart, style, openCart, tenant } = useStore();
  const slug = resolveStoreSlug(routeSlug);

  const product = products.find(p => p.id === Number(productId));
  const allImages = Array.isArray(product?.images) && product.images.length > 0 ? product.images : product?.image_url ? [product.image_url] : [];
  const [activeImg, setActiveImg] = useState(0);

  // Normalize both variation formats into a unified shape
  const normalizedVariations = (() => {
    if (Array.isArray(product?.variations) && product.variations.length > 0) {
      return product.variations;
    }
    if (Array.isArray(product?.attributes) && product.attributes.length > 0 && Array.isArray(product?.skus)) {
      return product.attributes.map(attr => ({
        name: attr.name,
        options: attr.values.map(val => {
          const totalStock = (product.skus ?? [])
            .filter(sku => sku.combo[attr.name] === val)
            .reduce((sum, sku) => sum + (sku.stock ?? 0), 0);
          return { value: val, stock: totalStock };
        }),
      }));
    }
    return [];
  })();
  const hasVariations = normalizedVariations.length > 0;

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    if (!normalizedVariations.length) return {};
    return Object.fromEntries(
      normalizedVariations.map(v => {
        const available = v.options.filter(o => o.stock > 0);
        return [v.name, available.length === 1 ? available[0].value : ""];
      })
    );
  });
  const [showVariationError, setShowVariationError] = useState(false);
  const [qty, setQty] = useState(1);
  const [inWishlist, setInWishlist] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20 text-center bg-[#fefaf6] min-h-screen">
        <Package size={48} strokeWidth={1} className="mx-auto mb-4 text-amber-200" />
        <p className="text-sm font-bold uppercase text-stone-700">Produto não encontrado</p>
        <Link to={buildStorePath(slug, "/catalogo")} className="mt-4 inline-block text-xs font-bold text-amber-600 hover:underline">
          ← Voltar ao catálogo
        </Link>
      </div>
    );
  }

  const category = categories.find(c => c.id === product.category_id);
  const discountPct = product.discount_price
    ? Math.round((1 - Number(product.discount_price) / Number(product.price)) * 100)
    : 0;
  const related = products.filter(p => p.is_active && p.category_id === product.category_id && p.id !== product.id).slice(0, 4);

  const allVariationsSelected = !hasVariations || normalizedVariations.every(v => !!selectedOptions[v.name]);

  const handleAddToCart = () => {
    if (!allVariationsSelected) {
      setShowVariationError(true);
      setTimeout(() => setShowVariationError(false), 3000);
      return;
    }
    for (let i = 0; i < qty; i++) {
      addToCart(product, hasVariations ? selectedOptions : undefined);
    }
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
    openCart();
  };

  const handleSelectOption = (variationName: string, value: string) => {
    setSelectedOptions(prev => ({ ...prev, [variationName]: value }));
    setShowVariationError(false);
  };

  const selectedStocks = normalizedVariations.map(v => {
    const opt = v.options.find(o => o.value === selectedOptions[v.name]);
    return opt?.stock ?? 0;
  });
  const minStock = selectedStocks.length > 0
    ? (allVariationsSelected ? Math.min(...selectedStocks) : 99)
    : (product.stock_quantity ?? 99);

  const handleShare = async () => {
    const url = window.location.href;
    const title = product.name;
    const text = `${product.name}${product.description ? ` — ${product.description.slice(0, 100)}` : ""}\nR$ ${Number(product.discount_price || product.price).toFixed(2)}`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // user cancelled or not supported, fall through
      }
    }
    await navigator.clipboard.writeText(url);
    alert("Link copiado!");
  };

  const handleShareWhatsApp = () => {
    const url = window.location.href;
    const price = Number(product.discount_price || product.price).toFixed(2);
    const text = `*${product.name}*\nR$ ${price}\n${product.description ? `${product.description.slice(0, 120)}\n` : ""}Ver produto: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const productUrl = typeof window !== "undefined" ? window.location.href : "";
  const productPrice = Number(product.discount_price || product.price).toFixed(2);

  return (
    <div className="min-h-screen bg-[#fefaf6]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-12">
        <StoreSEO
          title={`${product.name} — ${tenant.name}`}
          description={product.description || `Compre ${product.name} na ${tenant.name}. R$ ${productPrice}. ${product.discount_price ? `De R$ ${Number(product.price).toFixed(2)} por R$ ${productPrice}. ` : ""}Atendimento via WhatsApp.`}
          image={allImages[0]}
          url={productUrl}
          type="product"
          price={productPrice}
          siteName={tenant.name}
          keywords={`${product.name}, ${category?.name || ""}, ${tenant.name}, comprar, preço, R$ ${productPrice}`}
          jsonLd={{
            "@context": "https://schema.org",
            "@type": "Product",
            "name": product.name,
            "description": product.description || product.name,
            "image": allImages,
            "sku": product.sku || String(product.id),
            "brand": { "@type": "Brand", "name": tenant.name },
            "offers": {
              "@type": "Offer",
              "url": productUrl,
              "priceCurrency": "BRL",
              "price": productPrice,
              "itemCondition": "https://schema.org/NewCondition",
              "availability": (product.stock_quantity ?? 1) > 0
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
              "seller": { "@type": "Organization", "name": tenant.name },
            },
            ...(category ? { "category": category.name } : {}),
          }}
        />

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[10px] font-bold uppercase text-stone-400 tracking-wider">
          <Link to={buildStorePath(slug)} className="hover:text-amber-700 transition-colors">Início</Link>
          <span>/</span>
          <Link to={buildStorePath(slug, "/catalogo")} className="hover:text-amber-700 transition-colors">Catálogo</Link>
          {category && (
            <>
              <span>/</span>
              <Link to={buildStorePath(slug, `/catalogo?cat=${category.id}`)} className="hover:text-amber-700 transition-colors">{category.name}</Link>
            </>
          )}
          <span>/</span>
          <span className="truncate max-w-[200px] text-stone-700">{product.name}</span>
        </nav>

        {/* Main product block */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16">

          {/* Image gallery */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-3"
          >
            <div className={cn("overflow-hidden relative group aspect-square rounded-2xl", "bg-[#fdf7ef] border border-[#f0e6d3]")}>
              {allImages.length > 0 ? (
                <img src={allImages[activeImg]} alt={product.name} className="w-full h-full object-cover transition-all duration-300" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-amber-200">
                  <Package size={80} strokeWidth={1} />
                </div>
              )}
              {discountPct > 0 && (
                <span className="absolute top-4 left-4 text-white text-xs font-black px-3 py-1 rounded-full shadow-lg"
                  style={{ backgroundColor: "#c2713a" }}>
                  -{discountPct}% OFF
                </span>
              )}
              {product.is_featured && (
                <span className="absolute top-4 right-4 text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg"
                  style={{ backgroundColor: style.accent }}>
                  <Flame size={11} /> Destaque
                </span>
              )}
              {allImages.length > 1 && (
                <>
                  <button
                    onClick={() => setActiveImg(i => (i - 1 + allImages.length) % allImages.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white text-stone-600 border border-amber-100"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setActiveImg(i => (i + 1) % allImages.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white text-stone-600 border border-amber-100"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {allImages.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveImg(i)}
                        className={cn("h-1.5 rounded-full transition-all",
                          i === activeImg ? "w-5 bg-amber-500" : "w-1.5 bg-amber-300/60")}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {allImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={cn(
                      "w-16 h-16 shrink-0 overflow-hidden border-2 transition-all rounded-xl",
                      i === activeImg
                        ? "shadow-md scale-105"
                        : "border-[#f0e6d3] hover:border-amber-300"
                    )}
                    style={i === activeImg ? { borderColor: style.accent } : {}}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Details */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col gap-5"
          >
            {/* Left accent bar + Category + Name */}
            <div className="flex gap-4">
              <div className="w-1 rounded-full shrink-0 self-stretch" style={{ backgroundColor: style.accent }} />
              <div className="flex-1">
                {category && (
                  <Link
                    to={buildStorePath(slug, `/catalogo?cat=${category.id}`)}
                    className="flex items-center gap-1.5 mb-2 hover:opacity-70 transition-opacity text-[10px] font-black uppercase tracking-widest"
                    style={{ color: style.accent }}
                  >
                    <Leaf size={11} /> {category.name}
                  </Link>
                )}
                <h1 className="text-2xl md:text-3xl font-serif font-bold tracking-tight leading-tight text-stone-800">
                  {product.name}
                </h1>
                {product.sku && (
                  <p className="text-[10px] font-mono mt-1 uppercase tracking-widest text-stone-400">
                    Cód: <span className="font-bold text-stone-600">{product.sku}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="flex items-end gap-4 bg-[#fdf7ef] rounded-2xl p-4 border border-[#f0e6d3]">
              {product.discount_price ? (
                <>
                  <span className="text-3xl font-bold font-mono" style={{ color: "#c2713a" }}>
                    R$ {Number(product.discount_price).toFixed(2)}
                  </span>
                  <div className="flex flex-col pb-1">
                    <span className="text-sm line-through font-mono text-stone-400">
                      R$ {Number(product.price).toFixed(2)}
                    </span>
                    <span className="text-[10px] font-black uppercase" style={{ color: "#c2713a" }}>
                      Economia de R$ {(Number(product.price) - Number(product.discount_price)).toFixed(2)}
                    </span>
                  </div>
                </>
              ) : (
                <span className="text-3xl font-bold font-mono" style={{ color: style.accent }}>
                  R$ {Number(product.price).toFixed(2)}
                </span>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-sm text-stone-600 leading-relaxed border-t border-amber-100 pt-4">
                {product.description}
              </p>
            )}

            {/* Variations */}
            {normalizedVariations.map((v, vi) => (
              <div key={vi} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className={cn(
                    "text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5",
                    showVariationError && !selectedOptions[v.name] ? "text-red-500" : "text-stone-500"
                  )}>
                    {v.name}
                    {showVariationError && !selectedOptions[v.name] && (
                      <AlertCircle size={11} className="text-red-500" />
                    )}
                  </p>
                  {selectedOptions[v.name] && (
                    <span className="text-[11px] font-bold text-stone-700">{selectedOptions[v.name]}</span>
                  )}
                </div>
                {showVariationError && !selectedOptions[v.name] && (
                  <p className="text-[10px] text-red-500 font-bold -mt-1">Selecione {v.name.toLowerCase()} antes de adicionar</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {v.options.map((opt, oi) => {
                    const isSelected = selectedOptions[v.name] === opt.value;
                    const outOfStock = opt.stock === 0;
                    return (
                      <button
                        key={oi}
                        disabled={outOfStock}
                        onClick={() => handleSelectOption(v.name, opt.value)}
                        className={cn(
                          "relative px-4 py-2.5 rounded-xl border-2 text-xs font-bold transition-all",
                          isSelected
                            ? "text-white shadow-[0_3px_14px_rgba(217,119,6,0.3)]"
                            : outOfStock
                            ? "text-stone-300 border-stone-100 bg-stone-50 cursor-not-allowed line-through"
                            : "text-stone-600 border-[#f0e6d3] hover:border-amber-300 bg-white hover:bg-amber-50"
                        )}
                        style={isSelected ? { backgroundColor: style.accent, borderColor: style.accent } : {}}
                      >
                        {opt.value}
                        {opt.stock > 0 && opt.stock <= 5 && !outOfStock && (
                          <span className="block text-[8px] font-black mt-0.5 opacity-70">Últimas {opt.stock}!</span>
                        )}
                        {outOfStock && (
                          <span className="block text-[8px] font-black mt-0.5 text-red-400">Esgotado</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Quantity + Add to cart */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <div className="flex items-center h-12 overflow-hidden border w-full sm:w-auto justify-between sm:justify-normal bg-amber-50 rounded-xl border-amber-200">
                <button
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="w-12 h-full flex items-center justify-center transition-all text-stone-500 hover:text-stone-900 hover:bg-amber-100"
                >
                  <Minus size={14} />
                </button>
                <span className="w-10 text-center font-bold text-sm text-stone-700">{qty}</span>
                <button
                  onClick={() => setQty(q => Math.min(minStock, q + 1))}
                  className="w-12 h-full flex items-center justify-center transition-all text-stone-500 hover:text-stone-900 hover:bg-amber-100"
                >
                  <Plus size={14} />
                </button>
              </div>

              <motion.button
                whileHover={minStock > 0 ? { scale: 1.02 } : {}}
                whileTap={minStock > 0 ? { scale: 0.97 } : {}}
                onClick={handleAddToCart}
                disabled={minStock === 0}
                style={minStock > 0 ? { backgroundColor: style.accent } : {}}
                className={cn(
                  "flex-1 h-12 flex items-center justify-center gap-3 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all",
                  minStock > 0
                    ? "shadow-[0_4px_18px_rgba(217,119,6,0.35)] hover:shadow-[0_6px_26px_rgba(217,119,6,0.5)]"
                    : "bg-stone-200 text-stone-400 cursor-not-allowed"
                )}
              >
                {justAdded ? (
                  <><Check size={16} strokeWidth={3} /> Adicionado!</>
                ) : minStock === 0 ? (
                  "Indisponível"
                ) : (
                  <><ShoppingCart size={16} /> Adicionar ao Carrinho</>
                )}
              </motion.button>

              <button
                onClick={() => setInWishlist(v => !v)}
                className={cn("w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all",
                  inWishlist
                    ? "bg-red-50 border-red-300 text-red-500"
                    : "border-[#f0e6d3] text-stone-400 hover:border-red-300 hover:text-red-400 bg-white")}
              >
                <Heart size={16} fill={inWishlist ? "currentColor" : "none"} />
              </button>
            </div>

            {/* Stock indicator */}
            {minStock > 0 && minStock <= 10 && allVariationsSelected && (
              <p className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: style.accent }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: style.accent }} />
                Restam apenas {minStock} unidade{minStock !== 1 ? "s" : ""}!
              </p>
            )}

            {/* Share */}
            <div className="flex items-center gap-3 pt-3 border-t border-amber-100">
              <button
                onClick={handleShare}
                className="flex items-center gap-2 text-[11px] font-bold transition-colors text-stone-400 hover:text-stone-700"
              >
                <Share2 size={13} /> Compartilhar
              </button>
              <button
                onClick={handleShareWhatsApp}
                className="flex items-center gap-2 text-[11px] font-bold transition-colors text-stone-400 hover:text-[#25D366]"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Enviar no WhatsApp
              </button>
            </div>
          </motion.div>
        </div>

        {/* Related products */}
        {related.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-7 rounded-full" style={{ backgroundColor: style.accent }} />
              <Leaf size={16} style={{ color: style.accent }} />
              <h2 className="text-xl font-serif font-bold tracking-tight text-stone-800">Produtos Relacionados</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {related.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  whileHover={{ y: -4 }}
                >
                  <Link
                    to={buildStorePath(slug, `/produto/${p.id}`)}
                    className="group flex flex-col border transition-all overflow-hidden rounded-2xl bg-[#fffbf5] border-[#f0e6d3] hover:border-amber-200 hover:shadow-[0_6px_24px_rgba(217,119,6,0.13)]"
                  >
                    <div className="overflow-hidden aspect-square bg-amber-50/60">
                      {p.image_url
                        ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        : <div className="w-full h-full flex items-center justify-center text-amber-200"><Package size={32} strokeWidth={1} /></div>}
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-semibold text-stone-700 line-clamp-2 leading-snug">{p.name}</p>
                      <p className="text-sm font-bold font-mono mt-1" style={{ color: style.accent }}>
                        R$ {Number(p.discount_price || p.price).toFixed(2)}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
