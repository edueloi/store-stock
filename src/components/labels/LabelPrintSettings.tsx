import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Pencil, Plus, Printer, RefreshCw, Ruler, Save, Settings2, Trash2 } from "lucide-react";
import { Alert, Button, Input, PanelCard, SectionTitle, Select, Switch, Tabs } from "../ui";
import { useToast } from "../ui/Toast";
import LabelSettingsPreview from "./LabelSettingsPreview";
import { DEFAULT_LABEL_PRINT, LABEL_FONTS, LABEL_PRINT_PRESETS, labelGeometry, labelSettingsStorageKey, validateLabelPrint, type LabelPrintSettings as Settings } from "../../lib/labelPrinting";

export type Profile = { name: string; settings: Settings };
const MAX_MODELS = 30;
export function storedProfiles(): Profile[] {
  try {
    const data = JSON.parse(localStorage.getItem(`${labelSettingsStorageKey()}:profiles`) || "[]");
    return Array.isArray(data) ? data.filter(p => typeof p?.name === "string" && p.settings && !validateLabelPrint(p.settings).length).slice(0, MAX_MODELS) : [];
  } catch { return []; }
}
export function persistProfiles(next: Profile[]) {
  try { localStorage.setItem(`${labelSettingsStorageKey()}:profiles`, JSON.stringify(next)); return true; } catch { return false; }
}
export function matchingProfile(profiles: Profile[], settings: Settings) {
  return profiles.find(p => (Object.keys(DEFAULT_LABEL_PRINT) as (keyof Settings)[]).every(key => p.settings[key] === settings[key]));
}

export function LabelPrintSummary({ value, onApply, onOpen }: { value: Settings; onApply: (value: Settings) => void; onOpen: (mode: "edit" | "new") => void }) {
  const toast = useToast();
  const [profiles, setProfiles] = useState<Profile[]>(storedProfiles);
  const [renaming, setRenaming] = useState(false), [newName, setNewName] = useState(""), [asking, setAsking] = useState(false);
  const current = matchingProfile(profiles, value);

  const choose = (p: Profile) => { onApply({ ...p.settings }); setRenaming(false); setAsking(false); };
  const rename = () => {
    const title = Array.from(newName.trim()).slice(0, 60).join("");
    if (!current || !title) return;
    if (profiles.some((p) => p !== current && p.name.toLowerCase() === title.toLowerCase())) { toast.error("Já existe um modelo com esse nome."); return; }
    const next = profiles.map((p) => (p === current ? { ...p, name: title } : p));
    if (persistProfiles(next)) { setProfiles(next); setRenaming(false); toast.success("Nome do modelo alterado."); } else toast.error("Não foi possível salvar no navegador.");
  };
  const remove = () => {
    if (!current) return;
    const next = profiles.filter((p) => p !== current);
    if (persistProfiles(next)) { setProfiles(next); setAsking(false); toast.success(`Modelo “${current.name}” excluído.`); } else toast.error("Não foi possível salvar no navegador.");
  };

  return <section className="rounded-xl border border-slate-200 bg-white" aria-label="Modelos de etiqueta" data-tour="barcodes-print-settings">
    <div className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600"><Ruler size={20} /></div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900">Modelo de etiqueta</h3>
            <p className="mt-0.5 text-xs text-slate-500">{value.mode === "thermal" ? "Bobina" : "Folha"} · {value.width} × {value.height} mm · {value.columns} coluna{value.columns > 1 ? "s" : ""}{value.printer === "elgin-btp-l42" ? " · Elgin BTP-L42(U)" : ""}{current ? <> · <span className="font-medium text-emerald-700">{current.name}</span></> : " · ajuste ainda não salvo como modelo"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onOpen("edit")} iconLeft={<Settings2 size={14} />}>Ajustar este modelo</Button>
          <Button size="sm" onClick={() => onOpen("new")} iconLeft={<Plus size={14} />}>Novo modelo</Button>
        </div>
      </div>

      {profiles.length === 0 ? (
        <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Ainda não há modelos salvos. Toque em <b>Novo modelo</b>, configure as medidas da sua etiqueta e dê um nome (ex.: “Etiqueta 32×25”, “Gôndola”). Depois é só escolher aqui.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Escolher o modelo de etiqueta">
          {profiles.map((p) => {
            const on = p === current;
            return <button key={p.name} type="button" role="radio" aria-checked={on} onClick={() => choose(p)}
              className={`inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition ${on ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"}`}>
              {on && <Check size={13} className="shrink-0" />}<span className="truncate">{p.name}</span>
              <span className="shrink-0 text-[10px] text-slate-400">{p.settings.width}×{p.settings.height}</span>
            </button>;
          })}
        </div>
      )}

      {current && !renaming && !asking && (
        <div className="flex flex-wrap gap-1 border-t border-slate-100 pt-2">
          <Button size="xs" variant="ghost" iconLeft={<Pencil size={12} />} onClick={() => { setNewName(current.name); setRenaming(true); }}>Renomear</Button>
          <Button size="xs" variant="ghost" iconLeft={<Trash2 size={12} />} onClick={() => setAsking(true)}>Excluir</Button>
        </div>
      )}
      {current && renaming && (
        <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
          <Input label="Novo nome do modelo" value={newName} showCount={false} maxLength={60} onChange={(e) => setNewName(e.target.value)} wrapperClassName="min-w-[220px] flex-1" />
          <Button size="sm" onClick={rename} disabled={!newName.trim()}>Salvar nome</Button>
          <Button size="sm" variant="ghost" onClick={() => setRenaming(false)}>Cancelar</Button>
        </div>
      )}
      {current && asking && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <span className="flex-1">Excluir o modelo <b>{current.name}</b>? As etiquetas já impressas não mudam.</span>
          <Button size="sm" variant="danger" onClick={remove}>Excluir</Button>
          <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>Cancelar</Button>
        </div>
      )}
    </div>
  </section>;
}

