import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ShoppingCart, Heart, Share2, ChevronLeft, ChevronRight,
  Package, Plus, Minus, Check, Flame, Tag, AlertCircle,
  Shield, Truck, Star, Sparkles,
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
  const [imgDirection, setImgDirection] = useState(0);

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

  // ── Not found ─────────────────────────────────────────────────────────────
  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-28 text-center">
        <div className="tech-pulse w-20 h-20 rounded-[1.8rem] border border-[#dbe6ff] bg-[#f4f8ff] flex items-center justify-center mx-auto mb-6">
          <Package size={36} strokeWidth={1} className="text-[#b0c4de]" />
        </div>
        <p className="store-display text-3xl font-semibold text-[#071426] mb-2">Produto não encontrado</p>
        <p className="text-[13px] text-[#6a85a8] mb-6">Este produto pode ter sido removido ou o link está desatualizado.</p>
        <Link
          to={buildStorePath(slug, "/catalogo")}
          style={{ backgroundColor: style.accent }}
          className="inline-flex items-center gap-2 px-7 h-11 rounded-full text-white text-[11px] font-semibold uppercase tracking-[0.18em] shadow-[0_12px_28px_rgba(37,99,235,0.26)]"
        >
          <ChevronLeft size={13} /> Voltar ao catálogo
        </Link>
      </div>
    );
  }

  // ── Computed ──────────────────────────────────────────────────────────────
  const category = categories.find(c => c.id === product.category_id);
  const discountPct = product.discount_price
    ? Math.round((1 - Number(product.discount_price) / Number(product.price)) * 100)
    : 0;
  const related = products
    .filter(p => p.is_active && p.category_id === product.category_id && p.id !== product.id)
    .slice(0, 4);

  const allVariationsSelected = !hasVariations || normalizedVariations.every(v => !!selectedOptions[v.name]);

  const selectedStocks = normalizedVariations.map(v => {
    const opt = v.options.find(o => o.value === selectedOptions[v.name]);
    return opt?.stock ?? 0;
  });
  const minStock = selectedStocks.length > 0
    ? (allVariationsSelected ? Math.min(...selectedStocks) : 99)
    : (product.stock_quantity ?? 99);

  // ── Handlers ──────────────────────────────────────────────────────────────
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
    setTimeout(() => setJustAdded(false), 2200);
    openCart();
  };

  const handleSelectOption = (variationName: string, value: string) => {
    setSelectedOptions(prev => ({ ...prev, [variationName]: value }));
    setShowVariationError(false);
  };

  const navigateImg = (dir: number) => {
    setImgDirection(dir);
    setActiveImg(i => (i + dir + allImages.length) % allImages.length);
  };

  const handleShare = async () => {
    const url = window.location.href;
    const title = product.name;
    const text = `${product.name}${product.description ? ` — ${product.description.slice(0, 100)}` : ""}\nR$ ${Number(product.discount_price || product.price).toFixed(2)}`;
    if (navigator.share) {
      try { await navigator.share({ title, text, url }); return; } catch { /* fall through */ }
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
    <div className="min-h-screen bg-[linear-gradient(160deg,#f8fbff_0%,#fafcff_60%,#f4f8ff_100%)]">
      <StoreSEO
        title={`${product.name} — ${tenant.name}`}
        description={product.description || `Compre ${product.name} na ${tenant.name}. R$ ${productPrice}. Atendimento via WhatsApp.`}
        image={allImages[0]}
        url={productUrl}
        type="product"
        price={productPrice}
        siteName={tenant.name}
        keywords={`${product.name}, ${category?.name || ""}, ${tenant.name}, comprar, preço`}
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

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-12">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8baed0]">
          <Link to={buildStorePath(slug)} className="hover:text-[#071426] transition-colors">Início</Link>
          <ChevronRight size={10} />
          <Link to={buildStorePath(slug, "/catalogo")} className="hover:text-[#071426] transition-colors">Catálogo</Link>
          {category && (
            <>
              <ChevronRight size={10} />
              <Link to={buildStorePath(slug, `/catalogo?cat=${category.id}`)} className="hover:text-[#071426] transition-colors">{category.name}</Link>
            </>
          )}
          <ChevronRight size={10} />
          <span className="truncate max-w-[180px] text-[#071426]">{product.name}</span>
        </nav>

        {/* ═══════════════════════════════════════════════════════════════════
            MAIN PRODUCT
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-14 items-start">

          {/* ── Gallery ────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-3 sticky top-6"
          >
            {/* Main image */}
            <div className={cn(
              "relative overflow-hidden group aspect-square tech-panel tech-grid border border-[#dbe6ff] bg-[linear-gradient(160deg,#f4f8ff_0%,#edf4ff_100%)] shadow-[0_4px_40px_rgba(37,99,235,0.08)]",
              style.radius
            )}>
              <AnimatePresence mode="wait">
                {allImages.length > 0 ? (
                  <motion.img
                    key={activeImg}
                    src={allImages[activeImg]}
                    alt={product.name}
                    initial={{ opacity: 0, scale: 1.03 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.25 }}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package size={80} strokeWidth={1} className="text-[#c5d8f5]" />
                  </div>
                )}
              </AnimatePresence>

              {/* Overlaid badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {discountPct > 0 && (
                  <span className="text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-lg bg-gradient-to-r from-[#ef4444] to-[#f97316]">
                    -{discountPct}% OFF
                  </span>
                )}
                {product.is_featured && (
                  <span className="text-white text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg bg-gradient-to-r from-[#f59e0b] to-[#f97316]">
                    <Flame size={10} /> Destaque
                  </span>
                )}
              </div>

              {/* Nav arrows */}
              {allImages.length > 1 && (
                <>
                  <button
                    onClick={() => navigateImg(-1)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all bg-white/90 hover:bg-white border border-[#dbe6ff] text-[#4e6c8e]"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => navigateImg(1)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all bg-white/90 hover:bg-white border border-[#dbe6ff] text-[#4e6c8e]"
                  >
                    <ChevronRight size={16} />
                  </button>
                  {/* Dot indicators */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {allImages.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveImg(i)}
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-300",
                          i === activeImg ? "w-5 bg-white shadow" : "w-1.5 bg-white/45"
                        )}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {allImages.length > 1 && (
              <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                {allImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={cn(
                      "w-16 h-16 sm:w-[72px] sm:h-[72px] shrink-0 overflow-hidden rounded-[1.1rem] border-2 transition-all",
                      i === activeImg
                        ? "shadow-[0_4px_16px_rgba(37,99,235,0.22)] scale-105"
                        : "border-[#dbe6ff] hover:border-[#b3caff] opacity-70 hover:opacity-100"
                    )}
                    style={i === activeImg ? { borderColor: style.accent } : {}}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* ── Details panel ──────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="tech-panel rounded-[2.2rem] border border-[#dbe6ff] bg-white/92 p-6 sm:p-8 md:p-10 shadow-[0_4px_40px_rgba(37,99,235,0.08)] space-y-6">

              {/* Category + name */}
              <div>
                {category && (
                  <Link
                    to={buildStorePath(slug, `/catalogo?cat=${category.id}`)}
                    className="inline-flex items-center gap-1.5 mb-3 store-kicker text-[10px] font-semibold hover:opacity-70 transition-opacity"
                    style={{ color: style.accent }}
                  >
                    <Tag size={10} /> {category.name}
                  </Link>
                )}

                {/* Feature badges */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dbe6ff] bg-white px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#5b7898]">
                    <Shield size={9} /> Compra segura
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dbe6ff] bg-white px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#5b7898]">
                    <Truck size={9} /> Entrega rápida
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dbe6ff] bg-white px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#5b7898]">
                    <Sparkles size={9} /> Premium
                  </span>
                </div>

                <h1 className="store-display text-[2.8rem] sm:text-5xl md:text-[3.5rem] leading-[0.9] text-[#071426]">
                  {product.name}
                </h1>
                {product.sku && (
                  <p className="text-[10px] font-mono mt-2 uppercase tracking-widest text-[#9ab3cc]">
                    Cód: <span className="font-bold text-[#6a85a8]">{product.sku}</span>
                  </p>
                )}
              </div>

              {/* Price */}
              <div className="pb-5 border-b border-[#e2ecff]">
                {product.discount_price ? (
                  <div className="flex items-end gap-4">
                    <span className="store-display text-[3.2rem] sm:text-5xl leading-none text-[#071426]">
                      R$ {Number(product.discount_price).toFixed(2)}
                    </span>
                    <div className="flex flex-col pb-1 gap-0.5">
                      <span className="text-sm line-through font-mono text-[#b0c4de]">
                        R$ {Number(product.price).toFixed(2)}
                      </span>
                      <span className="text-[10px] font-bold uppercase text-red-500 flex items-center gap-1">
                        Economia R$ {(Number(product.price) - Number(product.discount_price)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="store-display text-[3.2rem] sm:text-5xl leading-none" style={{ color: style.accent }}>
                    R$ {Number(product.price).toFixed(2)}
                  </span>
                )}
              </div>

              {/* Description */}
              {product.description && (
                <p className="text-[14px] md:text-[15px] text-[#4e6c8e] leading-relaxed">
                  {product.description}
                </p>
              )}

              {/* Variations */}
              {normalizedVariations.map((v, vi) => (
                <div key={vi} className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className={cn(
                      "text-[10px] font-bold uppercase tracking-[0.22em] flex items-center gap-1.5",
                      showVariationError && !selectedOptions[v.name] ? "text-red-500" : "text-[#8baed0]"
                    )}>
                      {v.name}
                      {showVariationError && !selectedOptions[v.name] && (
                        <AlertCircle size={11} className="text-red-500" />
                      )}
                    </p>
                    {selectedOptions[v.name] && (
                      <span className="text-[11px] font-semibold text-[#071426]">{selectedOptions[v.name]}</span>
                    )}
                  </div>
                  <AnimatePresence>
                    {showVariationError && !selectedOptions[v.name] && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="text-[10px] text-red-500 font-semibold"
                      >
                        Selecione {v.name.toLowerCase()} antes de adicionar ao carrinho
                      </motion.p>
                    )}
                  </AnimatePresence>
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
                            "relative px-4 py-2.5 rounded-[1rem] border-2 text-[11px] font-semibold transition-all",
                            isSelected
                              ? "text-white shadow-[0_8px_20px_rgba(37,99,235,0.24)] scale-105"
                              : outOfStock
                                ? "text-[#c5d8f5] border-[#edf4ff] bg-[#f8fbff] cursor-not-allowed line-through"
                                : "text-[#4e6c8e] border-[#dbe6ff] hover:border-[#b3caff] bg-white hover:shadow-sm"
                          )}
                          style={isSelected ? { backgroundColor: style.accent, borderColor: style.accent } : {}}
                        >
                          {opt.value}
                          {opt.stock > 0 && opt.stock <= 5 && !outOfStock && (
                            <span className="block text-[8px] font-bold mt-0.5 opacity-70">Só {opt.stock}!</span>
                          )}
                          {outOfStock && (
                            <span className="block text-[8px] font-bold mt-0.5 text-red-400">Esgotado</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Low stock warning */}
              <AnimatePresence>
                {minStock > 0 && minStock <= 10 && allVariationsSelected && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-[1.2rem] bg-amber-50 border border-amber-200"
                  >
                    <span className="w-2 h-2 bg-amber-400 rounded-full tech-pulse" />
                    <p className="text-[11px] font-semibold text-amber-700">
                      Restam apenas {minStock} unidade{minStock !== 1 ? "s" : ""} em estoque!
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Quantity + Add to cart */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Qty control */}
                <div className="flex items-center h-12 overflow-hidden border border-[#dbe6ff] bg-[#f4f8ff] rounded-full shadow-[0_2px_10px_rgba(37,99,235,0.07)]">
                  <button
                    onClick={() => setQty(q => Math.max(1, q - 1))}
                    className="w-12 h-full flex items-center justify-center text-[#4e6c8e] hover:text-[#071426] hover:bg-white/60 transition-all"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-10 text-center font-bold text-[13px] text-[#071426]">{qty}</span>
                  <button
                    onClick={() => setQty(q => Math.min(minStock, q + 1))}
                    className="w-12 h-full flex items-center justify-center text-[#4e6c8e] hover:text-[#071426] hover:bg-white/60 transition-all"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Add to cart */}
                <button
                  onClick={handleAddToCart}
                  disabled={minStock === 0}
                  style={minStock > 0 ? { backgroundColor: style.accent } : {}}
                  className={cn(
                    "flex-1 min-w-[200px] sm:min-w-0 h-12 flex items-center justify-center gap-2.5 text-white font-semibold text-[11px] uppercase tracking-[0.18em] rounded-full transition-all active:scale-95",
                    minStock > 0
                      ? "shadow-[0_14px_34px_rgba(37,99,235,0.28)] hover:shadow-[0_18px_42px_rgba(37,99,235,0.38)] hover:-translate-y-0.5"
                      : "bg-[#e2ecff] text-[#9ab3cc] cursor-not-allowed !shadow-none"
                  )}
                >
                  <AnimatePresence mode="wait">
                    {justAdded ? (
                      <motion.span
                        key="added"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2"
                      >
                        <Check size={15} strokeWidth={2.5} /> Adicionado!
                      </motion.span>
                    ) : minStock === 0 ? (
                      <motion.span key="unavail" className="flex items-center gap-2">
                        Indisponível
                      </motion.span>
                    ) : (
                      <motion.span
                        key="add"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2"
                      >
                        <ShoppingCart size={15} /> Adicionar ao Carrinho
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>

                {/* Wishlist */}
                <button
                  onClick={() => setInWishlist(v => !v)}
                  className={cn(
                    "w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
                    inWishlist
                      ? "bg-red-50 border-red-300 text-red-500 shadow-[0_4px_16px_rgba(239,68,68,0.18)]"
                      : "border-[#dbe6ff] text-[#8baed0] hover:border-red-300 hover:text-red-400"
                  )}
                >
                  <Heart size={16} fill={inWishlist ? "currentColor" : "none"} />
                </button>
              </div>

              {/* Trust row */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                {[
                  { icon: <Shield size={13} />, label: "Compra segura" },
                  { icon: <Truck size={13} />, label: "Entrega ágil" },
                  { icon: <Star size={13} />, label: "Qualidade garantida" },
                ].map((item, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5 p-3 rounded-[1.1rem] border border-[#e2ecff] bg-white/60 text-center">
                    <span style={{ color: style.accent }}>{item.icon}</span>
                    <p className="text-[9px] font-semibold text-[#6a85a8] leading-tight">{item.label}</p>
                  </div>
                ))}
              </div>

              {/* Share */}
              <div className="flex items-center gap-4 pt-2 border-t border-[#e2ecff]">
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 text-[11px] font-semibold text-[#8baed0] hover:text-[#071426] transition-colors"
                >
                  <Share2 size={13} /> Compartilhar
                </button>
                <button
                  onClick={handleShareWhatsApp}
                  className="flex items-center gap-2 text-[11px] font-semibold text-[#8baed0] hover:text-[#25D366] transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Enviar no WhatsApp
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            RELATED PRODUCTS
        ═══════════════════════════════════════════════════════════════════ */}
        {related.length > 0 && (
          <section>
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="store-kicker text-[10px] font-semibold text-[#7b9ac0] mb-2">Da mesma linha</p>
                <h2 className="store-display text-[2.4rem] md:text-5xl font-semibold tracking-[-0.04em] text-[#071426] leading-[0.92]">
                  Produtos Relacionados
                </h2>
              </div>
              <Link
                to={buildStorePath(slug, `/catalogo${category ? `?cat=${category.id}` : ""}`)}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#d7e4ff] bg-white/80 px-5 py-2.5 text-[10px] font-semibold tracking-[0.16em] uppercase text-[#4d6990] hover:text-[#071426] hover:border-[#b3caff] hover:bg-white transition-all"
              >
                Ver todos <ChevronRight size={12} />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
              {related.map((p, i) => {
                const img = (Array.isArray(p.images) && (p.images as string[])[0]) || p.image_url || null;
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="h-full"
                  >
                    <Link
                      to={buildStorePath(slug, `/produto/${p.id}`)}
                      className={cn(
                        "group flex flex-col h-full border overflow-hidden transition-all duration-300 tech-panel tech-card-sheen bg-white/90 hover:-translate-y-1.5 hover:shadow-[0_24px_60px_rgba(37,99,235,0.15)]",
                        style.card,
                        style.radius
                      )}
                    >
                      <div className="overflow-hidden aspect-square tech-grid bg-[linear-gradient(160deg,#f4f8ff_0%,#edf4ff_100%)]">
                        {img
                          ? <img src={img} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          : <div className="w-full h-full flex items-center justify-center"><Package size={32} strokeWidth={1} className="text-[#c5d8f5]" /></div>
                        }
                      </div>
                      <div className="p-4 flex flex-col gap-2">
                        <p className="store-display text-[1.1rem] sm:text-[1.25rem] font-semibold text-[#071426] line-clamp-2 leading-[1.02] group-hover:text-[#1d4ed8] transition-colors">
                          {p.name}
                        </p>
                        <p className="store-display text-[1.3rem] sm:text-[1.5rem] font-semibold mt-auto" style={{ color: style.accent }}>
                          R$ {Number(p.discount_price || p.price).toFixed(2)}
                        </p>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
