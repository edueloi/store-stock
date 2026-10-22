import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Printer, RefreshCw, Ruler, Save, Settings2 } from "lucide-react";
import { Alert, Button, Input, PanelCard, SectionTitle, Select, Switch, Tabs } from "../ui";
import { useToast } from "../ui/Toast";
import { DEFAULT_LABEL_PRINT, LABEL_PRINT_PRESETS, labelGeometry, labelSettingsStorageKey, validateLabelPrint, type LabelPrintSettings as Settings } from "../../lib/labelPrinting";

type Profile = { name: string; settings: Settings };
function storedProfiles(): Profile[] {
  try {
    const data = JSON.parse(localStorage.getItem(`${labelSettingsStorageKey()}:profiles`) || "[]");
    return Array.isArray(data) ? data.filter(p => typeof p?.name === "string" && p.settings && !validateLabelPrint(p.settings).length).slice(0, 10) : [];
  } catch { return []; }
}
function matchingProfile(profiles: Profile[], settings: Settings) {
  return profiles.find(p => (Object.keys(DEFAULT_LABEL_PRINT) as (keyof Settings)[]).every(key => p.settings[key] === settings[key]));
}

export function LabelPrintSummary({ value, onOpen }: { value: Settings; onOpen: () => void }) {
  const profile = matchingProfile(storedProfiles(), value);
  return <section className="rounded-xl border border-slate-200 bg-white" aria-label="Formato de impressão de etiquetas" data-tour="barcodes-print-settings">
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
      <div className="flex min-w-0 items-center gap-3"><div className="rounded-lg bg-blue-50 p-2.5 text-blue-600"><Ruler size={20} /></div><div className="min-w-0"><h3 className="text-sm font-semibold text-slate-900">Formato e alinhamento da impressão</h3><p className="mt-1 text-xs text-slate-500">{value.mode === "thermal" ? "Bobina" : "Folha"} · {value.width} × {value.height} mm · {value.columns} coluna{value.columns > 1 ? "s" : ""}{value.printer === "elgin-btp-l42" ? " · Elgin BTP-L42(U)" : ""}</p>{profile && <p className="mt-1 break-words text-xs font-medium text-emerald-700">Perfil ativo: {profile.name}</p>}</div></div>
      <Button size="sm" variant="outline" onClick={onOpen} iconLeft={<Settings2 size={14} />}>Configurar medidas</Button>
    </div>
  </section>;
}

const SETTING_TABS = [{ id: "paper", label: "Papel e medidas", icon: Ruler }, { id: "advanced", label: "Ajustes avançados", icon: Settings2 }] as const;

