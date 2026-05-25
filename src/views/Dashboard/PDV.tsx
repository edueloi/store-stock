import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  User,
  CreditCard,
  Banknote,
  Percent,
  CheckCircle2,
  Package,
  X,
  QrCode,
  Tag,
  Loader2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Product, Category } from "../../types";
import { cn } from "../../lib/utils";

type PaymentMethod = "money" | "debit" | "credit" | "pix";

type CardBrand = "visa" | "master" | "elo" | "amex" | "hiper" | "other";

interface CardBrandInfo {
  key: CardBrand;
  label: string;
  color: string;
}

const CARD_BRANDS: CardBrandInfo[] = [
  { key: "visa",   label: "Visa",       color: "#1A1F71" },
  { key: "master", label: "Mastercard", color: "#EB001B" },
  { key: "elo",    label: "Elo",        color: "#00A4E0" },
  { key: "amex",   label: "Amex",       color: "#2E77BC" },
  { key: "hiper",  label: "Hipercard",  color: "#B22222" },
  { key: "other",  label: "Outra",      color: "#64748b" },
];

interface CartItem extends Product {
  price: number;
  quantity: number;
  cartItemId: string;
  variationLabel: string;
  selectedOptions?: Record<string, string>;
}

export default function PDV() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("money");
  const [discount, setDiscount] = useState("");
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showCartMobile, setShowCartMobile] = useState(false);
  const [configProduct, setConfigProduct] = useState<Product | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [cardBrand, setCardBrand] = useState<CardBrand>("visa");
  const [installments, setInstallments] = useState(1);
  // card fee rates loaded from tenant settings
  const [cardFees, setCardFees] = useState<Record<string, number[]>>({});

  const token = localStorage.getItem("token");

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch("/api/products", { headers }).then((r) => r.json()),
      fetch("/api/categories", { headers }).then((r) => r.json()),
    ]).then(([prods, cats]) => {
      setProducts(Array.isArray(prods) ? prods : []);
      setCategories(Array.isArray(cats) ? cats : []);
      setLoading(false);
    });
    // load card fee settings
    fetch("/api/tenant", { headers })
      .then((r) => r.json())
      .then((d) => {
        if (d?.card_fees) setCardFees(d.card_fees);
      })
      .catch(() => {});
  }, []);

  const addToCart = (product: Product, options?: Record<string, string>) => {
    const hasAttributes = Array.isArray(product.attributes) && product.attributes.length > 0;
    const hasLegacyVariations = !hasAttributes && Array.isArray(product.variations) && product.variations.length > 0;

    if ((hasAttributes || hasLegacyVariations) && !options) {
      setConfigProduct(product);
      const initialOptions: Record<string, string> = {};
      if (hasAttributes) {
        product.attributes!.forEach((attr) => {
          initialOptions[attr.name] = attr.values[0] ?? "";
        });
      } else {
        product.variations!.forEach((v) => {
          initialOptions[v.name] = v.options[0]?.value ?? "";
        });
      }
      setSelectedOptions(initialOptions);
      return;
    }

    const variationLabel = options
      ? Object.entries(options)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ")
      : "";
    const cartItemId = options ? `${product.id}-${variationLabel}` : `${product.id}`;

    const stockLimit = product.stock_quantity;
    const existing = cart.find((item) => item.cartItemId === cartItemId);

    if (existing) {
      if (existing.quantity >= stockLimit) return;
      setCart(cart.map((item) =>
        item.cartItemId === cartItemId ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([
        ...cart,
        {
          ...product,
          price: Number(product.price),
          quantity: 1,
          cartItemId,
          selectedOptions: options,
          variationLabel,
        },
      ]);
    }

    setConfigProduct(null);
    setSelectedOptions({});
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.cartItemId !== cartItemId) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null as unknown as CartItem;
          if (newQty > item.stock_quantity) return item;
          return { ...item, quantity: newQty };
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(cart.filter((item) => item.cartItemId !== cartItemId));
  };

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const discountValue = Math.min(Number(discount) || 0, subtotal);
  const baseTotal = subtotal - discountValue;

  // credit card fee from settings (installment index)
  const creditFeeRate = paymentMethod === "credit" && cardFees[cardBrand]
    ? (cardFees[cardBrand][installments - 1] ?? 0)
    : 0;
  const feeAmount = paymentMethod === "credit" ? baseTotal * (creditFeeRate / 100) : 0;
  const total = baseTotal + feeAmount;
  const installmentValue = paymentMethod === "credit" && installments > 1 ? total / installments : 0;

  const handleFinishSale = async () => {
    if (cart.length === 0 || finishing) return;
    setFinishing(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: cart.map((i) => ({ id: i.id, quantity: i.quantity, price: i.price })),
          customerName,
          totalAmount: total,
          paymentMethod: paymentMethod === "credit"
            ? `crédito-${cardBrand}${installments > 1 ? `-${installments}x` : ""}`
            : paymentMethod === "debit"
            ? `débito-${cardBrand}`
            : paymentMethod,
          discount: discountValue,
        }),
      });
      if (res.ok) {
        setCart([]);
        setCustomerName("");
        setDiscount("");
        setPaymentMethod("money");
        setCardBrand("visa");
        setInstallments(1);
        setSuccess(true);
        setShowCartMobile(false);
        setTimeout(() => setSuccess(false), 3000);
        // refresh product stock
        fetch("/api/products", { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json())
          .then((data) => setProducts(Array.isArray(data) ? data : []));
      }
    } catch (e) {
      console.error("Sale failed", e);
    } finally {
      setFinishing(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.is_active) return false;
      if (p.stock_quantity <= 0) return false;
      if (selectedCategory && p.category_id !== selectedCategory) return false;
      if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [products, searchTerm, selectedCategory]);

  const cartQty = cart.reduce((a, b) => a + b.quantity, 0);

  const openExternalPDV = () => {
    window.open("/pdv", "_blank", "noopener,noreferrer");
  };

  const refreshProducts = () => {
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch("/api/products", { headers }).then((r) => r.json()),
      fetch("/api/categories", { headers }).then((r) => r.json()),
    ]).then(([prods, cats]) => {
      setProducts(Array.isArray(prods) ? prods : []);
      setCategories(Array.isArray(cats) ? cats : []);
      setLoading(false);
    });
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 overflow-hidden relative">
      {/* LEFT — PRODUCT SELECTION */}
      <div className="flex-1 flex flex-col gap-3 overflow-hidden">
        {/* Toolbar: Search + actions */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input
              type="text"
              placeholder="PESQUISAR PRODUTO..."
              className="w-full pl-9 pr-4 h-10 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[10px] font-bold uppercase tracking-widest placeholder:text-slate-300 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {/* Refresh button */}
          <button
            onClick={refreshProducts}
            title="Atualizar produtos"
            className="h-10 w-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-all shrink-0"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          {/* Open External PDV */}
          <button
            onClick={openExternalPDV}
            title="Abrir PDV em nova janela"
            className="h-10 px-3 flex items-center gap-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shrink-0 shadow-lg"
          >
            <ExternalLink size={13} />
            <span className="hidden sm:block">PDV Externo</span>
          </button>
          {/* Mobile cart */}
          <button
            onClick={() => setShowCartMobile(true)}
            className="lg:hidden relative h-10 px-3 bg-slate-900 text-white rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shrink-0"
          >
            <ShoppingCart size={14} />
            {cartQty > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full text-[9px] font-black flex items-center justify-center">
                {cartQty}
              </span>
            )}
          </button>
        </div>

        {/* Category filter */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 shrink-0 scrollbar-none">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "shrink-0 h-8 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                selectedCategory === null
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
              )}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
                className={cn(
                  "shrink-0 h-8 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-1.5",
                  selectedCategory === cat.id
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
                )}
              >
                <Tag size={10} />
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto pr-1 pb-4">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-slate-300" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-300">
              <Package size={40} strokeWidth={1} />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Nenhum produto encontrado
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {filteredProducts.map((product) => {
                const cartQtyForProduct = cart
                  .filter((i) => i.id === product.id)
                  .reduce((a, b) => a + b.quantity, 0);
                const atLimit = cartQtyForProduct >= product.stock_quantity;
                const inCart = cartQtyForProduct > 0;
                return (
                  <motion.button
                    layout
                    key={product.id}
                    onClick={() => !atLimit && addToCart(product)}
                    className={cn(
                      "bg-white p-3 rounded-2xl border shadow-sm transition-all flex flex-col items-start group relative text-left",
                      atLimit
                        ? "border-slate-100 opacity-40 cursor-not-allowed"
                        : inCart
                        ? "border-blue-400 shadow-blue-100 shadow-md ring-1 ring-blue-300/50 cursor-pointer"
                        : "border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer"
                    )}
                  >
                    {/* Stock badge top-right, cart badge top-left */}
                    <div className="w-full aspect-square bg-slate-50 rounded-xl border border-slate-100 mb-2 overflow-hidden flex items-center justify-center relative">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <Package size={24} className="text-slate-200" />
                      )}
                      <div className="absolute top-1.5 right-1.5 bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 text-white px-1.5 py-0.5 rounded-md text-[8px] font-mono font-bold">
                        {product.stock_quantity}
                      </div>
                      {inCart && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-1.5 left-1.5 bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shadow-lg shadow-blue-500/30"
                        >
                          {cartQtyForProduct}
                        </motion.div>
                      )}
                      {/* Add overlay */}
                      {!atLimit && (
                        <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/8 transition-colors flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-all bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-xl scale-75 group-hover:scale-100">
                            <Plus size={14} strokeWidth={3} />
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-slate-900 uppercase truncate w-full leading-tight mb-0.5">
                      {product.name}
                    </p>
                    {((Array.isArray(product.attributes) && product.attributes.length > 0) ||
                      (Array.isArray(product.variations) && product.variations.length > 0)) && (
                      <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-0.5">
                        Variações
                      </p>
                    )}
                    <p className="text-[11px] font-mono font-black text-blue-600">
                      R$ {Number(product.price).toFixed(2)}
                    </p>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Variation Modal */}
      <AnimatePresence>
        {configProduct && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl border border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] mb-1">
                    Configurar Produto
                  </p>
                  <h3 className="text-xs font-black uppercase text-slate-900">{configProduct.name}</h3>
                </div>
                <button
                  onClick={() => setConfigProduct(null)}
                  className="p-2 hover:bg-slate-50 rounded-full text-slate-400"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-6">
                {/* New attributes+skus system */}
                {Array.isArray(configProduct.attributes) && configProduct.attributes.length > 0
                  ? configProduct.attributes.map((attr, aIdx) => {
                      return (
                        <div key={aIdx} className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                            {attr.name}
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {attr.values.map((val, vIdx) => {
                              // Check if this combo value has stock
                              const currentOptions = { ...selectedOptions, [attr.name]: val };
                              const sku = configProduct.skus?.find(s =>
                                Object.entries(s.combo).every(([k, v]) => currentOptions[k] === v)
                              );
                              const hasStock = !sku || sku.stock > 0;
                              return (
                                <button
                                  key={vIdx}
                                  disabled={!hasStock}
                                  onClick={() => setSelectedOptions({ ...selectedOptions, [attr.name]: val })}
                                  className={cn(
                                    "px-4 h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                                    !hasStock
                                      ? "opacity-40 cursor-not-allowed line-through bg-slate-50 border-slate-100 text-slate-400"
                                      : selectedOptions[attr.name] === val
                                      ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20"
                                      : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-400"
                                  )}
                                >
                                  {val}
                                  {!hasStock && <span className="block text-[8px] normal-case font-bold">Esgotado</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  : /* Legacy variations fallback */
                    configProduct.variations?.map((variation, vIdx) => (
                      <div key={vIdx} className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                          {variation.name}
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {variation.options.map((opt, oIdx) => (
                            <button
                              key={oIdx}
                              disabled={opt.stock === 0}
                              onClick={() => setSelectedOptions({ ...selectedOptions, [variation.name]: opt.value })}
                              className={cn(
                                "px-4 h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                                opt.stock === 0
                                  ? "opacity-40 cursor-not-allowed line-through bg-slate-50 border-slate-100 text-slate-400"
                                  : selectedOptions[variation.name] === opt.value
                                  ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20"
                                  : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-400"
                              )}
                            >
                              {opt.value}
                              {opt.stock === 0 && <span className="block text-[8px] normal-case font-bold">Esgotado</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                }
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button
                  onClick={() => addToCart(configProduct, selectedOptions)}
                  className="w-full h-14 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3"
                >
                  Confirmar Escolha <Plus size={16} strokeWidth={3} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RIGHT — CART PANEL (desktop) */}
      <div className="hidden lg:flex w-[380px] bg-white rounded-2xl border border-slate-200 shadow-xl flex-col overflow-hidden shrink-0">
        <CartContent
          cart={cart}
          updateQuantity={updateQuantity}
          removeFromCart={removeFromCart}
          customerName={customerName}
          setCustomerName={setCustomerName}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          cardBrand={cardBrand}
          setCardBrand={setCardBrand}
          installments={installments}
          setInstallments={setInstallments}
          cardFees={cardFees}
          discount={discount}
          setDiscount={setDiscount}
          subtotal={subtotal}
          discountValue={discountValue}
          feeAmount={feeAmount}
          creditFeeRate={creditFeeRate}
          total={total}
          installmentValue={installmentValue}
          success={success}
          finishing={finishing}
          handleFinishSale={handleFinishSale}
        />
      </div>

      {/* MOBILE CART DRAWER */}
      <AnimatePresence>
        {showCartMobile && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCartMobile(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] lg:hidden"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-x-0 bottom-0 h-[90vh] bg-white rounded-t-[32px] shadow-2xl z-[151] lg:hidden flex flex-col overflow-hidden"
            >
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-4 shrink-0" />
              <div className="flex-1 overflow-hidden flex flex-col">
                <CartContent
                  cart={cart}
                  updateQuantity={updateQuantity}
                  removeFromCart={removeFromCart}
                  customerName={customerName}
                  setCustomerName={setCustomerName}
                  paymentMethod={paymentMethod}
                  setPaymentMethod={setPaymentMethod}
                  cardBrand={cardBrand}
                  setCardBrand={setCardBrand}
                  installments={installments}
                  setInstallments={setInstallments}
                  cardFees={cardFees}
                  discount={discount}
                  setDiscount={setDiscount}
                  subtotal={subtotal}
                  discountValue={discountValue}
                  feeAmount={feeAmount}
                  creditFeeRate={creditFeeRate}
                  total={total}
                  installmentValue={installmentValue}
                  success={success}
                  finishing={finishing}
                  handleFinishSale={handleFinishSale}
                  onClose={() => setShowCartMobile(false)}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function CartContent({
  cart,
  updateQuantity,
  removeFromCart,
  customerName,
  setCustomerName,
  paymentMethod,
  setPaymentMethod,
  cardBrand,
  setCardBrand,
  installments,
  setInstallments,
  cardFees,
  discount,
  setDiscount,
  subtotal,
  discountValue,
  feeAmount,
  creditFeeRate,
  total,
  installmentValue,
  success,
  finishing,
  handleFinishSale,
  onClose,
}: {
  cart: CartItem[];
  updateQuantity: (id: string, delta: number) => void;
  removeFromCart: (id: string) => void;
  customerName: string;
  setCustomerName: (v: string) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (v: PaymentMethod) => void;
  cardBrand: CardBrand;
  setCardBrand: (v: CardBrand) => void;
  installments: number;
  setInstallments: (v: number) => void;
  cardFees: Record<string, number[]>;
  discount: string;
  setDiscount: (v: string) => void;
  subtotal: number;
  discountValue: number;
  feeAmount: number;
  creditFeeRate: number;
  total: number;
  installmentValue: number;
  success: boolean;
  finishing: boolean;
  handleFinishSale: () => void;
  onClose?: () => void;
}) {
  const totalQty = cart.reduce((a, b) => a + b.quantity, 0);

  return (
    <>
      {/* Header */}
      <div className="px-5 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
        <div className="flex flex-col">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
            <ShoppingCart size={13} className="text-blue-600" />
            Carrinho PDV
          </h3>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
            Venda no Balcão
          </span>
        </div>
        <div className="flex items-center gap-2">
          {totalQty > 0 && (
            <div className="bg-blue-600 px-2.5 py-1 rounded-lg text-[9px] font-black text-white uppercase tracking-widest shadow-sm shadow-blue-300">
              {totalQty} {totalQty === 1 ? "ITEM" : "ITENS"}
            </div>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence initial={false}>
          {cart.map((item) => (
            <motion.div
              key={item.cartItemId}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-slate-800 uppercase truncate leading-tight">
                    {item.name}
                  </p>
                  {item.variationLabel && (
                    <p className="text-[8px] font-bold text-blue-500 uppercase tracking-widest mt-0.5">
                      {item.variationLabel}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-[9px] font-mono text-slate-400">
                      R$ {item.price.toFixed(2)} × {item.quantity}
                    </p>
                    <p className="text-[11px] font-mono font-black text-slate-900">
                      R$ {(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg p-0.5">
                    <button
                      onClick={() => updateQuantity(item.cartItemId, -1)}
                      className="p-1 hover:bg-slate-50 rounded text-slate-500 transition-all"
                    >
                      <Minus size={10} />
                    </button>
                    <span className="w-5 text-center font-mono font-black text-[11px] text-slate-800">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.cartItemId, 1)}
                      disabled={item.quantity >= item.stock_quantity}
                      className="p-1 hover:bg-slate-50 rounded text-slate-500 transition-all disabled:opacity-30"
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.cartItemId)}
                    className="p-1 text-slate-300 hover:text-red-500 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {cart.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-3 py-16">
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
              <ShoppingCart size={32} className="opacity-20" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Carrinho Vazio
            </p>
          </div>
        )}
      </div>

      {/* Checkout panel */}
      <div className="shrink-0 bg-slate-900 border-t border-slate-800 space-y-4 p-5">
        {/* Customer */}
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
          <input
            type="text"
            placeholder="NOME DO CLIENTE (OPCIONAL)..."
            className="w-full pl-9 pr-4 h-10 bg-slate-800/50 border border-slate-700/50 rounded-xl focus:outline-none focus:border-blue-500 text-[10px] font-bold uppercase tracking-widest text-white placeholder:text-slate-600 transition-all"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </div>

        {/* Payment method — 4 buttons */}
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { key: "money",  label: "Dinheiro", Icon: Banknote },
              { key: "debit",  label: "Débito",   Icon: CreditCard },
              { key: "credit", label: "Crédito",  Icon: CreditCard },
              { key: "pix",    label: "PIX",      Icon: QrCode },
            ] as { key: PaymentMethod; label: string; Icon: React.ElementType }[]
          ).map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => { setPaymentMethod(key); setInstallments(1); }}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 h-14 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all",
                paymentMethod === key
                  ? key === "credit"
                    ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                    : "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "bg-slate-800/50 border-slate-700/50 text-slate-500 hover:border-slate-500"
              )}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* Card brand selector (debit or credit) */}
        {(paymentMethod === "debit" || paymentMethod === "credit") && (
          <div className="space-y-2">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] px-0.5">Bandeira</p>
            <div className="grid grid-cols-3 gap-1.5">
              {CARD_BRANDS.map(({ key, label, color }) => (
                <button
                  key={key}
                  onClick={() => setCardBrand(key)}
                  className={cn(
                    "h-9 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1",
                    cardBrand === key
                      ? "border-transparent text-white shadow-md"
                      : "bg-slate-800/40 border-slate-700/50 text-slate-500 hover:border-slate-500"
                  )}
                  style={cardBrand === key ? { backgroundColor: color, borderColor: color } : {}}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Installments (credit only) */}
        {paymentMethod === "credit" && (
          <div className="space-y-2">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] px-0.5">Parcelamento</p>
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => {
                const rate = cardFees[cardBrand]?.[n - 1] ?? 0;
                return (
                  <button
                    key={n}
                    onClick={() => setInstallments(n)}
                    className={cn(
                      "h-10 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center",
                      installments === n
                        ? "bg-emerald-600 border-emerald-500 text-white shadow-md"
                        : "bg-slate-800/40 border-slate-700/50 text-slate-500 hover:border-slate-500"
                    )}
                  >
                    <span>{n === 1 ? "À vista" : `${n}×`}</span>
                    {rate > 0 && (
                      <span className={cn("text-[7px] font-bold", installments === n ? "text-emerald-200" : "text-slate-600")}>
                        +{rate}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Discount */}
        <div className="relative">
          <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
          <input
            type="number"
            min="0"
            placeholder="DESCONTO (R$)..."
            className="w-full pl-9 pr-4 h-10 bg-slate-800/50 border border-slate-700/50 rounded-xl focus:outline-none focus:border-blue-500 text-[10px] font-bold uppercase tracking-widest text-white placeholder:text-slate-600 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </div>

        {/* Totals */}
        <div className="space-y-1.5 pt-1">
          {discountValue > 0 && (
            <>
              <div className="flex justify-between text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                <span>Subtotal</span>
                <span className="font-mono">R$ {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
                <span>Desconto</span>
                <span className="font-mono">− R$ {discountValue.toFixed(2)}</span>
              </div>
            </>
          )}
          {feeAmount > 0 && (
            <div className="flex justify-between text-amber-400 text-[10px] font-bold uppercase tracking-widest">
              <span>Taxa ({creditFeeRate}%)</span>
              <span className="font-mono">+ R$ {feeAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-white">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Total
            </span>
            <span className="text-2xl font-mono font-black tracking-tight">
              R$ {total.toFixed(2)}
            </span>
          </div>
          {installmentValue > 0 && (
            <div className="flex justify-between text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
              <span>{installments}× de</span>
              <span className="font-mono">R$ {installmentValue.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Finish button */}
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-emerald-500 text-white h-14 rounded-2xl flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20"
            >
              <CheckCircle2 size={20} /> Venda Registrada!
            </motion.div>
          ) : (
            <motion.button
              key="btn"
              onClick={handleFinishSale}
              disabled={cart.length === 0 || finishing}
              className="w-full h-14 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-20 disabled:grayscale shadow-2xl shadow-blue-500/30 active:scale-[0.98] flex items-center justify-center gap-3"
            >
              {finishing ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <CreditCard size={18} />
                  Finalizar Venda
                </>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
