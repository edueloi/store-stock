import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import { ShoppingCart, Heart, Share2, ChevronLeft, ChevronRight, Package, Plus, Minus, Check, Flame, Tag, AlertCircle } from "lucide-react";
import { cn } from "../../../lib/utils";
import { useStore } from "../StoreLayout";
import StoreSEO from "../../../components/store/StoreSEO";
import { buildStorePath, resolveStoreSlug } from "../store-routing";

export default function StoreProduct() {
  const { slug: routeSlug, productId } = useParams();
  const { products, categories, addToCart, style, openCart, tenant } = useStore();
  const slug = resolveStoreSlug(routeSlug);
  const isFashion = tenant.template_id === "atelier";
  const isTechNova = tenant.template_id === "nexus_tech";

  const product = products.find(p => p.id === Number(productId));
  const allImages = Array.isArray(product?.images) && product.images.length > 0 ? product.images : product?.image_url ? [product.image_url] : [];
  const [activeImg, setActiveImg] = useState(0);

  const hasVariations = Array.isArray(product?.variations) && product.variations.length > 0;

  // null = não escolheu ainda; só auto-seleciona se houver 1 única opção disponível
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
      <div className="max-w-7xl mx-auto px-6 py-20 text-center">
        <Package size={48} strokeWidth={1} className="mx-auto mb-4 text-slate-200" />
        <p className="text-sm font-black uppercase text-slate-700">Produto não encontrado</p>
        <Link to={buildStorePath(slug, "/catalogo")} className="mt-4 inline-block text-xs font-bold text-blue-600 hover:underline">
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

  // Verifica se todas as variações foram selecionadas
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

  // Compartilhar via WhatsApp diretamente
  const handleShareWhatsApp = () => {
    const url = window.location.href;
    const price = Number(product.discount_price || product.price).toFixed(2);
    const text = `*${product.name}*\nR$ ${price}\n${product.description ? `${product.description.slice(0, 120)}\n` : ""}Ver produto: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const productUrl = typeof window !== "undefined" ? window.location.href : "";
  const productPrice = Number(product.discount_price || product.price).toFixed(2);

  return (
    <div className={cn("max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-12", (isFashion || isTechNova) && "space-y-10")}>
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
      <nav className={cn("flex items-center gap-2 text-[10px] font-bold uppercase", isFashion ? "tracking-[0.24em] text-[#9c7b72]" : isTechNova ? "tracking-[0.22em] text-[#7c96b8]" : "text-slate-400 tracking-wider")}>
        <Link to={buildStorePath(slug)} className="hover:text-slate-700">Início</Link>
        <span>/</span>
        <Link to={buildStorePath(slug, "/catalogo")} className="hover:text-slate-700">Catálogo</Link>
        {category && (
          <>
            <span>/</span>
            <Link to={buildStorePath(slug, `/catalogo?cat=${category.id}`)} className="hover:text-slate-700">{category.name}</Link>
          </>
        )}
        <span>/</span>
        <span className="text-slate-700 truncate max-w-[200px]">{product.name}</span>
      </nav>

      {/* Main product block */}
      <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16", (isFashion || isTechNova) && "items-start")}>

        {/* Image gallery */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
          <div className={cn("overflow-hidden relative group", isFashion ? "aspect-[4/5] bg-[#f8efe8] fashion-panel border border-[#ead9ce]" : isTechNova ? "aspect-square tech-panel tech-grid bg-[linear-gradient(180deg,#f8fbff_0%,#edf4ff_100%)] border border-[#dbe6ff]" : "aspect-square bg-slate-100", style.radius)}>
            {allImages.length > 0 ? (
              <img src={allImages[activeImg]} alt={product.name} className="w-full h-full object-cover transition-all duration-300" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-200">
                <Package size={80} strokeWidth={1} />
              </div>
            )}
            {discountPct > 0 && (
              <span className="absolute top-4 left-4 bg-red-500 text-white text-xs font-black px-3 py-1 rounded-full shadow-lg">
                -{discountPct}% OFF
              </span>
            )}
            {product.is_featured && (
              <span className="absolute top-4 right-4 bg-amber-400 text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg">
                <Flame size={11} /> Destaque
              </span>
            )}
            {allImages.length > 1 && (
              <>
                <button onClick={() => setActiveImg(i => (i - 1 + allImages.length) % allImages.length)}
                  className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white", isFashion ? "border border-[#ead9ce]" : isTechNova && "border border-[#dbe6ff]")}
                >
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => setActiveImg(i => (i + 1) % allImages.length)}
                  className={cn("absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white", isFashion ? "border border-[#ead9ce]" : isTechNova && "border border-[#dbe6ff]")}
                >
                  <ChevronRight size={16} />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {allImages.map((_, i) => (
                    <button key={i} onClick={() => setActiveImg(i)} className={cn("w-1.5 h-1.5 rounded-full transition-all", i === activeImg ? "bg-white w-4" : "bg-white/50")} />
                  ))}
                </div>
              </>
            )}
          </div>
          {allImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {allImages.map((img, i) => (
                <button key={i} onClick={() => setActiveImg(i)}
                  className={cn("w-16 h-16 shrink-0 overflow-hidden border-2 transition-all",
                    isTechNova ? "rounded-[1rem]" : "rounded-xl",
                    i === activeImg ? "border-current shadow-md scale-105" : "border-slate-200 hover:border-slate-300")}
                  style={i === activeImg ? { borderColor: style.accent } : {}}>
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
          className={cn("flex flex-col gap-5", isFashion ? "fashion-panel rounded-[2rem] border border-[#ead9ce] bg-white/78 p-5 sm:p-6 md:p-8" : isTechNova ? "tech-panel rounded-[2rem] border border-[#dbe6ff] bg-white/82 p-5 sm:p-6 md:p-8" : "")}
        >
          {/* Category + Name */}
          <div>
            {category && (
              <Link to={buildStorePath(slug, `/catalogo?cat=${category.id}`)}
                className={cn("flex items-center gap-1.5 mb-2 hover:opacity-70 transition-opacity", isFashion ? "text-[10px] font-semibold uppercase tracking-[0.24em]" : isTechNova ? "store-kicker text-[10px] font-semibold" : "text-[10px] font-black uppercase tracking-widest")}
                style={{ color: style.accent }}>
                <Tag size={11} /> {category.name}
              </Link>
            )}
            {isTechNova && (
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-[#dbe6ff] bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5d789a]">
                  Visual premium
                </span>
                <span className="rounded-full border border-[#dbe6ff] bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5d789a]">
                  Compra rápida
                </span>
                <span className="rounded-full border border-[#dbe6ff] bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5d789a]">
                  Estoque consultável
                </span>
              </div>
            )}
            <h1 className={cn(isFashion ? "store-display text-[2.85rem] sm:text-5xl md:text-6xl leading-[0.9] text-[#2d221f]" : isTechNova ? "store-display text-[2.6rem] sm:text-5xl md:text-6xl leading-[0.92] text-[#071426]" : "text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight text-slate-900")}>
              {product.name}
            </h1>
            {/* SKU */}
            {product.sku && (
              <p className="text-[10px] font-mono text-slate-400 mt-1 uppercase tracking-widest">
                Cód: <span className="text-slate-600 font-bold">{product.sku}</span>
              </p>
            )}
          </div>

          {/* Price */}
          <div className={cn("flex items-end gap-4", isFashion ? "pb-2 border-b border-[#eee2d6]" : isTechNova ? "pb-3 border-b border-[#dbe6ff]" : "")}>
            {product.discount_price ? (
              <>
                <span className={cn(isFashion ? "store-display text-[3.1rem] sm:text-5xl md:text-6xl leading-none text-[#2d221f]" : isTechNova ? "store-display text-[3rem] sm:text-5xl md:text-6xl leading-none text-[#071426]" : "text-3xl font-black text-emerald-600 font-mono")}>
                  R$ {Number(product.discount_price).toFixed(2)}
                </span>
                <div className="flex flex-col pb-1">
                  <span className="text-sm text-slate-400 line-through font-mono">
                    R$ {Number(product.price).toFixed(2)}
                  </span>
                  <span className="text-[10px] font-black text-red-500 uppercase">
                    Economia de R$ {(Number(product.price) - Number(product.discount_price)).toFixed(2)}
                  </span>
                </div>
              </>
            ) : (
              <span className={cn(isFashion ? "store-display text-[3.1rem] sm:text-5xl md:text-6xl leading-none" : isTechNova ? "store-display text-[3rem] sm:text-5xl md:text-6xl leading-none" : "text-3xl font-black font-mono")} style={{ color: style.accent }}>
                R$ {Number(product.price).toFixed(2)}
              </span>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <p className={cn(isFashion ? "text-base text-[#6b5149] leading-relaxed pt-2" : isTechNova ? "text-sm md:text-base text-[#5d789a] leading-relaxed pt-2" : "text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4")}>
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
                  {showVariationError && !selectedOptions[v.name] && (
                    <AlertCircle size={11} className="text-red-500" />
                  )}
                </p>
                {selectedOptions[v.name] && (
                  <span className="text-[11px] font-bold text-slate-700">{selectedOptions[v.name]}</span>
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
                        isSelected ? "text-white shadow-md" : outOfStock
                          ? "text-slate-300 border-slate-100 bg-slate-50 cursor-not-allowed line-through"
                          : isFashion ? "text-[#6b5149] border-[#ead9ce] hover:border-[#c7978d] bg-white" : isTechNova ? "text-[#4f6d92] border-[#dbe6ff] hover:border-[#bfd2ff] bg-white" : "text-slate-600 border-slate-200 hover:border-slate-400 bg-white"
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
            <div className={cn("flex items-center h-12 overflow-hidden border w-full sm:w-auto justify-between sm:justify-normal", isFashion ? "bg-[#f8efe8] rounded-full border-[#ead9ce]" : isTechNova ? "bg-[#f5f9ff] rounded-full border-[#dbe6ff]" : "bg-slate-100 rounded-xl border-slate-200")}>
              <button
                onClick={() => setQty(q => Math.max(1, q - 1))}
                className="w-12 h-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-all"
              >
                <Minus size={14} />
              </button>
              <span className="w-10 text-center font-black text-sm">{qty}</span>
              <button
                onClick={() => setQty(q => Math.min(minStock, q + 1))}
                className="w-12 h-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-all"
              >
                <Plus size={14} />
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={minStock === 0}
              style={minStock > 0 ? { backgroundColor: style.accent } : {}}
              className={cn(
                isFashion
                  ? "flex-1 min-w-[220px] sm:min-w-0 h-12 flex items-center justify-center gap-3 text-white font-semibold text-[11px] uppercase tracking-[0.16em] sm:tracking-[0.24em] rounded-full shadow-lg transition-all active:scale-95"
                  : isTechNova
                    ? "flex-1 min-w-[220px] sm:min-w-0 h-12 flex items-center justify-center gap-3 text-white font-semibold text-[11px] uppercase tracking-[0.16em] rounded-full shadow-[0_20px_38px_rgba(37,99,235,0.24)] transition-all active:scale-95"
                  : "flex-1 h-12 flex items-center justify-center gap-3 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all active:scale-95",
                minStock === 0 && "bg-slate-200 text-slate-400 cursor-not-allowed"
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
              className={cn(isFashion ? "w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all shrink-0" : isTechNova ? "w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all shrink-0" : "w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all",
                inWishlist ? "bg-red-50 border-red-300 text-red-500" : "border-slate-200 text-slate-400 hover:border-red-300 hover:text-red-400")}
            >
              <Heart size={16} fill={inWishlist ? "currentColor" : "none"} />
            </button>
          </div>

          {/* Stock indicator */}
          {minStock > 0 && minStock <= 10 && allVariationsSelected && (
            <p className="text-[11px] font-bold text-amber-600 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-amber-400 rounded-full" />
              Restam apenas {minStock} unidade{minStock !== 1 ? "s" : ""}!
            </p>
          )}

          {/* Share */}
          <div className={cn("flex items-center gap-3 pt-2", isFashion ? "border-t border-[#eee2d6]" : isTechNova ? "border-t border-[#dbe6ff]" : "border-t border-slate-100")}>
            <button
              onClick={handleShare}
              className={cn("flex items-center gap-2 text-[11px] font-bold transition-colors", isTechNova ? "text-[#7c96b8] hover:text-[#071426]" : "text-slate-400 hover:text-slate-700")}
            >
              <Share2 size={13} /> Compartilhar
            </button>
            <button
              onClick={handleShareWhatsApp}
              className={cn("flex items-center gap-2 text-[11px] font-bold transition-colors", isTechNova ? "text-[#7c96b8] hover:text-[#25D366]" : "text-slate-400 hover:text-[#25D366]")}
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
            <div style={{ backgroundColor: style.accent }} className="w-1 h-6 rounded-full" />
            <h2 className={cn(isFashion ? "store-display text-4xl font-semibold tracking-[-0.04em] text-[#2d221f]" : isTechNova ? "store-display text-4xl font-semibold tracking-[-0.04em] text-[#071426]" : "text-lg font-black uppercase tracking-tighter")}>Produtos Relacionados</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {related.map(p => (
              <Link
                key={p.id}
                to={buildStorePath(slug, `/produto/${p.id}`)}
                className={cn(
                  "group flex flex-col border transition-all overflow-hidden",
                  isFashion ? "fashion-soft-shadow hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(108,64,55,0.12)]" : isTechNova ? "tech-soft-shadow hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(42,94,188,0.16)]" : "hover:shadow-xl",
                  style.card,
                  style.radius
                )}
              >
                <div className={cn(isFashion ? "aspect-[4/5] bg-[#f8efe8] overflow-hidden" : isTechNova ? "aspect-square tech-grid bg-[linear-gradient(180deg,#f8fbff_0%,#edf4ff_100%)] overflow-hidden" : "aspect-square bg-slate-50 overflow-hidden")}>
                  {p.image_url
                    ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    : <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={32} strokeWidth={1} /></div>}
                </div>
                <div className={cn(isFashion ? "p-5" : isTechNova ? "p-4" : "p-3")}>
                  <p className={cn(isFashion ? "store-display text-[1.45rem] font-semibold text-[#2d221f] line-clamp-2 leading-[0.95]" : isTechNova ? "store-display text-[1.2rem] font-semibold text-[#071426] line-clamp-2 leading-[1.02]" : "text-xs font-bold text-slate-800 line-clamp-2 leading-snug")}>{p.name}</p>
                  <p className={cn(isFashion ? "store-display text-[1.7rem] font-semibold mt-3" : isTechNova ? "store-display text-[1.4rem] font-semibold mt-3" : "text-sm font-black font-mono mt-1")} style={{ color: style.accent }}>
                    R$ {Number(p.discount_price || p.price).toFixed(2)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
