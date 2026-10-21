import { useRef, useState } from "react";
import { Save, Upload } from "lucide-react";
import type { Tenant, StorePolicies, VitraContent } from "../../types";
import { vitraContent } from "../Store/themes/vidracaria/content";

type Storefront = NonNullable<StorePolicies["storefront"]>;
export default function VitraContentEditor({ tenant, onChange, onSave, saving }: {
  tenant: Tenant; onChange: (patch: Partial<Storefront>) => void; onSave: () => void; saving: boolean;
}) {
  const sf = tenant.policies?.storefront || {};
  const content = vitraContent(tenant);
  const latest = useRef({ sf, onChange });
  latest.current = { sf, onChange };
  const patch = (value: Partial<VitraContent>) => latest.current.onChange({ glass_content: { ...latest.current.sf.glass_content, ...value } });
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputClass = "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800";
  const text = (label: string, key: keyof VitraContent, multiline = false) => <label className="grid gap-2 text-xs text-slate-600">{label}{multiline
    ? <textarea name={`storefront-${key}`} autoComplete="off" data-lpignore="true" data-1p-ignore="true" aria-label={label} className={inputClass} rows={3} maxLength={2000} value={String(content[key])} onChange={e => patch({ [key]: e.target.value })}/>
    : <input name={`storefront-${key}`} autoComplete="off" data-lpignore="true" data-1p-ignore="true" aria-label={label} className={inputClass} maxLength={500} value={String(content[key])} onChange={e => patch({ [key]: e.target.value })}/>}</label>;
  const toggle = (label: string, key: keyof VitraContent) => <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" className="accent-blue-600" checked={content[key] === true} onChange={e => patch({ [key]: e.target.checked })}/>{label}</label>;
  const field = (label: string, value: string, change: (value: string) => void) => <label className="grid gap-2 text-xs text-slate-600">{label}<textarea autoComplete="off" data-lpignore="true" data-1p-ignore="true" aria-label={label} className={inputClass} rows={2} maxLength={2000} value={value} onChange={e => change(e.target.value)}/></label>;
  const upload = async (file?: File) => {
    if (!file) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { setError("Envie uma imagem JPG, PNG ou WebP de até 5 MB."); return; }
    setUploading(true);
    try {
      const body = new FormData(); body.append("image", file);
      const response = await fetch("/api/upload/banner", { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, body });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error("Não foi possível enviar a imagem.");
      patch({ closing_image: data.url });
    } catch { setError("Não foi possível enviar a imagem. Tente novamente."); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  return <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5" aria-label="Textos e seções do modelo Vitra">
    <div><h3 className="text-sm font-semibold text-slate-800">Textos e seções do modelo Vitra</h3><p className="mt-2 text-xs leading-relaxed text-slate-500">Personalize cada parte para o segmento da sua loja. Os campos mostram o conteúdo atual. Apague um texto para ocultá-lo ou desmarque uma seção para removê-la da vitrine. As alterações valem somente para esta loja.</p></div>
    <details className="rounded-md border border-slate-200 p-4" open><summary className="cursor-pointer text-xs font-semibold">Destaque principal (hero)</summary><div className="mt-4 grid gap-4 md:grid-cols-2">
      {toggle("Mostrar destaque principal", "show_hero")}{toggle("Mostrar quantidade de produtos", "show_catalog_count")}
      {text("Texto acima do título principal", "hero_eyebrow")}
      {field("Título do destaque principal", sf.glass_hero_title ?? "Novas perspectivas\npara o seu espaço.", value => onChange({ glass_hero_title: value }))}
      {field("Descrição do destaque principal", sf.glass_hero_description ?? (tenant.about_text || "Conheça nosso catálogo e encontre os produtos que fazem parte do seu próximo projeto."), value => onChange({ glass_hero_description: value }))}
      {text("Botão do catálogo no destaque", "hero_catalog_button")}{text("Botão do projeto no destaque", "hero_project_button")}
      <p className="text-xs text-slate-500">A foto principal fica em Identidade & Dados. Os banners cadastrados acima substituem este destaque. O botão do projeto depende do orçamento online habilitado.</p>
    </div></details>
    <details className="rounded-md border border-slate-200 p-4"><summary className="cursor-pointer text-xs font-semibold">Apresentação, categorias e destaques</summary><div className="mt-4 grid gap-4 md:grid-cols-2">
      {toggle("Mostrar apresentação abaixo do hero", "show_intro")}{text("Título da apresentação", "intro_title", true)}{text("Texto da apresentação", "intro_text", true)}{text("Botão da apresentação", "intro_button")}
      {toggle("Mostrar categorias na página inicial", "show_categories")}{text("Texto acima das categorias", "categories_eyebrow")}
      {field("Título das categorias na página inicial", sf.home_categories_title ?? "Um catálogo de possibilidades.", value => onChange({ home_categories_title: value }))}
      {toggle("Mostrar produtos em destaque", "show_featured")}{text("Texto acima dos produtos em destaque", "featured_eyebrow")}
      {field("Título dos produtos em destaque", sf.home_featured_title ?? "Os detalhes começam aqui.", value => onChange({ home_featured_title: value }))}
    </div></details>
    <details className="rounded-md border border-slate-200 p-4"><summary className="cursor-pointer text-xs font-semibold">Etapas do orçamento</summary><div className="mt-4 grid gap-4 md:grid-cols-2">
      {toggle("Mostrar etapas do orçamento", "show_process")}<p className="text-xs text-slate-500">Esta seção aparece somente com o orçamento online habilitado.</p>{text("Texto acima das etapas", "process_eyebrow")}{text("Título das etapas", "process_title", true)}
      {content.process_steps.map((step, index) => <div key={index} className="space-y-3 rounded border border-slate-100 p-3">
        {field(`Título da etapa ${index + 1}`, step.title, value => patch({ process_steps: content.process_steps.map((item, i) => i === index ? { ...item, title: value } : item) }))}
        {field(`Descrição da etapa ${index + 1}`, step.text, value => patch({ process_steps: content.process_steps.map((item, i) => i === index ? { ...item, text: value } : item) }))}
      </div>)}
    </div></details>
    <details className="rounded-md border border-slate-200 p-4"><summary className="cursor-pointer text-xs font-semibold">Galeria de fotos</summary><div className="mt-4 grid gap-4 md:grid-cols-2">
      {toggle("Mostrar galeria de fotos", "show_gallery")}{toggle("Usar fotos dos produtos quando não houver fotos de ambientes", "gallery_use_products")}{text("Texto acima da galeria", "gallery_eyebrow")}{text("Título da galeria", "gallery_title")}
      <p className="text-xs text-slate-500">Cadastre imagens e legendas em Fotos de ambientes e projetos, logo abaixo.</p>
    </div></details>
    <details className="rounded-md border border-slate-200 p-4"><summary className="cursor-pointer text-xs font-semibold">Chamada com imagem antes do rodapé</summary><div className="mt-4 grid gap-4 md:grid-cols-2">
      {toggle("Mostrar chamada antes do rodapé", "show_closing")}{text("Texto acima da chamada final", "closing_eyebrow")}{text("Título da chamada final", "closing_title", true)}{text("Botão da chamada final", "closing_button")}{text("Endereço da imagem da chamada final", "closing_image")}
      <div className="space-y-2"><input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e => void upload(e.target.files?.[0])}/><button type="button" className="flex items-center gap-2 rounded border border-slate-200 px-3 py-2 text-xs" disabled={uploading} onClick={() => fileRef.current?.click()}><Upload size={14}/>{uploading ? "Enviando..." : "Enviar foto da chamada final"}</button><p className="text-xs text-slate-500">Apague o endereço para usar apenas o fundo escuro. Esta foto é independente do hero.</p>{error && <p role="alert" className="text-xs text-red-600">{error}</p>}</div>
    </div></details>
    <details className="rounded-md border border-slate-200 p-4"><summary className="cursor-pointer text-xs font-semibold">Rodapé</summary><div className="mt-4 grid gap-4 md:grid-cols-2">
      {text("Subtítulo da loja no rodapé", "footer_tagline")}{text("Descrição da loja no rodapé", "footer_description", true)}{text("Frase no final do rodapé", "footer_note")}{toggle("Mostrar categorias no rodapé", "footer_show_categories")}{toggle("Mostrar contato no rodapé", "footer_show_contact")}
      <p className="text-xs text-slate-500">O nome, o telefone e o endereço vêm de Identidade & Dados. O crédito Desenvolvido por boxsys.com.br aparece no final do rodapé.</p>
    </div></details>
    <button type="button" disabled={saving || uploading} onClick={onSave} className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"><Save size={14}/>{saving ? "Salvando..." : "Salvar textos e seções"}</button>
  </section>;
}
