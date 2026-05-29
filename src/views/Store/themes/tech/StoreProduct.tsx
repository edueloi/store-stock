import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ShoppingCart, Heart, Share2, ChevronLeft, ChevronRight,
  Package, Plus, Minus, Check, Flame, Tag, AlertCircle,
  Zap, Shield, Truck,
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
  const allImages = Array.isArray(product?.images) && product.images.length > 0
    ? product.images as string[]
    : product?.image_url ? [product.image_url] : [];
  const [activeImg, setActiveImg] = useState(0);

  const hasVariations = Array.isArray(product?.variations) && product.variations.length > 0;

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    if (!product?.variations) return {};
    return Object.fromEntries(
      product.variations.map(v => {
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
      <div className="min-h-screen bg-[#f4f6fb] flex flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="w-20 h-20 rounded-2xl border border-slate-200 bg-white flex items-center justify-center shadow-sm">
          <Package size={40} strokeWidth={1} className="text-slate-300" />
        </div>
        <p className="text-base font-black uppercase tracking-tight text-slate-500">Produto não encontrado</p>
        <Link
          to={buildStorePath(slug, "/catalogo")}
          className="text-[11px] font-bold uppercase tracking-wider px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:border-sky-300 hover:text-sky-600 transition-all shadow-sm"
        >
          ← Voltar ao catálogo
        </Link>
      </div>
    );
  }

  const category = categories.find(c => c.id === product.category_id);
  const discountPct = product.discount_price
    ? Math.round((1 - Number(product.discount_price) / Number(product.price)) * 100)
    : 0;
  const related = products
    .filter(p => p.is_active && p.category_id === product.category_id && p.id !== product.id)
    .slice(0, 4);

  const allVariationsSelected = !hasVariations || (
    Array.isArray(product.variations) &&
    product.variations.every(v => !!selectedOptions[v.name])
  );

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

  const selectedStocks = Array.isArray(product.variations)
    ? product.variations.map(v => {
        const opt = v.options.find(o => o.value === selectedOptions[v.name]);
        return opt?.stock ?? 0;
      })
    : [];
  const minStock = selectedStocks.length > 0
    ? (allVariationsSelected ? Math.min(...selectedStocks) : 99)
    : (product.stock_quantity ?? 99);

  const handleShare = async () => {
    const url = window.location.href;
    const title = product.name;
    const text = `${product.name}${product.description ? ` — ${product.description.slice(0, 100)}` : ""}\nR$ ${Number(product.discount_price || product.price).toFixed(2)}`;
    if (navigator.share) {
      try { await navigator.share({ title, text, url }); return; } catch {}
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
    <div className="min-h-screen bg-[#f4f6fb]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-10">
        <StoreSEO
          title={`${product.name} — ${tenant.name}`}
          description={product.description || `Compre ${product.name} na ${tenant.name}. R$ ${productPrice}. Atendimento via WhatsApp.`}
          image={allImages[0]}
          url={productUrl}
          type="product"
          price={productPrice}
          siteName={tenant.name}
          keywords={`${product.name}, ${category?.name || ""}, ${tenant.name}, comprar, R$ ${productPrice}`}
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
        <nav className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
          <Link to={buildStorePath(slug)} className="hover:text-sky-500 transition-colors">Início</Link>
          <span>/</span>
          <Link to={buildStorePath(slug, "/catalogo")} className="hover:text-sky-500 transition-colors">Catálogo</Link>
          {category && (
            <>
              <span>/</span>
              <Link to={buildStorePath(slug, `/catalogo?cat=${category.id}`)} className="hover:text-sky-500 transition-colors">
                {category.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="truncate max-w-[180px] text-slate-600">{product.name}</span>
        </nav>

        {/* Product block */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-14 items-start">

          {/* ── Gallery ── */}
          <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
            <div className="overflow-hidden relative group aspect-square bg-white border border-slate-200 rounded-2xl shadow-sm">
              {allImages.length > 0 ? (
                <img src={allImages[activeImg]} alt={product.name} className="w-full h-full object-cover transition-all duration-300" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <Package size={80} strokeWidth={1} />
                </div>
              )}

              {/* Discount badge */}
              {discountPct > 0 && (
                <span
                  className="absolute top-4 left-4 text-white text-xs font-black px-3 py-1 rounded-xl shadow-sm"
                  style={{ backgroundColor: style.accent }}
                >
                  -{discountPct}% OFF
                </span>
              )}

              {/* Featured badge */}
              {product.is_featured && (
                <span className="absolute top-4 right-4 text-[10px] font-black px-3 py-1 rounded-xl flex items-center gap-1.5 border shadow-sm"
                  style={{ backgroundColor: style.accent + "15", borderColor: style.accent + "40", color: style.accent }}>
                  <Flame size={11} /> Destaque
                </span>
              )}

              {/* Gallery navigation */}
              {allImages.length > 1 && (
                <>
                  <button
                    onClick={() => setActiveImg(i => (i - 1 + allImages.length) % allImages.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setActiveImg(i => (i + 1) % allImages.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {allImages.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveImg(i)}
                        className={cn("h-1.5 rounded-full transition-all", i === activeImg ? "w-5 bg-slate-800" : "w-1.5 bg-slate-300")}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Hover border */}
              <div
                className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:opacity-100 transition-all duration-300 pointer-events-none opacity-0"
                style={{ borderColor: style.accent + "30" }}
              />
            </div>

            {/* Thumbnails */}
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {allImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={cn("w-16 h-16 shrink-0 overflow-hidden border-2 rounded-xl transition-all",
                      i === activeImg
                        ? "scale-105"
                        : "border-slate-200 hover:border-sky-300")}
                    style={i === activeImg ? { borderColor: style.accent } : {}}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* ── Details panel ── */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 md:p-8 shadow-sm"
          >
            {/* Top accent bar */}
            <div className="h-1 rounded-full -mt-5 -mx-5 sm:-mx-6 md:-mx-8 mb-2 rounded-t-2xl" style={{ backgroundColor: style.accent }} />

            {/* Category + name */}
            <div>
              {category && (
                <Link
                  to={buildStorePath(slug, `/catalogo?cat=${category.id}`)}
                  className="flex items-center gap-1.5 mb-2 text-[10px] font-black uppercase tracking-widest hover:opacity-70 transition-opacity"
                  style={{ color: style.accent }}
                >
                  <Tag size={11} /> {category.name}
                </Link>
              )}
              <h1 className="text-2xl md:text-3xl font-bold leading-tight text-slate-900">{product.name}</h1>
              {product.sku && (
                <p className="text-[10px] font-mono mt-1 uppercase tracking-widest text-slate-400">
                  Cód: <span className="font-bold text-slate-500">{product.sku}</span>
                </p>
              )}
            </div>

            {/* Price */}
            <div className="flex items-end gap-4 pb-4 border-b border-slate-100">
              {product.discount_price ? (
                <>
                  <span className="text-3xl font-black text-slate-900 font-mono">
                    R$ {Number(product.discount_price).toFixed(2)}
                  </span>
                  <div className="flex flex-col pb-0.5">
                    <span className="text-sm line-through font-mono text-slate-400">
                      R$ {Number(product.price).toFixed(2)}
                    </span>
                    <span className="text-[10px] font-black uppercase flex items-center gap-1" style={{ color: style.accent }}>
                      <Zap size={9} /> Economia de R$ {(Number(product.price) - Number(product.discount_price)).toFixed(2)}
                    </span>
                  </div>
                </>
              ) : (
                <span className="text-3xl font-black font-mono" style={{ color: style.accent }}>
                  R$ {Number(product.price).toFixed(2)}
                </span>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-sm text-slate-500 leading-relaxed border-t border-slate-100 pt-4">
                {product.description}
              </p>
            )}

            {/* Variations */}
            {Array.isArray(product.variations) && product.variations.map((v, vi) => (
              <div key={vi} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className={cn(
                    "text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5",
                    showVariationError && !selectedOptions[v.name] ? "text-red-500" : "text-slate-500"
                  )}>
                    {v.name}
                    {showVariationError && !selectedOptions[v.name] && <AlertCircle size={11} className="text-red-500" />}
                  </p>
                  {selectedOptions[v.name] && (
                    <span className="text-[11px] font-bold text-slate-600">{selectedOptions[v.name]}</span>
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
                          isSelected ? "text-white" : outOfStock
                            ? "text-slate-300 border-slate-100 bg-slate-50 cursor-not-allowed line-through"
                            : "text-slate-600 border-slate-200 hover:border-sky-300 bg-white"
                        )}
                        style={isSelected ? { backgroundColor: style.accent, borderColor: style.accent } : {}}
                      >
                        {opt.value}
                        {opt.stock > 0 && opt.stock <= 5 && !outOfStock && (
                          <span className="block text-[8px] font-black mt-0.5 opacity-70">Últimas {opt.stock}!</span>
                        )}
                        {outOfStock && <span className="block text-[8px] font-black mt-0.5 text-red-400">Esgotado</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Quantity + Add to cart */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <div className="flex items-center h-12 overflow-hidden border w-full sm:w-auto justify-between sm:justify-normal bg-slate-50 rounded-xl border-slate-200">
                <button
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="w-12 h-full flex items-center justify-center transition-all text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <Minus size={14} />
                </button>
                <span className="w-10 text-center font-black text-sm text-slate-800">{qty}</span>
                <button
                  onClick={() => setQty(q => Math.min(minStock, q + 1))}
                  className="w-12 h-full flex items-center justify-center transition-all text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <Plus size={14} />
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={minStock === 0}
                style={minStock > 0 ? { backgroundColor: style.accent, boxShadow: `0 4px 16px ${style.accent}40` } : {}}
                className={cn(
                  "flex-1 h-12 flex items-center justify-center gap-3 text-white font-bold text-xs uppercase tracking-[0.14em] rounded-xl transition-all active:scale-95",
                  minStock === 0 && "!bg-slate-100 !shadow-none text-slate-400 cursor-not-allowed border border-slate-200",
                  minStock > 0 && "hover:opacity-90"
                )}
              >
                {justAdded ? (
                  <><Check size={16} strokeWidth={3} /> Adicionado!</>
                ) : minStock === 0 ? (
                  "Indisponível"
                ) : (
                  <><ShoppingCart size={16} /> Adicionar ao Carrinho</>
                )}
              </button>

              <button
                onClick={() => setInWishlist(v => !v)}
                className={cn("w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all",
                  inWishlist
                    ? "bg-red-50 border-red-200 text-red-500"
                    : "border-slate-200 text-slate-400 hover:border-red-200 hover:text-red-500")}
              >
                <Heart size={16} fill={inWishlist ? "currentColor" : "none"} />
              </button>
            </div>

            {/* Low stock warning */}
            {minStock > 0 && minStock <= 10 && allVariationsSelected && (
              <p className="text-[11px] font-bold text-amber-600 flex items-center gap-1.5">
                <span className="w-2 h-2 bg-amber-400 rounded-full" />
                Restam apenas {minStock} unidade{minStock !== 1 ? "s" : ""}!
              </p>
            )}

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
              {[
                { icon: <Shield size={13} />, label: "Compra segura" },
                { icon: <Truck size={13} />, label: "Envio rápido" },
                { icon: <Check size={13} strokeWidth={3} />, label: "Qualidade garantida" },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center gap-1 text-center">
                  <span style={{ color: style.accent }}>{item.icon}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide leading-tight">{item.label}</span>
                </div>
              ))}
            </div>

            {/* Share */}
            <div className="flex items-center gap-4 pt-1 border-t border-slate-100">
              <button onClick={handleShare} className="flex items-center gap-2 text-[11px] font-bold transition-colors text-slate-400 hover:text-sky-500">
                <Share2 size={13} /> Compartilhar
              </button>
              <button onClick={handleShareWhatsApp} className="flex items-center gap-2 text-[11px] font-bold transition-colors text-slate-400 hover:text-[#25D366]">
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
          <section className="pt-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-6 rounded-full" style={{ backgroundColor: style.accent }} />
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Produtos Relacionados</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {related.map(p => {
                const pImg = (Array.isArray(p.images) && (p.images as string[])[0]) || p.image_url || null;
                return (
                  <Link
                    key={p.id}
                    to={buildStorePath(slug, `/produto/${p.id}`)}
                    className="group flex flex-col border border-slate-200 bg-white overflow-hidden rounded-2xl transition-all hover:-translate-y-1 hover:border-sky-300 hover:shadow-[0_8px_24px_rgba(14,165,233,0.12)] shadow-sm"
                  >
                    <div className="overflow-hidden aspect-square bg-slate-50">
                      {pImg
                        ? <img src={pImg} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        : <div className="w-full h-full flex items-center justify-center text-slate-300"><Package size={32} strokeWidth={1} /></div>}
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-sky-600 transition-colors">{p.name}</p>
                      <p className="text-sm font-black font-mono mt-1.5" style={{ color: style.accent }}>
                        R$ {Number(p.discount_price || p.price).toFixed(2)}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
