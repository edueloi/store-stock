import { useState, useEffect } from "react";
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
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Product } from "../../types";
import { cn } from "../../lib/utils";

export default function PDV() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [showCartMobile, setShowCartMobile] = useState(false);

  useEffect(() => {
    fetch("/api/products", {
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    })
    .then(res => res.json())
    .then(data => {
      setProducts(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: number) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const handleFinishSale = async () => {
    if (cart.length === 0) return;
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          items: cart,
          customerName,
          totalAmount: total
        })
      });
      if (res.ok) {
        setCart([]);
        setCustomerName("");
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (error) {
       console.error("Sale failed", error);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) && p.stock_quantity > 0
  );

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 overflow-hidden animate-in fade-in duration-500 relative">
      {/* SELECTION AREA */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder="PESQUISAR PRODUTO..." 
              className="w-full pl-10 pr-4 h-12 lg:h-10 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-[10px] font-bold uppercase tracking-widest placeholder:text-slate-300"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setShowCartMobile(true)}
            className="lg:hidden w-full sm:w-auto h-12 px-6 bg-slate-900 text-white rounded-xl flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-widest"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart size={16} />
              <span>Ver Carrinho</span>
            </div>
            <div className="bg-blue-600 px-2 py-0.5 rounded text-[10px]">
              {cart.reduce((a, b) => a + b.quantity, 0)}
            </div>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 pb-20 lg:pb-4">
          {filteredProducts.map(product => (
            <motion.button
              layout
              key={product.id}
              onClick={() => addToCart(product)}
              className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-md transition-all flex flex-col items-start group relative text-left"
            >
              <div className="w-full aspect-square bg-slate-50 rounded-xl border border-slate-100 mb-3 overflow-hidden flex items-center justify-center relative">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="object-cover w-full h-full group-hover:scale-105 transition-transform" />
                ) : (
                  <Package size={24} className="text-slate-200" />
                )}
                <div className="absolute top-2 right-2 bg-slate-900 border border-slate-700 text-white px-2 py-0.5 rounded text-[8px] font-mono font-bold tracking-tighter uppercase">
                  Estoque: {product.stock_quantity}
                </div>
              </div>
              <p className="text-[10px] font-bold text-slate-900 uppercase truncate w-full mb-1">{product.name}</p>
              <p className="text-xs font-mono font-bold text-blue-600">R$ {Number(product.price).toFixed(2)}</p>
              
              <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/5 transition-colors pointer-events-none rounded-2xl"></div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* CHECKOUT CART PANEL - Desktop */}
      <div className="hidden lg:flex w-[380px] bg-white rounded-2xl border border-slate-200 shadow-xl flex-col overflow-hidden shrink-0">
        {/* ... existing desktop cart content ... */}
        <CartContent 
          cart={cart} 
          updateQuantity={updateQuantity} 
          removeFromCart={removeFromCart}
          customerName={customerName}
          setCustomerName={setCustomerName}
          total={total}
          success={success}
          handleFinishSale={handleFinishSale}
        />
      </div>

      {/* Mobile Cart Drawer */}
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
              className="fixed inset-x-0 bottom-0 h-[85vh] bg-white rounded-t-[32px] shadow-2xl z-[151] lg:hidden flex flex-col overflow-hidden"
            >
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-4 shrink-0" />
              <div className="flex-1 overflow-hidden flex flex-col">
                <CartContent 
                  cart={cart} 
                  updateQuantity={updateQuantity} 
                  removeFromCart={removeFromCart}
                  customerName={customerName}
                  setCustomerName={setCustomerName}
                  total={total}
                  success={success}
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
  total, 
  success, 
  handleFinishSale,
  onClose
}: any) {
  return (
    <>
      <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex flex-col">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Checkout Carrinho</h3>
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">Registro de Venda Direta</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-blue-100 px-2 py-1 rounded-lg text-[10px] font-black text-blue-700 uppercase tracking-widest">
            {cart.reduce((a: any, b: any) => a + b.quantity, 0)} ITENS
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400">
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {cart.map((item: any) => (
          <motion.div 
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            key={item.id} 
            className="flex items-center gap-4 p-3 rounded-2xl border border-slate-100 bg-white shadow-sm group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black text-slate-800 uppercase truncate">{item.name}</p>
              <p className="text-[10px] font-mono font-bold text-blue-600 flex items-center gap-2 mt-1">
                 R$ {item.price.toFixed(2)} <span className="text-slate-300 font-normal">x{item.quantity}</span>
              </p>
            </div>
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-xl p-1 shrink-0">
              <button onClick={() => updateQuantity(item.id, -1)} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-slate-500 transition-all"><Minus size={12}/></button>
              <span className="w-8 text-center font-mono font-black text-xs">{item.quantity}</span>
              <button onClick={() => updateQuantity(item.id, 1)} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-slate-500 transition-all"><Plus size={12}/></button>
            </div>
            <button 
              onClick={() => removeFromCart(item.id)}
              className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
            >
              <Trash2 size={16} />
            </button>
          </motion.div>
        ))}
        {cart.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 py-20">
            <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100">
              <ShoppingCart size={48} className="opacity-10" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Sacola Vazia</p>
          </div>
        )}
      </div>

      <div className="p-6 lg:p-8 bg-slate-900 border-t border-slate-800 space-y-6">
        <div className="space-y-4">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
            <input 
              type="text" 
              placeholder="NOME DO CLIENTE..." 
              className="w-full pl-11 pr-4 h-12 bg-slate-800/50 border border-slate-700/50 rounded-xl focus:outline-none focus:border-blue-500 text-[10px] font-bold uppercase tracking-widest text-white placeholder:text-slate-600 transition-all"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          
          <div className="flex justify-between items-center text-white pt-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total à Pagar</span>
            <span className="text-3xl font-mono font-black tracking-tight">R$ {total.toFixed(2)}</span>
          </div>
        </div>

        <AnimatePresence>
          {success ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-emerald-500 text-white h-14 rounded-2xl flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20"
            >
              <CheckCircle2 size={20} /> Venda Processada
            </motion.div>
          ) : (
            <button 
              onClick={handleFinishSale}
              disabled={cart.length === 0}
              className="w-full h-14 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-20 disabled:grayscale shadow-2xl shadow-blue-500/30 active:scale-[0.98] flex items-center justify-center gap-3"
            >
              <CreditCard size={18} />
              Finalizar Venda
            </button>
          )}
        </AnimatePresence>
        
        <div className="flex justify-center gap-6 pt-2 opacity-30">
          <div className="flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-slate-400"></div>
            <span className="text-[8px] uppercase font-black text-slate-400 tracking-widest">Safe PDV</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-slate-400"></div>
            <span className="text-[8px] uppercase font-black text-slate-400 tracking-widest">Nexus-V1</span>
          </div>
        </div>
      </div>
    </>
  );
}