const SETTING_TABS = [{ id: "paper", label: "Papel e medidas", icon: Ruler }, { id: "style", label: "Aparência do texto", icon: Settings2 }, { id: "advanced", label: "Ajustes avançados", icon: Settings2 }] as const;

export default function LabelPrintSettings({ value: applied, onChange: apply, onTest, onBack, mode = "edit" }: { value: Settings; onChange: (value: Settings) => void; onTest: (value: Settings) => void; onBack: () => void; mode?: "edit" | "new" }) {
  const toast = useToast(), root = useRef<HTMLElement>(null);
  const [profiles, setProfiles] = useState<Profile[]>(storedProfiles);
  const editing = mode === "edit" ? matchingProfile(profiles, applied) : undefined; // modelo que está sendo ajustado (some no modo "novo")
  const [name, setName] = useState(() => (mode === "new" ? "" : editing?.name || "Minha etiqueta"));
  const [value, setValue] = useState<Settings>(() => ({ ...applied }));
  const [tab, setTab] = useState<"paper" | "style" | "advanced">("paper"), [note, setNote] = useState("");
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
    if (!title) { setNote("Dê um nome ao modelo."); return; }
    const clash = profiles.findIndex(p => p.name.toLowerCase() === title.toLowerCase());
    const own = editing ? profiles.indexOf(editing) : -1;
    // modo "novo": nunca sobrescreve outro modelo; modo "ajustar": atualiza o modelo aberto (e aceita novo nome)
    if (mode === "new" && clash >= 0) { setNote("Já existe um modelo com esse nome. Escolha outro nome."); return; }
    if (mode === "edit" && clash >= 0 && clash !== own) { setNote("Já existe outro modelo com esse nome. Escolha outro nome."); return; }
    if ((mode === "new" || own < 0) && clash < 0 && profiles.length >= MAX_MODELS) { setNote(`Já existem ${MAX_MODELS} modelos. Exclua algum na tela de etiquetas.`); return; }
    const next = [...profiles], item = { name: title, settings: { ...value } };
    if (mode === "edit" && own >= 0) next[own] = item; else if (clash >= 0) next[clash] = item; else next.push(item);
    try {
      localStorage.setItem(`${labelSettingsStorageKey()}:profiles`, JSON.stringify(next));
      localStorage.setItem(labelSettingsStorageKey(), JSON.stringify(value));
      setProfiles(next); apply({ ...value }); onBack();
      toast.success(mode === "new" ? `Modelo criado: ${title}.` : `Modelo salvo: ${title}.`);
    } catch { const message = "Não foi possível salvar no navegador. Verifique o armazenamento disponível."; setNote(message); toast.error(message); }
  }
  const number = (key: keyof Settings, label: string, min = 0, max = 100, hint?: string) => <Input key={key} label={label} type="number" step="0.1" min={min} max={max} showCount={false} hint={hint} value={Number.isFinite(value[key] as number) ? value[key] as number : ""} onChange={event => set({ [key]: event.target.value === "" ? NaN : Number(event.target.value) })} />;

  return <section ref={root} tabIndex={-1} className="space-y-4 outline-none" aria-label="Configurar etiquetas">
    <Button variant="ghost" size="sm" iconLeft={<ArrowLeft size={14} />} onClick={onBack}>Voltar</Button>
    <SectionTitle title={mode === "new" ? "Novo modelo de etiqueta" : "Ajustar modelo de etiqueta"} description={mode === "new" ? "Configure as medidas e dê um nome. Ele fica salvo para escolher na tela de etiquetas." : "Ajuste o formato da impressão e salve para voltar às etiquetas."} action={<>
      <Button variant="outline" onClick={() => onTest(value)} disabled={errors.length > 0} iconLeft={<Printer size={14} />}>Teste de alinhamento</Button>
      <Button onClick={save} disabled={errors.length > 0} iconLeft={<Save size={14} />}>{mode === "new" ? "Criar modelo" : "Salvar modelo"}</Button>
    </>} />
    {note && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{note}</p>}
    {errors.length > 0 && <Alert variant="warning" title="Revise as medidas antes de imprimir"><ul className="list-disc space-y-1 pl-4">{errors.map(error => <li key={error}>{error}</li>)}</ul></Alert>}
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        <PanelCard title={mode === "new" ? "Nome do novo modelo" : "Nome do modelo"} contentClassName="grid gap-4 sm:grid-cols-2">
          <Select label="Carregar perfil deste navegador" value="" onChange={event => { if (event.target.value === "") return; const profile = profiles[Number(event.target.value)]; if (profile) { setValue({ ...profile.settings }); setName(profile.name); setNote(""); } }}><option value="">Perfis salvos</option>{profiles.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}</Select>
          <Input label="Nome do perfil" value={name} showCount={false} maxLength={60} onChange={event => { setName(event.target.value); setNote(""); }} />
        </PanelCard>
        <PanelCard>
          <Tabs<"paper" | "style" | "advanced"> items={SETTING_TABS} value={tab} onChange={setTab} label="Configuração da impressão">
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
            </div> : tab === "style" ? <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Fonte" value={value.fontFamily} onChange={event => set({ fontFamily: event.target.value })}>{LABEL_FONTS.map(f => <option key={f} value={f}>{f}</option>)}</Select>
                <Select label="Alinhamento do texto" value={value.align} onChange={event => set({ align: event.target.value as Settings["align"] })}><option value="center">Centralizado</option><option value="left">À esquerda</option><option value="right">À direita</option></Select>
                {number("nameSize", "Tamanho do nome (pt)", 4, 40, "Reduza para nomes grandes caberem.")}
                <Select label="Linhas máximas do nome" value={value.nameLines} onChange={event => set({ nameLines: Number(event.target.value) })}>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} linha{n > 1 ? "s" : ""}</option>)}</Select>
                {number("priceSize", "Tamanho do preço (pt)", 4, 60)}
                {number("skuSize", "Tamanho do número/SKU (pt)", 4, 30)}
                {number("barcodeHeight", "Altura máxima do código de barras (mm)", 3, 60)}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Switch label="Nome em negrito" checked={value.nameBold} onChange={nameBold => set({ nameBold })} />
                <Switch label="Preço em negrito" checked={value.priceBold} onChange={priceBold => set({ priceBold })} />
              </div>
              <p className="text-xs leading-5 text-slate-500">Cada produto também pode ter um nome próprio na etiqueta: na tela de etiquetas, marque o produto e edite o campo "Nome na etiqueta". Se o texto não couber, o sistema reduz automaticamente para caber.</p>
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
              <Switch label="App desktop: enviar o tamanho do papel ao driver" description="Evita cortar as etiquetas das pontas. Se a etiqueta sair em branco, desligue e use o papel configurado no driver da impressora." checked={value.sendPageSize !== false} onChange={sendPageSize => set({ sendPageSize })} />
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
        <PanelCard title="Formato da fileira" description="Prévia em tempo real, na proporção real das suas configurações." icon={Ruler} contentClassName="space-y-4">
          {!errors.length ? <>
            <LabelSettingsPreview settings={value} />
            <dl className="space-y-3 text-xs"><div className="flex justify-between gap-2"><dt className="text-slate-500">Cada etiqueta</dt><dd className="font-medium">{value.width} × {value.height} mm</dd></div><div className="flex justify-between gap-2"><dt className="text-slate-500">Colunas por fileira</dt><dd className="font-medium">{value.columns}</dd></div><div className="flex justify-between gap-2"><dt className="text-slate-500">Papel no driver</dt><dd className="font-medium">{value.paperWidth} × {g.pageHeight} mm</dd></div><div className="flex justify-between gap-2"><dt className="text-slate-500">Área de conteúdo</dt><dd className="font-medium">{g.contentWidth.toFixed(1)} × {g.contentHeight.toFixed(1)} mm</dd></div></dl>
            <p className="border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">Faça um teste de alinhamento antes de imprimir um lote.</p>
          </> : <p className="text-xs text-slate-500">Corrija as medidas para visualizar a fileira.</p>}
        </PanelCard>
      </aside>
    </div>
  </section>;
}
