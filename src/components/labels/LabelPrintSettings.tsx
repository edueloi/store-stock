import { useState } from "react";
import { ChevronDown, Printer, Ruler, Save, Settings2 } from "lucide-react";
import { Alert, Button, Input, Select, Switch } from "../ui";
import { DEFAULT_LABEL_PRINT, LABEL_PRINT_PRESETS, labelGeometry, labelSettingsStorageKey, validateLabelPrint, type LabelPrintSettings as Settings } from "../../lib/labelPrinting";

type Profile = { name: string; settings: Settings };
export default function LabelPrintSettings({ value, onChange, onTest }: { value: Settings; onChange: (value: Settings) => void; onTest: () => void }) {
  const [expanded, setExpanded] = useState(false), [name, setName] = useState("Minha etiqueta"), [note, setNote] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    try { const data = JSON.parse(localStorage.getItem(`${labelSettingsStorageKey()}:profiles`) || "[]"); return Array.isArray(data) ? data.filter(p => typeof p?.name === "string" && p.settings && !validateLabelPrint(p.settings).length).slice(0, 10) : []; }
    catch { return []; }
  });
  const errors = validateLabelPrint(value), g = labelGeometry(value);
  const set = (patch: Partial<Settings>) => { onChange({ ...value, ...patch }); setNote(""); };
  function preset(id: string) {
    const selected = LABEL_PRINT_PRESETS.find(p => p.id === id);
    if (selected) onChange({ ...selected.settings, printer: selected.settings.mode === "thermal" ? value.printer : "generic" });
  }
  function save() {
    if (errors.length) return;
    const title = Array.from(name.trim()).slice(0, 60).join("");
    if (!title) { setNote("Dê um nome ao perfil."); return; }
    const index = profiles.findIndex(p => p.name.toLowerCase() === title.toLowerCase());
    if (index < 0 && profiles.length >= 10) { setNote("Já existem 10 perfis. Use o nome de um deles para atualizá-lo."); return; }
    const next = [...profiles]; const item = { name: title, settings: { ...value } };
    if (index >= 0) next[index] = item; else next.push(item);
    try { localStorage.setItem(`${labelSettingsStorageKey()}:profiles`, JSON.stringify(next)); setProfiles(next); setNote("Perfil salvo para este usuário neste navegador."); }
    catch { setNote("Não foi possível salvar no navegador. Verifique o armazenamento disponível."); }
  }
  const number = (key: keyof Settings, label: string, min = 0, max = 100, hint?: string) => <Input key={key} label={label} type="number" step="0.1" min={min} max={max} showCount={false} hint={hint} value={Number.isFinite(value[key] as number) ? value[key] as number : ""} onChange={event => set({ [key]: event.target.value === "" ? NaN : Number(event.target.value) })} />;

  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="Formato de impressão de etiquetas" data-tour="barcodes-print-settings">
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
      <div className="flex items-center gap-3"><div className="rounded-lg bg-blue-50 p-2.5 text-blue-600"><Ruler size={20} /></div><div><h3 className="text-sm font-semibold text-slate-900">Formato e alinhamento da impressão</h3><p className="mt-1 text-xs text-slate-500">{value.mode === "thermal" ? "Bobina" : "Folha"} · {value.width || "—"} × {value.height || "—"} mm · {value.columns} coluna{value.columns > 1 ? "s" : ""}{value.printer === "elgin-btp-l42" ? " · Elgin BTP-L42(U)" : ""}</p></div></div>
      <Button size="sm" variant="outline" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} iconLeft={<Settings2 size={14} />} iconRight={<ChevronDown size={14} />}>{expanded ? "Recolher ajustes" : "Configurar medidas"}</Button>
    </div>
    {expanded && <div className="space-y-5 border-t border-slate-100 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Select label="Tipo de papel" value={value.mode} onChange={event => { if (event.target.value === "sheet") onChange({ ...DEFAULT_LABEL_PRINT }); else preset(`roll-${Math.min(3, value.columns)}`); }}><option value="sheet">Folha A4 / folha personalizada</option><option value="thermal">Bobina de etiquetas</option></Select>
        <Select label="Impressora / limite de largura" value={value.printer} onChange={event => onChange({ ...(event.target.value === "elgin-btp-l42" && value.mode !== "thermal" ? LABEL_PRINT_PRESETS[3].settings : value), printer: event.target.value as Settings["printer"] })}><option value="generic">Genérica / outra impressora</option><option value="elgin-btp-l42">Elgin BTP-L42(U) / L42</option></Select>
        <Select label="Modelo de partida" value="" onChange={event => preset(event.target.value)}><option value="">Escolher um exemplo</option>{LABEL_PRINT_PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <Select label="Colunas lado a lado" value={value.columns} onChange={event => set({ columns: Number(event.target.value), skip: 0 })}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} coluna{n > 1 ? "s" : ""}</option>)}</Select>
      </div>
      <p className="text-xs leading-5 text-slate-500">Os modelos são exemplos. Meça a etiqueta e a bobina/folha reais. Colunas são etiquetas lado a lado; a quantidade de cópias é escolhida em cada produto ou na etiqueta própria.</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {number("width", "Largura da etiqueta (mm)", 10, 300)}
        {number("height", "Altura da etiqueta (mm)", 8, 500)}
        {number("paperWidth", value.mode === "thermal" ? "Largura total da bobina (mm)" : "Largura da folha (mm)", 10, 500)}
        {value.mode === "sheet" ? number("paperHeight", "Altura da folha (mm)", 8, 1000) : <Select label="Sensor / tipo de mídia" value={value.media} onChange={event => set({ media: event.target.value as Settings["media"] })}><option value="gap">Etiquetas com espaço (GAP)</option><option value="mark">Etiquetas com marca preta</option><option value="continuous">Papel contínuo</option></Select>}
        {number("gapX", "Espaço entre colunas (mm)")}
        {number("gapY", value.mode === "thermal" ? "GAP / intervalo entre fileiras (mm)" : "Espaço entre linhas (mm)")}
        {number("marginLeft", "Margem esquerda do papel (mm)")}
        {number("marginRight", "Margem direita do papel (mm)")}
        {value.mode === "sheet" && number("marginTop", "Margem superior da folha (mm)")}
        {value.mode === "sheet" && number("marginBottom", "Margem inferior da folha (mm)")}
        {number("safety", "Segurança dentro da etiqueta (mm)", 0, 100, "Área em branco protegida nas bordas.")}
        {number("offsetX", "Deslocamento horizontal (mm)", -20, 20, "Negativo: esquerda. Positivo: direita.")}
        {number("offsetY", "Deslocamento vertical (mm)", -20, 20, "Negativo: sobe. Positivo: desce.")}
        {number("scale", "Escala do conteúdo (%)", 50, 100, "Reduz sem distorcer texto e códigos.")}
        <Input label="Posições já usadas no início" type="number" min={0} max={Math.max(0, g.capacity - 1)} step={1} showCount={false} value={value.skip} hint={value.mode === "thermal" ? "Pule etiquetas usadas na primeira fileira." : "Pule espaços usados na primeira folha."} onChange={event => set({ skip: Number(event.target.value) })} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-slate-50 p-4"><Switch label="Imprimir contorno das etiquetas" checked={value.borders} onChange={borders => set({ borders })} /><p className="text-xs text-slate-500">Área de conteúdo: {Number.isFinite(g.contentWidth) ? g.contentWidth.toFixed(1) : "—"} × {Number.isFinite(g.contentHeight) ? g.contentHeight.toFixed(1) : "—"} mm</p></div>
      {!errors.length && <div className="rounded-lg border border-slate-200 p-4"><p className="mb-3 text-xs font-medium text-slate-600">Vista de uma fileira · {value.columns} coluna{value.columns > 1 ? "s" : ""}</p><div className="relative mx-auto max-w-xl overflow-hidden rounded border border-slate-300 bg-slate-100" style={{ aspectRatio: `${value.paperWidth} / ${value.height}` }}>{Array.from({ length: value.columns }, (_, i) => <div key={i} className="absolute top-0 flex h-full items-center justify-center border border-dashed border-blue-400 bg-white text-[10px] font-semibold text-blue-700" style={{ left: `${(value.marginLeft + i * (value.width + value.gapX)) / value.paperWidth * 100}%`, width: `${value.width / value.paperWidth * 100}%` }}><span>{i + 1}<br />{value.width} × {value.height}</span></div>)}</div><p className="mt-3 text-xs text-slate-500">Cada página de impressão: {value.paperWidth} × {g.pageHeight} mm{value.mode === "sheet" ? ` · ${g.capacity} posições por folha` : ` · ${value.columns} posições por fileira`}.</p></div>}
      {errors.length > 0 && <Alert variant="warning" title="Revise as medidas antes de imprimir"><ul className="list-disc space-y-1 pl-4">{errors.map(error => <li key={error}>{error}</li>)}</ul></Alert>}
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-xs leading-6 text-blue-950"><strong>Configuração no Windows / driver</strong><br />Selecione a impressora e cadastre o papel com a largura e altura indicadas acima. Use escala 100%, margens nenhuma e cabeçalhos/rodapés desativados no navegador. O sistema já monta todas as colunas na página; não repita a divisão no driver.
        {value.mode === "thermal" && <><br />Para GAP/marca, a página contém somente a altura da etiqueta; o intervalo de {value.gapY} mm deve ser configurado no driver, que faz o avanço até a próxima fileira. Em papel contínuo, o intervalo é incluído na altura da página.</>}
        <br /><strong>Corte, avanço para destaque e recuo físico (backfeed)</strong> são ajustes do driver/utilitário da impressora. O navegador não envia esses comandos. O deslocamento acima ajusta somente o conteúdo.
        {value.printer === "elgin-btp-l42" && <><br />BTP-L42(U): papel de 25 a 110 mm e impressão de até 104 mm. Confirme o sensor e o modo com/sem ribbon no driver. <a className="underline" href="https://www.bztech.com.br/arquivos/manual-programacao-elgin-l42.pdf" target="_blank" rel="noreferrer">Manual da L42</a>.</>}
      </div>
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
        <Select label="Carregar perfil deste navegador" value="" onChange={event => { const profile = profiles[Number(event.target.value)]; if (profile) { onChange({ ...profile.settings }); setName(profile.name); } }}><option value="">Perfis salvos</option>{profiles.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}</Select>
        <Input label="Nome do perfil" value={name} showCount={false} maxLength={60} onChange={event => setName(event.target.value)} />
        <Button variant="outline" onClick={save} disabled={errors.length > 0} iconLeft={<Save size={14} />}>Salvar perfil</Button>
        <Button onClick={onTest} disabled={errors.length > 0} iconLeft={<Printer size={14} />}>Teste de alinhamento</Button>
      </div>
      <p className="text-xs text-slate-500" role="status">{note || "Medidas válidas ficam salvas automaticamente para este usuário neste navegador. Faça um teste antes de imprimir um lote."}</p>
    </div>}
    {!expanded && errors.length > 0 && <div className="px-5 pb-4 text-xs text-amber-700">Há medidas inválidas. Abra os ajustes para corrigir antes de imprimir.</div>}
  </section>;
}
