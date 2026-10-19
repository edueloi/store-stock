import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Image as ImageIcon, Loader2, Plus, Trash2, Upload } from "lucide-react";
import type { HeroSlide } from "../../types";

type Props = {
  slides: HeroSlide[];
  autoplaySeconds: number;
  onChange: (patch: { hero_slides?: HeroSlide[]; hero_autoplay_seconds?: number }) => void;
};

const MAX_SLIDES = 8;
const inputClass = "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-500";

/** Editor dos banners do carrossel da home da vitrine (imagem, título, subtítulo e botão). */
export default function HeroSlidesEditor({ slides, autoplaySeconds, onChange }: Props) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<string>("");

  const update = (id: string, patch: Partial<HeroSlide>) => onChange({ hero_slides: slides.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const remove = (id: string) => onChange({ hero_slides: slides.filter((s) => s.id !== id) });
  const move = (index: number, dir: -1 | 1) => {
    const next = [...slides];
    const to = index + dir;
    if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]];
    onChange({ hero_slides: next });
  };
  const add = () => onChange({ hero_slides: [...slides, { id: `s${Date.now().toString(36)}`, image: "" }] });

  const upload = async (file: File) => {
    const id = targetRef.current;
    setUploading(id);
    setError("");
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/upload/banner", { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, body: form });
      if (!res.ok) throw new Error("Não foi possível enviar a imagem.");
      const { url } = await res.json();
      update(id, { image: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no envio.");
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-800">Banners da home (carrossel)</p>
          <p className="text-[11px] text-slate-500">Cadastre uma ou mais imagens grandes. Com um banner a home mostra a imagem fixa; com vários, vira carrossel. Sem banners, o modelo usa o destaque padrão.</p>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-slate-600">
          Trocar a cada
          <select value={autoplaySeconds} onChange={(e) => onChange({ hero_autoplay_seconds: Number(e.target.value) })} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs">
            <option value={0}>Manual</option>
            {[4, 6, 8, 10].map((s) => <option key={s} value={s}>{s} segundos</option>)}
          </select>
        </label>
      </div>

      <div className="space-y-3">
        {slides.map((slide, index) => (
          <div key={slide.id} className="grid gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3 md:grid-cols-[160px_1fr_auto]">
            <button
              type="button"
              onClick={() => { targetRef.current = slide.id; fileRef.current?.click(); }}
              className="relative flex h-24 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-white text-slate-400 hover:border-blue-400"
              aria-label="Enviar imagem do banner"
            >
              {slide.image ? <img src={slide.image} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={22} />}
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1 text-[10px] font-semibold text-white">
                {uploading === slide.id ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />} {slide.image ? "Trocar" : "Enviar"}
              </span>
            </button>
            <div className="grid gap-2 md:grid-cols-2">
              <input className={inputClass} value={slide.title || ""} onChange={(e) => update(slide.id, { title: e.target.value })} placeholder="Título (opcional)" maxLength={80} />
              <input className={inputClass} value={slide.subtitle || ""} onChange={(e) => update(slide.id, { subtitle: e.target.value })} placeholder="Subtítulo (opcional)" maxLength={140} />
              <input className={inputClass} value={slide.button_label || ""} onChange={(e) => update(slide.id, { button_label: e.target.value })} placeholder="Texto do botão (ex.: Ver ofertas)" maxLength={30} />
              <input className={inputClass} value={slide.button_url || ""} onChange={(e) => update(slide.id, { button_url: e.target.value })} placeholder="Link (ex.: /catalogo ou https://...)" />
            </div>
            <div className="flex gap-1 md:flex-col">
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Mover para cima" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-30"><ArrowUp size={14} /></button>
              <button type="button" onClick={() => move(index, 1)} disabled={index === slides.length - 1} aria-label="Mover para baixo" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-30"><ArrowDown size={14} /></button>
              <button type="button" onClick={() => remove(slide.id)} aria-label="Remover banner" className="grid h-8 w-8 place-items-center rounded-lg border border-rose-200 bg-white text-rose-500"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-[11px] font-semibold text-rose-600">{error}</p>}
      <button type="button" onClick={add} disabled={slides.length >= MAX_SLIDES} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
        <Plus size={14} /> Adicionar banner {slides.length >= MAX_SLIDES && `(máximo ${MAX_SLIDES})`}
      </button>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ""; }} />
    </div>
  );
}