export default function LabelPrintSettings({ value: applied, onChange: apply, onTest, onBack }: { value: Settings; onChange: (value: Settings) => void; onTest: (value: Settings) => void; onBack: () => void }) {
  const toast = useToast(), root = useRef<HTMLElement>(null);
  const [profiles, setProfiles] = useState<Profile[]>(storedProfiles);
  const [name, setName] = useState(() => matchingProfile(profiles, applied)?.name || "Minha etiqueta");
  const [value, setValue] = useState<Settings>(() => ({ ...applied }));
  const [tab, setTab] = useState<"paper" | "advanced">("paper"), [note, setNote] = useState("");
  const [printers, setPrinters] = useState<Array<{ name: string; displayName: string; isDefault: boolean }>>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false), [printerError, setPrinterError] = useState("");
  const canListPrinters = !!window.boxsysDesktop?.listUsbPrinters;
  const loadPrinters = async () => {
    if (!window.boxsysDesktop?.listUsbPrinters) return;
    setLoadingPrinters(true); setPrinterError("");
    try { setPrinters(await window.boxsysDesktop.listUsbPrinters()); }
    catch { setPrinterError("Não foi possível consultar as impressoras. Confira também a janela de impressão do Windows."); }
    finally { setLoadingPrinters(false); }
  };
  useEffect(() => {
    root.current?.focus({ preventScroll: true }); root.current?.scrollIntoView({ block: "start" });
    void loadPrinters();
  }, []);
  const errors = validateLabelPrint(value), g = labelGeometry(value);
  const set = (patch: Partial<Settings>) => { setValue({ ...value, ...patch }); setNote(""); };
  function preset(id: string) {
    const selected = LABEL_PRINT_PRESETS.find(p => p.id === id);
    if (selected) { setValue({ ...selected.settings, printer: selected.settings.mode === "thermal" ? value.printer : "generic" }); setNote(""); }
  }
  function save() {
    if (errors.length) return;
    const title = Array.from(name.trim()).slice(0, 60).join("");
    if (!title) { setNote("Dê um nome ao perfil."); return; }
    const index = profiles.findIndex(p => p.name.toLowerCase() === title.toLowerCase());
    if (index < 0 && profiles.length >= 10) { setNote("Já existem 10 perfis. Use o nome de um deles para atualizá-lo."); return; }
    const next = [...profiles], item = { name: title, settings: { ...value } };
    if (index >= 0) next[index] = item; else next.push(item);
    try {
      localStorage.setItem(`${labelSettingsStorageKey()}:profiles`, JSON.stringify(next));
      localStorage.setItem(labelSettingsStorageKey(), JSON.stringify(value));
      setProfiles(next); apply({ ...value }); onBack();
      toast.success(`Configuração salva e aplicada: ${title}.`);
    } catch { const message = "Não foi possível salvar no navegador. Verifique o armazenamento disponível."; setNote(message); toast.error(message); }
  }
  const number = (key: keyof Settings, label: string, min = 0, max = 100, hint?: string) => <Input key={key} label={label} type="number" step="0.1" min={min} max={max} showCount={false} hint={hint} value={Number.isFinite(value[key] as number) ? value[key] as number : ""} onChange={event => set({ [key]: event.target.value === "" ? NaN : Number(event.target.value) })} />;

  return <section ref={root} tabIndex={-1} className="space-y-4 outline-none" aria-label="Configurar etiquetas">
    <Button variant="ghost" size="sm" iconLeft={<ArrowLeft size={14} />} onClick={onBack}>Voltar</Button>
    <SectionTitle title="Configurar etiquetas" description="Ajuste o formato da impressão e salve para voltar às etiquetas." action={<>
      <Button variant="outline" onClick={() => onTest(value)} disabled={errors.length > 0} iconLeft={<Printer size={14} />}>Teste de alinhamento</Button>
      <Button onClick={save} disabled={errors.length > 0} iconLeft={<Save size={14} />}>Salvar e aplicar</Button>
    </>} />
    {note && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{note}</p>}
    {errors.length > 0 && <Alert variant="warning" title="Revise as medidas antes de imprimir"><ul className="list-disc space-y-1 pl-4">{errors.map(error => <li key={error}>{error}</li>)}</ul></Alert>}
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        <PanelCard title="Perfil de impressão" contentClassName="grid gap-4 sm:grid-cols-2">
          <Select label="Carregar perfil deste navegador" value="" onChange={event => { if (event.target.value === "") return; const profile = profiles[Number(event.target.value)]; if (profile) { setValue({ ...profile.settings }); setName(profile.name); setNote(""); } }}><option value="">Perfis salvos</option>{profiles.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}</Select>
          <Input label="Nome do perfil" value={name} showCount={false} maxLength={60} onChange={event => { setName(event.target.value); setNote(""); }} />
        </PanelCard>
        <PanelCard>
          <Tabs<"paper" | "advanced"> items={SETTING_TABS} value={tab} onChange={setTab} label="Configuração da impressão">
            {tab === "paper" ? <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Tipo de papel" value={value.mode} onChange={event => { if (event.target.value === "sheet") setValue({ ...DEFAULT_LABEL_PRINT }); else preset(`roll-${Math.min(3, value.columns)}`); }}><option value="sheet">Folha A4 / folha personalizada</option><option value="thermal">Bobina de etiquetas</option></Select>
                <Select label="Modelo de partida" value="" onChange={event => preset(event.target.value)}><option value="">Escolher um exemplo</option>{LABEL_PRINT_PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
                <Select label="Impressora / limite de largura" value={value.printer} onChange={event => setValue({ ...(event.target.value === "elgin-btp-l42" && value.mode !== "thermal" ? LABEL_PRINT_PRESETS[3].settings : value), printer: event.target.value as Settings["printer"] })}><option value="generic">Outra impressora / driver do Windows</option><option value="elgin-btp-l42">Elgin BTP-L42(U) / L42</option></Select>
                <Select label="Colunas lado a lado" value={value.columns} onChange={event => set({ columns: Number(event.target.value), skip: 0 })}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} coluna{n > 1 ? "s" : ""}</option>)}</Select>
                {number("width", "Largura da etiqueta (mm)", 10, 300)}
                {number("height", "Altura da etiqueta (mm)", 8, 500)}
                {number("paperWidth", value.mode === "thermal" ? "Largura total da bobina (mm)" : "Largura da folha (mm)", 10, 500)}
                {value.mode === "sheet" ? number("paperHeight", "Altura da folha (mm)", 8, 1000) : <Select label="Sensor / tipo de mídia" value={value.media} onChange={event => set({ media: event.target.value as Settings["media"] })}><option value="gap">Etiquetas com espaço (GAP)</option><option value="mark">Etiquetas com marca preta</option><option value="continuous">Papel contínuo</option></Select>}
                {number("gapX", "Espaço entre colunas (mm)")}
                {number("gapY", value.mode === "thermal" ? "GAP / intervalo entre fileiras (mm)" : "Espaço entre linhas (mm)")}
              </div>
              <p className="text-xs leading-5 text-slate-500">Os modelos são exemplos: confira as medidas da sua etiqueta. Colunas são posições lado a lado; as cópias são escolhidas na tela de impressão.</p>
            </div> : <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                {number("marginLeft", "Margem esquerda do papel (mm)")}
                {number("marginRight", "Margem direita do papel (mm)")}
                {value.mode === "sheet" && number("marginTop", "Margem superior da folha (mm)")}
                {value.mode === "sheet" && number("marginBottom", "Margem inferior da folha (mm)")}
                {number("safety", "Segurança dentro da etiqueta (mm)", 0, 100, "Área em branco protegida nas bordas.")}
                {number("scale", "Escala do conteúdo (%)", 50, 100, "Reduz sem distorcer texto e códigos.")}
                {number("offsetX", "Deslocamento horizontal (mm)", -20, 20, "Negativo: esquerda. Positivo: direita.")}
                {number("offsetY", "Deslocamento vertical (mm)", -20, 20, "Negativo: sobe. Positivo: desce.")}
                <Input label="Posições já usadas no início" type="number" min={0} max={Math.max(0, g.capacity - 1)} step={1} showCount={false} value={value.skip} hint={value.mode === "thermal" ? "Pule etiquetas usadas na primeira fileira." : "Pule espaços usados na primeira folha."} onChange={event => set({ skip: Number(event.target.value) })} />
              </div>
              <Switch label="Imprimir contorno das etiquetas" checked={value.borders} onChange={borders => set({ borders })} />
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-slate-800">Impressoras do computador</strong>{canListPrinters && <Button variant="outline" size="sm" onClick={() => void loadPrinters()} disabled={loadingPrinters} iconLeft={<RefreshCw size={12} />}>Atualizar lista</Button>}</div>
                {canListPrinters ? <><p className="mt-1">Selecione um destes nomes na janela de impressão do Windows.</p><ul className="mt-2 max-h-28 space-y-1 overflow-y-auto">{printers.map(p => <li key={p.name} className="break-words rounded border border-slate-200 bg-white px-2 py-1">{p.displayName || p.name}{p.isDefault ? " · Padrão do Windows" : ""}</li>)}</ul>{loadingPrinters ? <p role="status">Consultando impressoras…</p> : printerError ? <p role="alert" className="text-red-700">{printerError}</p> : !printers.length && <p>Nenhuma impressora foi retornada pelo Windows.</p>}</> : <p className="mt-1">No navegador, a impressora é escolhida ao clicar em Imprimir. O aplicativo BoxSys para Windows também permite listar as impressoras instaladas aqui.</p>}
              </div>
              <details className="rounded-lg border border-slate-200 p-3 text-xs leading-6 text-slate-600">
                <summary className="cursor-pointer font-medium text-slate-800">Ajuda: driver, corte e recuo da impressora</summary>
                <p className="mt-2">No driver, cadastre o papel com a largura da fileira inteira e a altura indicadas ao lado. Use escala 100%, margens nenhuma e cabeçalhos/rodapés desativados. O sistema já monta as colunas na página.</p>
                {value.mode === "thermal" && <p>Para GAP/marca, a página tem a altura da etiqueta; configure o intervalo de {value.gapY} mm no driver. Em papel contínuo, o intervalo já está incluído na página.</p>}
                <p>Corte, avanço para destaque e recuo físico (backfeed) são ajustes do driver/utilitário. O deslocamento acima ajusta somente o conteúdo.</p>
                {value.printer === "elgin-btp-l42" && <p>BTP-L42(U): papel de 25 a 110 mm e impressão de até 104 mm. <a className="underline" href="https://www.bztech.com.br/arquivos/manual-programacao-elgin-l42.pdf" target="_blank" rel="noreferrer">Manual da L42</a>.</p>}
              </details>
            </div>}
          </Tabs>
        </PanelCard>
        <p className="text-xs leading-5 text-slate-500">Salvar aplica o perfil e volta às etiquetas. Voltar descarta os ajustes desta tela. Os perfis ficam guardados para este usuário neste navegador.</p>
      </div>
      <aside className="min-w-0 xl:sticky xl:top-4">
        <PanelCard title="Formato da fileira" description="As medidas físicas permanecem fixas." icon={Ruler} contentClassName="space-y-4">
          {!errors.length ? <>
            <div className="relative overflow-hidden rounded border border-slate-300 bg-slate-100" style={{ aspectRatio: `${value.paperWidth} / ${value.height}` }}>{Array.from({ length: value.columns }, (_, i) => <div key={i} className="absolute top-0 flex h-full items-center justify-center border border-dashed border-blue-400 bg-white text-xs font-semibold text-blue-700" style={{ left: `${(value.marginLeft + i * (value.width + value.gapX)) / value.paperWidth * 100}%`, width: `${value.width / value.paperWidth * 100}%` }}>{i + 1}</div>)}</div>
            <dl className="space-y-3 text-xs"><div className="flex justify-between gap-2"><dt className="text-slate-500">Cada etiqueta</dt><dd className="font-medium">{value.width} × {value.height} mm</dd></div><div className="flex justify-between gap-2"><dt className="text-slate-500">Colunas por fileira</dt><dd className="font-medium">{value.columns}</dd></div><div className="flex justify-between gap-2"><dt className="text-slate-500">Papel no driver</dt><dd className="font-medium">{value.paperWidth} × {g.pageHeight} mm</dd></div><div className="flex justify-between gap-2"><dt className="text-slate-500">Área de conteúdo</dt><dd className="font-medium">{g.contentWidth.toFixed(1)} × {g.contentHeight.toFixed(1)} mm</dd></div></dl>
            <p className="border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">Faça um teste de alinhamento antes de imprimir um lote.</p>
          </> : <p className="text-xs text-slate-500">Corrija as medidas para visualizar a fileira.</p>}
        </PanelCard>
      </aside>
    </div>
  </section>;
}
