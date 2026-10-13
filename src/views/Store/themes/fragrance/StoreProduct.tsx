import { useMemo, useState } from "react";
import StockAvailability from "../../../../components/store/StockAvailability";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Droplets, MessageCircle, Minus, Plus, ShoppingBag } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { Button } from "../../../../components/ui";
import { useStore } from "../../StoreLayout";
import { buildStorePath, parseProductIdFromRoute, resolveStoreSlug } from "../../store-routing";
import { fragranceHidePrices, fragranceImage, fragranceMoney } from "./parts";

export default function StoreProduct() {
  const { slug: routeSlug, productId } = useParams();
  const { tenant, products, categories, addToCart, openCart } = useStore();
  const slug = resolveStoreSlug(routeSlug);
  const path = (suffix = "") => buildStorePath(slug, suffix);
  const product = products.find((item) => item.id === parseProductIdFromRoute(productId));
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [added, setAdded] = useState(false);
  const choices = useMemo(() => {
    if (Array.isArray(product?.variations)) return product.variations as Array<{ name: string; options: Array<{ value: string }> }>;
    if (Array.isArray(product?.attributes)) return product.attributes.map((attribute: any) => ({ name: attribute.name, options: (attribute.values || []).map((value: string) => ({ value })) }));
    return [];
  }, [product]);

  if (!product) return <main className="fragrance-page grid min-h-[60vh] place-items-center p-6 text-center"><div><Droplets className="mx-auto text-[#9c7252]" size={45}/><h1 className="mt-4 text-xl font-semibold text-[#332019]">Produto não encontrado</h1><Link to={path("/catalogo")} className="mt-5 inline-block rounded-xl bg-[#6e3f2c] px-5 py-3 text-xs font-semibold text-white">Voltar à coleção</Link></div></main>;

  const image = fragranceImage(product);
  const hidePrices = fragranceHidePrices(tenant);
  const category = categories.find((item) => item.id === product.category_id)?.name || "Perfumaria";
  const allSelected = choices.every((choice) => selected[choice.name]);
  const add = () => {
    if (!allSelected) return;
    const options = { ...selected, ...(note.trim() ? { "Observação": note.trim() } : {}) };
    for (let index = 0; index < quantity; index += 1) addToCart(product, Object.keys(options).length ? options : undefined);
    setAdded(true);
  };

  return <main className="fragrance-page min-h-screen bg-[#f8f4ee] pb-12 text-[#332019]">
    <StoreSEO title={`${product.name} | ${tenant.name}`} description={product.description || `${product.name} na ${tenant.name}.`} image={image} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name}/>
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
      <Link to={path("/catalogo")} className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-blue-700"><ArrowLeft size={15}/> Voltar à coleção</Link>
      <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-[#dbe5f3] bg-white shadow-[0_24px_65px_rgba(15,23,42,.10)] lg:grid lg:grid-cols-[minmax(0,1.08fr)_430px]">
        <section className="relative grid min-h-[330px] place-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_30%,#fff_0%,#edf4ff_62%,#d8e8ff_100%)] p-6 sm:p-10 lg:min-h-[620px]">
          <div className="absolute left-5 top-5 rounded-full border border-blue-200 bg-white/80 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.16em] text-blue-700 backdrop-blur">Seleção da loja</div>
          {image ? <img src={image} alt={product.name} className="relative z-10 h-full max-h-[530px] w-full object-contain mix-blend-multiply"/> : <Droplets size={56} strokeWidth={1} className="text-blue-500"/>}
        </section>
        <section className="p-5 sm:p-8">
          <p className="text-[10px] font-bold uppercase tracking-[.22em] text-blue-600">{category}</p>
          <h1 className="mt-3 text-3xl font-semibold leading-[1.02] tracking-[-.055em] text-slate-950 sm:text-4xl">{product.name}</h1>
          <p className="mt-4 text-xl font-bold text-blue-700">{hidePrices ? "Produto sob consulta" : fragranceMoney(Number(product.discount_price || product.price))}</p>
          {product.description && <p className="mt-6 border-y border-slate-100 py-5 text-sm leading-relaxed text-slate-600">{product.description}</p>}
          <div className="mt-6 space-y-5">{choices.map((choice) => <div key={choice.name}><p className="text-sm font-semibold text-slate-900">{choice.name} <span className="text-xs font-normal text-blue-600">obrigatório</span></p><div className="mt-3 flex flex-wrap gap-2">{choice.options.map((option) => <button key={option.value} onClick={() => setSelected((current) => ({ ...current, [choice.name]: option.value }))} className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition ${selected[choice.name] === option.value ? "border-blue-600 bg-blue-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50"}`}>{selected[choice.name] === option.value && <Check size={13} className="mr-1 inline"/>}{option.value}</button>)}</div></div>)}</div>
          <div className="mt-6"><label className="text-sm font-semibold text-slate-900">Mensagem ou observação</label><textarea value={note} onChange={(event) => setNote(event.target.value.slice(0, 250))} placeholder="Ex.: presente para entrega, preferência de atendimento" className="mt-3 min-h-24 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"/></div>
          <StockAvailability product={product} tenant={tenant} selected={selected} className="mt-5" /><div className="mt-6 flex flex-col gap-3 sm:flex-row"><div className="flex h-12 shrink-0 items-center self-start rounded-xl border border-slate-200 bg-white"><button onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="grid h-full w-10 place-items-center text-slate-600 hover:text-blue-700"><Minus size={15}/></button><span className="w-8 text-center text-sm font-semibold">{quantity}</span><button onClick={() => setQuantity((value) => value + 1)} className="grid h-full w-10 place-items-center text-slate-600 hover:text-blue-700"><Plus size={15}/></button></div><Button onClick={add} disabled={!allSelected} fullWidth iconLeft={<ShoppingBag size={16}/>} className="h-12 rounded-xl bg-blue-600 text-[10px] font-bold uppercase tracking-[.14em] hover:bg-blue-700">Adicionar ao pedido</Button></div>
          {added && <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-blue-900"><Check size={16}/> Produto adicionado ao pedido</p><div className="mt-3 flex flex-wrap gap-2"><Link to={path("/catalogo")} className="rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">Continuar escolhendo</Link><Button onClick={openCart} size="sm" className="rounded-lg bg-blue-700 text-[10px] font-bold uppercase tracking-wider">Ver pedido</Button></div></div>}
          <p className="mt-6 flex gap-2 text-xs leading-relaxed text-slate-500"><MessageCircle className="shrink-0 text-blue-600" size={15}/> Envie o pedido online; a loja confirma disponibilidade, pagamento e entrega.</p>
        </section>
      </div>
    </div>
  </main>;
}
