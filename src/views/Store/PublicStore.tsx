import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Minus, 
  X, 
  MessageCircle,
  Package,
  Info,
  ChevronRight,
  Instagram,
  Facebook,
  MapPin
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Tenant, Product, Category } from "../../types";
import { cn } from "../../lib/utils";

export default function PublicStore() {
  const { slug } = useParams();
  const [storeData, setStoreData] = useState<{ tenant: Tenant, categories: Category[], products: Product[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  
  const [configProduct, setConfigProduct] = useState<Product | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/public/store/${slug}`)
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setStoreData({
            tenant: data.tenant,
            categories: Array.isArray(data.categories) ? data.categories : [],
            products: Array.isArray(data.products) ? data.products : []
          });
        } else {
          setStoreData(null);
        }
        setLoading(false);
      });
  }, [slug]);

  const addToCart = (product: Product, options?: Record<string, string>) => {
    const hasVariations = Array.isArray(product.variations) && product.variations.length > 0;
    
    // If it has variations and none are selected yet, open config
    if (hasVariations && !options) {
      setConfigProduct(product);
      const initialOptions: Record<string, string> = {};
      product.variations!.forEach(v => {
        initialOptions[v.name] = v.options[0]?.value ?? "";
      });
      setSelectedOptions(initialOptions);
      return;
    }

    const variationLabel = options ? Object.entries(options).map(([k, v]) => `${k}: ${v}`).join(', ') : '';
    const cartItemId = options ? `${product.id}-${variationLabel}` : `${product.id}`;

    const existing = cart.find(item => item.cartItemId === cartItemId);
    if (existing) {
      setCart(cart.map(item => item.cartItemId === cartItemId ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { ...product, quantity: 1, cartItemId, selectedOptions: options, variationLabel }]);
    }
    
    // Close config if open
    setConfigProduct(null);
    setSelectedOptions({});
    setIsCartOpen(true); // Open cart to show user it was added
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.cartItemId === cartItemId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(cart.filter(item => item.cartItemId !== cartItemId));
  };

  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const handleWhatsAppCheckout = () => {
    const itemsList = cart.map(item => `*${item.quantity}x* ${item.name} - R$ ${(item.price * item.quantity).toFixed(2)}`).join('%0A');
    const message = `Olá! Gostaria de fazer um pedido:%0A%0A${itemsList}%0A%0A*Total: R$ ${total.toFixed(2)}*%0A%0AFavor confirmar disponibilidade.`;
    window.open(`https://wa.me/${storeData?.tenant.whatsapp}?text=${message}`, '_blank');
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-bold">Carregando loja...</div>;
  if (!storeData) return <div className="h-screen flex items-center justify-center font-bold">Loja não encontrada</div>;

  const featuredProducts = storeData.products.filter(p => p.is_featured && p.is_active);
  const saleProducts = storeData.products.filter(p => p.is_active && !p.is_featured);

  const filteredProducts = saleProducts.filter(p => 
    (searchTerm === "" || p.name.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (selectedCategory === null || p.category_id === selectedCategory)
  );  const primaryColor = storeData.tenant.primary_color || "#2563eb";
  const templateId = storeData.tenant.template_id || "minimal";

  // Template Styles Config
  const templates: Record<string, any> = {
    minimal: {
      bg: "bg-[#f8fafc]",
      card: "bg-white border-slate-100",
      accent: primaryColor,
      text: "text-slate-900",
      font: "font-sans",
      radius: "rounded-2xl"
    },
    cyber: {
      bg: "bg-black",
      card: "bg-slate-900 border-slate-800",
      accent: "#00ff7f",
      text: "text-white",
      font: "font-mono",
      radius: "rounded-none"
    },
    organic: {
      bg: "bg-[#fefaf6]",
      card: "bg-white border-orange-100",
      accent: "#d97706",
      text: "text-stone-800",
      font: "font-sans",
      radius: "rounded-[2rem]"
    },
    luxury: {
      bg: "bg-[#0a0a0a]",
      card: "bg-[#111] border-yellow-500/10",
      accent: "#c5a059",
      text: "text-stone-200",
      font: "font-serif",
      radius: "rounded-lg"
    }
  };

  const style = templates[templateId] || templates.minimal;

  return (
    <div className={cn("min-h-screen pb-24 font-sans animate-in fade-in duration-500", style.bg, style.text, style.font)}>
      {/* GLOBAL HUD HEADER */}
      <header className={cn("sticky top-0 z-[50] transition-all", templateId === 'cyber' ? "bg-black border-b border-slate-800" : "bg-white/90 backdrop-blur-md border-b border-slate-200")}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              style={{ backgroundColor: style.accent }}
              className={cn("w-10 h-10 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden", style.radius)}
            >
               {storeData.tenant.logo_url ? <img src={storeData.tenant.logo_url} className="object-cover w-full h-full" alt="logo" /> : storeData.tenant.name.charAt(0)}
            </div>
            <div>
               <h1 className="font-black text-sm tracking-widest uppercase">{storeData.tenant.name}</h1>
               <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Loja Online Ativa</span>
               </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-6">
              <a href="#catalogo" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors">Produtos</a>
              <a href="#sobre" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors">Quem Somos</a>
            </nav>
            <button 
              onClick={() => setIsCartOpen(true)}
              style={{ backgroundColor: style.accent }}
              className={cn("h-10 flex items-center gap-2 md:gap-3 px-3 md:px-5 text-white shadow-lg transition-all active:scale-95", style.radius)}
            >
              <ShoppingCart size={16} />
              <span className="text-[10px] hidden sm:inline font-bold uppercase tracking-widest">Carrinho</span>
              {cart.length > 0 && (
                <span className="bg-white text-slate-900 text-[9px] font-black px-1.5 py-0.5 rounded-full ml-1">
                  {cart.reduce((a, b) => a + b.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* HERO BANNER SECTION */}
      {storeData.tenant.banner_url ? (
        <div className="relative h-[25vh] md:h-[40vh] w-full overflow-hidden">
           <img src={storeData.tenant.banner_url} className="w-full h-full object-cover" alt="Banner" />
           <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
              <div className="text-center space-y-2">
                 <h2 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter drop-shadow-2xl">{storeData.tenant.name}</h2>
                 {storeData.tenant.show_address && storeData.tenant.address && (
                   <div className="flex items-center justify-center gap-2">
                      <MapPin size={14} className="text-white/60" />
                      <p className="text-xs md:text-sm font-bold text-white/80 uppercase tracking-[0.5em]">{storeData.tenant.address}</p>
                   </div>
                 )}
              </div>
           </div>
        </div>
      ) : (
        <footer style={{ backgroundColor: style.accent }} className="h-2" />
      )}

      {/* Featured Section */}
      {featuredProducts.length > 0 && (
        <div className={cn("py-12 mb-8 relative overflow-hidden", templateId === 'cyber' ? "bg-slate-900" : "bg-slate-950")}>
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent opacity-50"></div>
           <div className="max-w-7xl mx-auto px-6 relative z-10">
              <div className="mb-8 flex justify-between items-end">
                <div>
                   <span style={{ color: style.accent }} className="text-[10px] font-bold uppercase tracking-[0.3em]">Seleção Premium</span>
                   <h2 className="text-2xl font-black text-white uppercase tracking-tighter mt-1 italic">Destaques Nexus</h2>
                </div>
              </div>
              
              <div className="flex gap-6 overflow-x-auto pb-6 no-scrollbar snap-x">
                 {featuredProducts.map(product => (
                    <motion.div 
                      whileHover={{ y: -5 }}
                      key={product.id}
                      className={cn("min-w-[280px] md:min-w-[320px] bg-white/5 backdrop-blur-md border border-white/10 overflow-hidden snap-start group", style.radius)}
                    >
                       <div className="aspect-video relative">
                          <img src={product.image_url || "/placeholder.jpg"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={product.name} />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
                          <div className="absolute bottom-4 left-4 right-4">
                             <span 
                               style={{ backgroundColor: style.accent + '30', color: style.accent, borderColor: style.accent + '40' }}
                               className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded backdrop-blur-sm border mb-2 inline-block"
                             >
                               Flash Destaque
                             </span>
                             <h3 className="text-sm font-bold text-white uppercase tracking-widest line-clamp-1">{product.name}</h3>
                          </div>
                       </div>
                       <div className="p-4 flex items-center justify-between">
                          <div>
                             {product.discount_price ? (
                               <div className="flex items-center gap-2">
                                  <span className="text-lg font-mono font-bold text-white tracking-tighter">R$ {product.discount_price.toFixed(2)}</span>
                                  <span className="text-[9px] font-bold text-slate-500 line-through">R$ {product.price.toFixed(2)}</span>
                                </div>
                             ) : (
                               <span className="text-lg font-mono font-bold text-white tracking-tighter">R$ {product.price.toFixed(2)}</span>
                             )}
                          </div>
                          <button 
                            onClick={() => addToCart(product)}
                            style={{ backgroundColor: style.accent }}
                            className={cn("text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-black/20", style.radius)}
                          >
                             Adicionar
                          </button>
                       </div>
                    </motion.div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* SEARCH AND FILTERS Area */}
      <div id="catalogo" className="max-w-7xl mx-auto px-6 space-y-8 mt-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
           <div className="flex-1 max-w-2xl relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="Busque itens no catálogo..."
                className={cn("w-full pl-12 pr-4 h-12 border shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 text-sm font-medium placeholder:text-slate-300 transition-all", style.card, style.radius)}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>

           <div className="flex gap-2 overflow-x-auto py-1 no-scrollbar md:justify-end">
              <button 
                onClick={() => setSelectedCategory(null)}
                style={selectedCategory === null ? { backgroundColor: style.accent } : {}}
                className={cn(
                   "px-5 h-10 whitespace-nowrap font-bold text-[10px] uppercase tracking-widest transition-all border",
                   style.radius,
                   selectedCategory === null ? "text-white border-transparent shadow-xl" : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                )}
              >
                Todos
              </button>
              {storeData.categories.map(cat => (
                <button 
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={selectedCategory === cat.id ? { backgroundColor: style.accent } : {}}
                  className={cn(
                    "px-5 h-10 whitespace-nowrap font-bold text-[10px] uppercase tracking-widest transition-all border",
                    style.radius,
                    selectedCategory === cat.id ? "text-white border-transparent shadow-xl" : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                  )}
                >
                  {cat.name}
                </button>
              ))}
           </div>
        </div>

        {/* Product Catalog Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredProducts.map(product => (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={product.id}
              className={cn("overflow-hidden hover:shadow-2xl transition-all group flex flex-col relative", style.card, style.radius)}
            >
              <div className="aspect-square bg-slate-50 relative overflow-hidden flex items-center justify-center">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-200">
                    <Package size={48} />
                  </div>
                )}
                
                {product.discount_price && (
                   <div style={{ backgroundColor: style.accent }} className="absolute top-4 left-4 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl shadow-red-500/20">
                    Sale
                  </div>
                )}
              </div>
              <div className="p-5 flex flex-col flex-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{product.category_name || "Nexus Select"}</p>
                <h3 className="text-xs font-bold group-hover:text-blue-600 transition-colors leading-relaxed h-9 line-clamp-2 uppercase tracking-tight">{product.name}</h3>
                {Array.isArray(product.variations) && product.variations.length > 0 && (
                   <p style={{ color: style.accent }} className="text-[8px] font-black uppercase tracking-widest mt-1">Disponível em Grades</p>
                )}
                <div className="mt-6 flex items-end justify-between">
                  <div className="flex flex-col">
                    {product.discount_price ? (
                      <>
                        <span className="text-[10px] text-slate-400 line-through font-mono">R$ {Number(product.price).toFixed(2)}</span>
                        <span className="text-sm font-mono font-bold text-emerald-600 tracking-tighter">R$ {Number(product.discount_price).toFixed(2)}</span>
                      </>
                    ) : (
                      <p className="text-sm font-mono font-bold tracking-tighter">R$ {Number(product.price).toFixed(2)}</p>
                    )}
                  </div>
                  <button 
                    onClick={() => addToCart(product)}
                    style={{ backgroundColor: style.accent }}
                    className={cn("w-10 h-10 text-white flex items-center justify-center transition-all transform group-active:scale-95", style.radius)}
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        
        {filteredProducts.length === 0 && (
           <div className="py-24 text-center">
              <div className="w-20 h-20 bg-white shadow-xl shadow-slate-200 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200 border border-slate-100">
                <Search size={32} strokeWidth={1} />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhum resultado consolidado para "{searchTerm}"</p>
           </div>
        )}
      </div>

      {/* Variation Selection Modal */}
      <AnimatePresence>
        {configProduct && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className={cn("bg-white w-full max-w-sm overflow-hidden shadow-2xl space-y-0", style.radius)}
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                   <p style={{ color: style.accent }} className="text-[9px] font-black uppercase tracking-[0.2em] mb-1">Personalizar Item</p>
                   <h3 className="text-md font-black uppercase tracking-tighter text-slate-900 leading-none">{configProduct.name}</h3>
                </div>
                <button onClick={() => setConfigProduct(null)} className="p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-8">
                {configProduct.variations?.map((variation, vIdx) => (
                  <div key={vIdx} className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{variation.name}</label>
                    <div className="flex flex-wrap gap-2">
                       {variation.options.map((opt, oIdx) => (
                         <button
                           key={oIdx}
                           onClick={() => setSelectedOptions({...selectedOptions, [variation.name]: opt.value})}
                           style={selectedOptions[variation.name] === opt.value ? { backgroundColor: style.accent, borderColor: style.accent } : {}}
                           className={cn(
                             "px-4 h-12 min-w-[3rem] font-bold text-[10px] uppercase tracking-widest transition-all border",
                             style.radius,
                             selectedOptions[variation.name] === opt.value
                               ? "text-white shadow-xl"
                               : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                           )}
                         >
                           {opt.value}
                           {opt.stock > 0 && (
                             <span className="block text-[8px] opacity-60 font-mono">{opt.stock} un</span>
                           )}
                         </button>
                       ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 italic">
                <button
                  onClick={() => addToCart(configProduct!, selectedOptions)}
                  style={{ backgroundColor: style.accent }}
                  className={cn("w-full h-14 text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-95", style.radius)}
                >
                   Finalizar Escolha <Plus size={16} strokeWidth={3} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quem Somos / About Section */}
      <section id="sobre" className="max-w-7xl mx-auto px-6 mt-32 py-20 border-t border-slate-100 grid md:grid-cols-2 gap-16 items-center">
         <div>
            <span style={{ color: primaryColor }} className="text-[10px] font-bold uppercase tracking-[0.4em]">Identidade & Cultura</span>
            <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter mt-4 mb-8 italic leading-none">{storeData.tenant.name}<br/>Brand Experience</h2>
            <div className="space-y-6 text-slate-500 text-sm leading-relaxed font-medium">
               {storeData.tenant.about_text ? (
                 <p>{storeData.tenant.about_text}</p>
               ) : (
                 <p>Nossa plataforma digital Nexus conecta curadoria de alta performance com a conveniência do atendimento direto. Priorizamos a qualidade estrutural de cada item oferecido, garantindo uma jornada de compra intuitiva e segura.</p>
               )}
               {storeData.tenant.address && (
                  <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                     <MapPin size={18} className="text-slate-400 shrink-0" />
                     <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed text-slate-900">{storeData.tenant.address}</p>
                  </div>
               )}
            </div>
         </div>
         <div className="bg-slate-900 aspect-[4/5] md:aspect-square rounded-[3rem] relative overflow-hidden shadow-2xl group">
            {storeData.tenant.banner_url ? (
               <img src={storeData.tenant.banner_url} className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-1000" />
            ) : (
               <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center p-12">
                  <div className="w-full h-full border-4 border-dashed border-white/5 rounded-3xl flex items-center justify-center">
                     <span className="text-white/5 font-black text-[120px] uppercase transform -rotate-12 select-none tracking-tighter">NX</span>
                  </div>
               </div>
            )}
         </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-32 bg-white border-t border-slate-100 pt-20 pb-10">
         <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="md:col-span-2 space-y-8">
               <div className="flex items-center gap-4">
                  <div style={{ backgroundColor: style.accent }} className={cn("w-10 h-10 flex items-center justify-center text-white font-black text-lg", style.radius)}>
                     {storeData.tenant.name.charAt(0)}
                  </div>
                  <h4 className="font-black uppercase tracking-widest text-lg">{storeData.tenant.name}</h4>
               </div>
               <p className="text-xs text-slate-400 max-w-sm font-bold leading-relaxed uppercase tracking-widest opacity-80">
                  {storeData.tenant.footer_text || "Excelência em catálogo digital e inteligência logística. Conectando sua necessidade ao produto ideal."}
               </p>
               <div className="flex gap-4">
                  {storeData.tenant.instagram_url && (
                    <a href={`https://instagram.com/${storeData.tenant.instagram_url.replace('@', '')}`} target="_blank" className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:text-pink-500 hover:bg-pink-50 transition-all border border-slate-100">
                      <Instagram size={20} />
                    </a>
                  )}
                  {storeData.tenant.facebook_url && (
                    <a href={`https://facebook.com/${storeData.tenant.facebook_url}`} target="_blank" className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all border border-slate-100">
                      <Facebook size={20} />
                    </a>
                  )}
               </div>
            </div>
            <div>
               <h5 className="text-[10px] font-black uppercase tracking-widest mb-8 border-l-4 border-slate-900 pl-3">Navegação</h5>
               <ul className="space-y-4">
                  <li><a href="#" className="text-[10px] text-slate-500 hover:text-slate-900 transition-colors uppercase font-black tracking-widest">Início</a></li>
                  <li><a href="#catalogo" className="text-[10px] text-slate-500 hover:text-slate-900 transition-colors uppercase font-black tracking-widest">Catálogo</a></li>
                  <li><a href="#sobre" className="text-[10px] text-slate-500 hover:text-slate-900 transition-colors uppercase font-black tracking-widest">Sobre Nós</a></li>
               </ul>
            </div>
            <div>
               <h5 className="text-[10px] font-black uppercase tracking-widest mb-8 border-l-4 border-slate-900 pl-3">Atendimento</h5>
               <a 
                 href={`https://wa.me/${storeData.tenant.whatsapp}`}
                 className="flex items-center gap-4 text-slate-500 hover:text-slate-900 transition-colors group"
               >
                  <div style={{ backgroundColor: style.accent + '10', color: style.accent }} className={cn("p-3", style.radius)}>
                     <MessageCircle size={24} />
                  </div>
                  <div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">WhatsApp Central</p>
                     <p className="text-sm font-mono font-black">+{storeData.tenant.whatsapp}</p>
                  </div>
               </a>
            </div>
         </div>
         <div className="max-w-7xl mx-auto px-6 mt-20 pt-10 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">© {new Date().getFullYear()} {storeData.tenant.name} · Infraestrutura Powered by Nexus ERP</p>
            <div className="flex gap-2">
               <div className="w-10 h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div style={{ backgroundColor: style.accent }} className="w-1/2 h-full"></div>
               </div>
            </div>
         </div>
      </footer>

      {/* ADVANCED CART DRAWER */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-[101] shadow-2xl flex flex-col border-l border-slate-200"
            >
              <div className="px-8 h-20 border-b border-slate-100 flex items-center justify-between bg-white">
                <div>
                   <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Seu Pedido Nexus</h3>
                   <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Itens Pré-Selecionados</span>
                </div>
                <button onClick={() => setIsCartOpen(false)} className="p-3 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {cart.map(item => (
                  <div key={item.cartItemId} className="flex gap-5 p-4 rounded-3xl border border-slate-100 bg-slate-50/50 hover:bg-white transition-all shadow-sm">
                    <div className="w-16 h-20 bg-white rounded-2xl border border-slate-100 overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
                        {item.image_url ? (
                          <img src={item.image_url} className="w-full h-full object-cover" alt={item.name} />
                        ) : (
                          <Package size={20} className="text-slate-200" />
                        )}
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="text-[10px] font-black uppercase text-slate-900 leading-tight">{item.name}</h4>
                        {item.variationLabel && (
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">{item.variationLabel}</p>
                        )}
                        <p className="text-xs font-mono font-black mt-2 text-emerald-600">R$ {(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-3 bg-white border border-slate-200 w-fit px-2 py-1 rounded-xl shadow-sm mt-3">
                        <button onClick={() => updateQuantity(item.cartItemId, -1)} className="p-1 hover:bg-slate-50 rounded text-slate-400 transition-colors"><Minus size={12}/></button>
                        <span className="font-black text-xs w-5 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.cartItemId, 1)} className="p-1 hover:bg-slate-50 rounded text-slate-400 transition-colors"><Plus size={12}/></button>
                      </div>
                    </div>
                    <button onClick={() => removeFromCart(item.cartItemId)} className="text-slate-300 hover:text-rose-500 transition-colors p-1">
                      <X size={16} />
                    </button>
                  </div>
                ))}
                
                {cart.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-8 py-20">
                    <div className="w-32 h-32 bg-slate-50 rounded-[3rem] border border-slate-100 flex items-center justify-center shadow-inner">
                      <ShoppingCart size={48} strokeWidth={1} className="opacity-20" />
                    </div>
                    <div className="text-center">
                       <p className="font-black text-[10px] uppercase tracking-[0.3em] mb-2 text-slate-500">Logística Vazia</p>
                       <p className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">Consolide itens no catálogo para transacionar</p>
                    </div>
                    <button 
                      onClick={() => setIsCartOpen(false)}
                      style={{ backgroundColor: primaryColor }}
                      className="text-white px-10 h-12 rounded-2xl text-[10px] uppercase font-black tracking-widest shadow-xl transition-all active:scale-95"
                    >
                      Voltar ao Shopping
                    </button>
                  </div>
                )}
              </div>

              <div className="p-8 bg-slate-950 border-t border-white/5 space-y-8 rounded-t-[3rem]">
                <div className="flex justify-between items-end border-b border-white/10 pb-6">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Montante Consolidado</p>
                    <p className="text-3xl font-mono font-black text-white tracking-tighter">R$ {total.toFixed(2)}</p>
                  </div>
                  <div className="flex gap-1 mb-2">
                     <div style={{ backgroundColor: primaryColor }} className="w-2 h-2 rounded-full"></div>
                     <div className="w-2 h-2 rounded-full bg-white/10"></div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <button 
                    onClick={handleWhatsAppCheckout}
                    disabled={cart.length === 0}
                    className="w-full bg-[#25D366] text-white h-14 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-4 hover:bg-[#1fb355] transition-all shadow-2xl shadow-emerald-900/40 active:scale-95 disabled:grayscale disabled:opacity-30"
                  >
                    <MessageCircle size={24} />
                    Fechar via WhatsApp
                  </button>
                  <p className="text-[9px] text-slate-600 text-center uppercase tracking-widest font-black leading-relaxed px-10">
                    O checkout Nexus direciona o pedido para negociação direta via chat
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* COMPACT FLOATING CART BRIDGE (Mobile Only) */}
      {cart.length > 0 && !isCartOpen && (
        <motion.div 
          initial={{ y: 200 }}
          animate={{ y: 0 }}
          className="fixed bottom-8 left-8 right-8 z-40 lg:hidden"
        >
          <button 
            onClick={() => setIsCartOpen(true)}
            style={{ backgroundColor: primaryColor }}
            className="w-full h-14 text-white rounded-2xl shadow-2xl flex items-center justify-between px-8 border border-white/10"
          >
            <div className="flex items-center gap-4">
              <div className="bg-white/20 backdrop-blur-md w-7 h-7 rounded-xl flex items-center justify-center font-black text-[10px]">
                {cart.reduce((a, b) => a + b.quantity, 0)}
              </div>
              <span className="font-black uppercase tracking-widest text-[10px]">Review Order</span>
            </div>
            <span className="text-lg font-mono font-black tracking-tighter">R$ {total.toFixed(2)}</span>
          </button>
        </motion.div>
      )}
    </div>
  );
}
