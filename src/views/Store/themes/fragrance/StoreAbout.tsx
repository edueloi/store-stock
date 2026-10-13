import { Link } from "react-router-dom";
import { ArrowUpRight, MapPin, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit } from "./kit";

import { FragranceTrust, fragranceImage } from "./parts";

export default function StoreAbout() {
  const { tenant, categories, active, path } = useKit(); const images = active.map(fragranceImage).filter(Boolean) as string[];
  const about = tenant.about_text || "Uma coleção pensada para acompanhar sua rotina, suas escolhas e os seus momentos.";
  return <main className="fragrance-page fr-modern min-h-screen bg-[#f8f4ee] pb-16 text-[#332019]"><StoreSEO title={`Sobre | ${tenant.name}`} description={about} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} keywords={`${tenant.name}, coleção, loja online, produtos`} />
    <section className="border-b border-[#e5d7c7] bg-[#40251d] px-5 py-16 text-[#fff8ed]"><div className="mx-auto max-w-6xl"><p className="text-[10px] font-bold uppercase tracking-[.28em] text-[#e8be93]">A nossa curadoria</p><h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[.95] tracking-[-.06em] sm:text-6xl">Uma coleção com identidade.</h1><p className="mt-6 max-w-xl text-sm leading-relaxed text-[#eddbca]">Conheça a seleção, o atendimento e o cuidado por trás de cada pedido da {tenant.name}.</p></div></section>
    <div className="mx-auto max-w-6xl px-5 py-14">
      <section className="grid gap-10 lg:grid-cols-[1fr_.9fr]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#9c7252]">Nossa essência</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-.05em] sm:text-4xl">Beleza com presença, escolha com intenção.</h2>
          <p className="mt-6 whitespace-pre-line text-[15px] leading-8 text-[#765e50]">{about}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={path("/catalogo")} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#40251d] px-5 text-[10px] font-bold uppercase tracking-[.14em] text-white">Ver coleção <ArrowUpRight size={14} /></Link>
            {tenant.whatsapp && <a href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full border border-[#cfb9a5] px-5 text-[10px] font-bold uppercase tracking-[.14em] text-[#633f2f]"><MessageCircle size={14} /> Falar com a loja</a>}
          </div>
        </div>
        <div className="grid min-h-[330px] grid-cols-2 gap-3 rounded-[2rem] bg-[#eadbc9] p-3">
          {images.length ? images.slice(0, 2).map((image, index) => (
            <img key={image} src={image} alt="Produtos da loja" className={`h-full min-h-60 w-full rounded-[1.4rem] bg-[#f8f1e8] object-contain p-4 ${index === 1 ? "mt-10" : "mb-10"}`} />
          )) : (
            <div className="col-span-2 grid place-items-center text-center text-[#765e50]">
              <Sparkles size={34} strokeWidth={1} />
              <p className="mt-3 text-sm">As imagens dos seus produtos aparecem aqui.</p>
            </div>
          )}
        </div>
      </section>
      <section className="mt-14"><FragranceTrust /></section><section className="mt-8 grid gap-px overflow-hidden rounded-[1.75rem] border border-[#e7ddd0] bg-[#e7ddd0] sm:grid-cols-3"><div className="bg-[#fffdfa] p-6"><p className="text-3xl font-semibold">{active.length}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.16em] text-[#9c7252]">Produtos disponíveis</p></div><div className="bg-[#fffdfa] p-6"><p className="text-3xl font-semibold">{categories.length}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.16em] text-[#9c7252]">Categorias</p></div><div className="bg-[#fffdfa] p-6">{tenant.show_address && tenant.address ? <><MapPin size={20} className="text-[#9c7252]"/><p className="mt-3 text-sm font-semibold">{tenant.address}</p></> : <><ShieldCheck size={20} className="text-[#9c7252]"/><p className="mt-3 text-sm font-semibold">Compra online com atendimento da loja</p></>}</div></section>
    </div>
  </main>;
}
