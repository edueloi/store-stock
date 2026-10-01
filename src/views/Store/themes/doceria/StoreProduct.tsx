import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CakeSlice, Check, ChevronDown, MessageCircle, Minus, Plus, ShoppingBag } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { buildStorePath, parseProductIdFromRoute, resolveStoreSlug } from "../../store-routing";

const imageOf = (product: { image_url?: string | null; images?: unknown }) =>
  (Array.isArray(product.images) && typeof product.images[0] === "string" ? product.images[0] : product.image_url) || null;
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function StoreProduct() {
  const { slug: routeSlug, productId } = useParams();
  const { products, categories, tenant, addToCart, openCart } = useStore();
  const isMadeToOrder = tenant.policies?.storefront?.checkout_mode === "order_request";
  const hidePrices = isMadeToOrder || tenant.policies?.storefront?.hide_prices === true;
  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);
  const product = products.find((item) => item.id === parseProductIdFromRoute(productId));
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [added, setAdded] = useState(false);
  const choices = useMemo(() => {
    if (Array.isArray(product?.variations)) return product.variations as Array<{ name: string; options: Array<{ value: string }> }>;
    if (Array.isArray(product?.attributes)) return product.attributes.map((attribute: any) => ({ name: attribute.name, options: (attribute.values || []).map((value: string) => ({ value })) }));
    return [];
  }, [product]);

  if (!product) return <main className="grid min-h-[60vh] place-items-center bg-[#f7f6ed] p-6 text-center"><div><CakeSlice size={44} className="mx-auto text-pink-300" /><h1 className="mt-4 text-xl font-extrabold">Doce não encontrado</h1><Link to={path("/catalogo")} className="mt-4 inline-flex rounded-full bg-pink-600 px-5 py-3 text-xs font-bold text-white">Voltar ao cardápio</Link></div></main>;

  const price = Number(product.discount_price || product.price);
  const category = categories.find((item) => item.id === product.category_id)?.name || "Doceria";
  const selectedAll = choices.every((choice) => chosen[choice.name]);
  const add = () => {
    if (!selectedAll) return;
    const options = { ...chosen, ...(note.trim() ? { Observação: note.trim() } : {}) };
    for (let index = 0; index < quantity; index += 1) addToCart(product, Object.keys(options).length ? options : undefined);
    setAdded(true);
  };

  return <main className="min-h-screen bg-[#f7f6ed] pb-14"><StoreSEO title={`${product.name} | ${tenant.name}`} description={product.description || `${product.name} por encomenda na ${tenant.name}.`} image={imageOf(product)} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} keywords={`${product.name}, doces, encomenda, ${tenant.name}`} />
    <div className="mx-auto max-w-6xl px-5 py-7 md:px-8"><Link to={path("/catalogo")} className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-pink-700"><ArrowLeft size={15} /> Voltar ao cardápio</Link>
      <div className="mt-5 grid overflow-hidden rounded-xl border border-[#e5d9c1] bg-white shadow-[0_18px_46px_rgba(94,69,31,.08)] lg:grid-cols-[minmax(0,1fr)_430px]">
        <div className="grid min-h-[280px] place-items-center bg-[#f7f6ed] p-5 lg:min-h-[450px] lg:p-7">{imageOf(product) ? <img src={imageOf(product)!} alt={product.name} className="block h-full max-h-[430px] w-full object-contain" /> : <div className="grid h-full place-items-center text-pink-300"><CakeSlice size={52} /></div>}</div>
        <section className="flex flex-col p-6 sm:p-8"><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-pink-500">{category}</p><h1 className="mt-2 text-3xl font-extrabold leading-tight text-[#4a2135]">{product.name}</h1><p className="mt-3 text-base font-extrabold uppercase tracking-wide text-pink-600">{hidePrices ? "Produto sob encomenda" : money(price)}</p>{product.description && <p className="mt-5 border-y border-pink-100 py-5 text-sm leading-relaxed text-[#785263]">{product.description}</p>}
          <div className="mt-5 space-y-5">{choices.map((choice) => <div key={choice.name}><div className="flex items-center justify-between"><p className="text-sm font-extrabold text-[#4a2135]">{choice.name}</p><span className="text-[10px] font-bold text-pink-600">Obrigatório</span></div><div className="mt-3 flex flex-wrap gap-2">{choice.options.map((option) => <button key={option.value} onClick={() => setChosen((current) => ({ ...current, [choice.name]: option.value }))} className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${chosen[choice.name] === option.value ? "border-pink-600 bg-pink-600 text-white" : "border-pink-100 bg-white text-[#674655] hover:border-pink-300"}`}>{chosen[choice.name] === option.value && <Check size={14} className="mr-1 inline" />}{option.value}</button>)}</div></div>)}</div>
          <div className="mt-6"><label className="text-sm font-extrabold text-[#4a2135]">Alguma observação?</label><p className="mt-1 text-xs text-[#9a7180]">Ex.: sem granulado, mensagem no cartão, data da retirada.</p><textarea value={note} onChange={(event) => setNote(event.target.value.slice(0, 250))} placeholder="Escreva aqui (opcional)" className="mt-3 min-h-24 w-full resize-none rounded-2xl border border-pink-100 bg-[#fffafd] p-4 text-sm outline-none transition focus:border-pink-400 focus:ring-4 focus:ring-pink-100" /></div>
          <div className="mt-6 flex items-center gap-4"><div className="flex h-12 items-center rounded-xl border border-pink-100"><button onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="grid h-full w-11 place-items-center text-pink-600"><Minus size={16} /></button><span className="w-8 text-center text-sm font-extrabold">{quantity}</span><button onClick={() => setQuantity((value) => value + 1)} className="grid h-full w-11 place-items-center text-pink-600"><Plus size={16} /></button></div><button onClick={add} disabled={!selectedAll} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 text-[11px] font-extrabold uppercase tracking-wider text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:bg-pink-200"><ShoppingBag size={16} /> Adicionar ao pedido</button></div>
          {added && <div className="mt-5 rounded-2xl bg-[#fff1f6] p-4"><p className="flex items-center gap-2 text-sm font-extrabold text-pink-700"><Check size={16} /> Adicionado ao seu pedido</p><div className="mt-3 flex flex-wrap gap-2"><Link to={path("/catalogo")} className="rounded-xl border border-pink-200 bg-white px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-pink-700">Adicionar mais itens</Link><button onClick={openCart} className="rounded-xl bg-[#54243c] px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-white">Ver meu pedido</button></div></div>}
          <p className="mt-auto pt-6 text-xs leading-relaxed text-[#8f6877]"><MessageCircle size={14} className="mr-1 inline text-pink-500" /> Após enviar, a equipe confirma produção, pagamento e retirada/entrega pelo WhatsApp.</p>
        </section>
      </div>
    </div>
  </main>;
}
