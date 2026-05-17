import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import { ShoppingCart, Heart, Share2, ChevronLeft, Package, Plus, Minus, Check, Flame, Tag } from "lucide-react";
import { cn } from "../../../lib/utils";
import { useStore } from "../StoreLayout";

export default function StoreProduct() {
  const { slug, productId } = useParams();
  const { products, categories, addToCart, style, openCart } = useStore();

  const product = products.find(p => p.id === Number(productId));
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    if (!product?.variations) return {};
    return Object.fromEntries(product.variations.map(v => [v.name, v.options[0]?.value ?? ""]));
  });
  const [qty, setQty] = useState(1);
  const [inWishlist, setInWishlist] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20 text-center">
        <Package size={48} strokeWidth={1} className="mx-auto mb-4 text-slate-200" />
        <p className="text-sm font-black uppercase text-slate-700">Produto não encontrado</p>
        <Link to={`/s/${slug}/catalogo`} className="mt-4 inline-block text-xs font-bold text-blue-600 hover:underline">
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

  const handleAddToCart = () => {
    const hasVariations = Array.isArray(product.variations) && product.variations.length > 0;
    for (let i = 0; i < qty; i++) {
      addToCart(product, hasVariations ? selectedOptions : undefined);
    }
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
    openCart();
  };

  const selectedStocks = Array.isArray(product.variations)
    ? product.variations.map(v => {
        const opt = v.options.find(o => o.value === selectedOptions[v.name]);
        return opt?.stock ?? 0;
      })
    : [];
  const minStock = selectedStocks.length > 0 ? Math.min(...selectedStocks) : (product.stock_quantity ?? 99);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-12">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
        <Link to={`/s/${slug}`} className="hover:text-slate-700">Início</Link>
        <span>/</span>
        <Link to={`/s/${slug}/catalogo`} className="hover:text-slate-700">Catálogo</Link>
        {category && (
          <>
            <span>/</span>
            <Link to={`/s/${slug}/catalogo?cat=${category.id}`} className="hover:text-slate-700">{category.name}</Link>
          </>
        )}
        <span>/</span>
        <span className="text-slate-700 truncate max-w-[200px]">{product.name}</span>
      </nav>

      {/* Main product block */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16">

        {/* Image */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-3"
        >
          <div className={cn("aspect-square bg-slate-100 overflow-hidden relative", style.radius)}>
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
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
          </div>
        </motion.div>

        {/* Details */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col gap-5"
        >
          {/* Category + Name */}
          <div>
            {category && (
              <Link to={`/s/${slug}/catalogo?cat=${category.id}`}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest mb-2 hover:opacity-70 transition-opacity"
                style={{ color: style.accent }}>
                <Tag size={11} /> {category.name}
              </Link>
            )}
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight text-slate-900">
              {product.name}
            </h1>
          </div>

          {/* Price */}
          <div className="flex items-end gap-4">
            {product.discount_price ? (
              <>
                <span className="text-3xl font-black text-emerald-600 font-mono">
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
              <span className="text-3xl font-black font-mono" style={{ color: style.accent }}>
                R$ {Number(product.price).toFixed(2)}
              </span>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <p className="text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
              {product.description}
            </p>
          )}

          {/* Variations */}
          {Array.isArray(product.variations) && product.variations.map((v, vi) => (
            <div key={vi} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{v.name}</p>
                {selectedOptions[v.name] && (
                  <span className="text-[11px] font-bold text-slate-700">{selectedOptions[v.name]}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {v.options.map((opt, oi) => {
                  const isSelected = selectedOptions[v.name] === opt.value;
                  const outOfStock = opt.stock === 0;
                  return (
                    <button
                      key={oi}
                      disabled={outOfStock}
                      onClick={() => setSelectedOptions(prev => ({ ...prev, [v.name]: opt.value }))}
                      className={cn(
                        "relative px-4 py-2.5 rounded-xl border-2 text-xs font-bold transition-all",
                        isSelected ? "text-white shadow-md" : outOfStock
                          ? "text-slate-300 border-slate-100 bg-slate-50 cursor-not-allowed line-through"
                          : "text-slate-600 border-slate-200 hover:border-slate-400 bg-white"
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
          <div className="flex items-center gap-3 pt-2">
            {/* Qty */}
            <div className="flex items-center h-12 bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
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

            {/* Add to cart */}
            <button
              onClick={handleAddToCart}
              disabled={minStock === 0}
              style={minStock > 0 ? { backgroundColor: style.accent } : {}}
              className={cn(
                "flex-1 h-12 flex items-center justify-center gap-3 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all active:scale-95",
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

            {/* Wishlist */}
            <button
              onClick={() => setInWishlist(v => !v)}
              className={cn("w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all",
                inWishlist ? "bg-red-50 border-red-300 text-red-500" : "border-slate-200 text-slate-400 hover:border-red-300 hover:text-red-400")}
            >
              <Heart size={16} fill={inWishlist ? "currentColor" : "none"} />
            </button>
          </div>

          {/* Stock indicator */}
          {minStock > 0 && minStock <= 10 && (
            <p className="text-[11px] font-bold text-amber-600 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-amber-400 rounded-full" />
              Restam apenas {minStock} unidade{minStock !== 1 ? "s" : ""}!
            </p>
          )}

          {/* Share */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => navigator.clipboard.writeText(window.location.href)}
              className="flex items-center gap-2 text-[11px] font-bold text-slate-400 hover:text-slate-700 transition-colors"
            >
              <Share2 size={13} /> Compartilhar produto
            </button>
          </div>
        </motion.div>
      </div>

      {/* Related products */}
      {related.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div style={{ backgroundColor: style.accent }} className="w-1 h-6 rounded-full" />
            <h2 className="text-lg font-black uppercase tracking-tighter">Produtos Relacionados</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {related.map(p => (
              <Link
                key={p.id}
                to={`/s/${slug}/produto/${p.id}`}
                className={cn("group flex flex-col border hover:shadow-xl transition-all overflow-hidden", style.card, style.radius)}
              >
                <div className="aspect-square bg-slate-50 overflow-hidden">
                  {p.image_url
                    ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    : <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={32} strokeWidth={1} /></div>}
                </div>
                <div className="p-3">
                  <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">{p.name}</p>
                  <p className="text-sm font-black font-mono mt-1" style={{ color: style.accent }}>
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
