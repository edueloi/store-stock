import { Link, useParams } from "react-router-dom";
import { ArrowUpRight, Check, MapPin, MessageCircle, PackageCheck, Sparkles } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";

export default function StoreAbout() {
  const { slug: routeSlug } = useParams();
  const { tenant, products, categories } = useStore();
  const slug = resolveStoreSlug(routeSlug);
  const accent = tenant.primary_color || "#2563eb";
  const productCount = products.filter((product) => product.is_active).length;
  const hasWhatsApp = Boolean(tenant.whatsapp);

  return (
    <main className="overflow-hidden bg-[#f6f8fc] text-[#10203a]">
      <StoreSEO title={`Sobre — ${tenant.name}`} description={tenant.about_text || `Conheça a ${tenant.name}. Atendimento direto, catálogo atualizado e compra segura.`} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className="relative isolate border-b border-slate-200 bg-white">
        <div className="absolute inset-y-0 right-0 hidden w-[46%] bg-[#071426] lg:block" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-6 py-12 sm:px-8 md:py-16 lg:grid-cols-[1.1fr_.9fr] lg:items-stretch">
          <div className="flex flex-col justify-center">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.23em]" style={{ color: accent }}><Sparkles size={13} /> Sobre a loja</p>
            <h1 className="mt-5 max-w-2xl text-4xl font-black leading-[.92] tracking-[-.06em] sm:text-6xl">Moda que acompanha a sua rotina.</h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600">{tenant.about_text || `${tenant.name} reúne peças e acessórios selecionados para deixar sua escolha mais simples, leve e pessoal.`}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={buildStorePath(slug, "/catalogo")} className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-[10px] font-black uppercase tracking-[.15em] text-white transition-transform hover:-translate-y-0.5" style={{ backgroundColor: accent }}>Explorar produtos <ArrowUpRight size={14} /></Link>
              {hasWhatsApp && <a href={`https://wa.me/${tenant.whatsapp!.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-[10px] font-black uppercase tracking-[.15em] text-slate-700 hover:bg-slate-50"><MessageCircle size={14} /> Falar com a loja</a>}
            </div>
          </div>
          <div className="relative min-h-[310px] overflow-hidden rounded-[2rem] bg-[#071426] p-7 text-white shadow-2xl sm:min-h-[360px] sm:p-9">
            {tenant.banner_url ? <img src={tenant.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" /> : <><div className="absolute -right-12 -top-12 h-56 w-56 rounded-full border-[26px] border-white/10" /><div className="absolute -bottom-20 left-8 h-64 w-64 rounded-full" style={{ backgroundColor: accent, opacity: 0.55 }} /></>}
            <div className="absolute inset-0 bg-gradient-to-t from-[#071426] via-[#071426]/30 to-transparent" />
            <div className="relative flex h-full flex-col justify-between"><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-white/65"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Loja online ativa</p><div><p className="text-3xl font-black tracking-[-.05em] sm:text-4xl">{tenant.name}</p><p className="mt-2 max-w-xs text-sm leading-relaxed text-white/65">Curadoria, praticidade e um atendimento próximo de você.</p></div></div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-4 px-6 py-10 sm:px-8 md:grid-cols-3 md:py-14">
        {[
          { value: String(productCount), label: "produtos no catálogo", icon: PackageCheck },
          { value: String(categories.length), label: "categorias para explorar", icon: Sparkles },
          { value: hasWhatsApp ? "WhatsApp" : "Online", label: hasWhatsApp ? "atendimento direto" : "loja sempre disponível", icon: MessageCircle },
        ].map(({ value, label, icon: Icon }) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5"><Icon size={18} style={{ color: accent }} /><p className="mt-7 text-2xl font-black tracking-[-.05em]">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>)}
      </section>
      <section className="mx-auto max-w-7xl px-6 pb-14 sm:px-8 md:pb-20">
        <div className="grid gap-8 rounded-[2rem] bg-white p-7 shadow-sm ring-1 ring-slate-200 md:grid-cols-[1fr_auto] md:items-center md:p-10">
          <div><p className="text-[10px] font-black uppercase tracking-[.22em]" style={{ color: accent }}>Por que comprar aqui</p><h2 className="mt-3 text-2xl font-black tracking-[-.045em] sm:text-3xl">Uma experiência simples, do catálogo ao seu pedido.</h2></div>
          <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-3 md:grid-cols-1">{["Catálogo organizado", "Pedido acompanhado", "Atendimento humano"].map((item) => <p key={item} className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ backgroundColor: accent }}><Check size={12} /></span>{item}</p>)}</div>
        </div>
        {tenant.address && <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-slate-500"><MapPin size={14} style={{ color: accent }} /> {tenant.address}</p>}
      </section>
    </main>
  );
}
