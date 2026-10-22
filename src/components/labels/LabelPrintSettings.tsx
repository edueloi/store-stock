import { useState } from "react";
import { Printer, RefreshCw, Ruler, Save, Settings2 } from "lucide-react";
import { Alert, Button, Input, Modal, ModalFooter, Select, Switch } from "../ui";
import { useToast } from "../ui/Toast";
import { DEFAULT_LABEL_PRINT, LABEL_PRINT_PRESETS, labelGeometry, labelSettingsStorageKey, validateLabelPrint, type LabelPrintSettings as Settings } from "../../lib/labelPrinting";

type Profile = { name: string; settings: Settings };
export default function LabelPrintSettings({ value: applied, onChange: apply, onTest }: { value: Settings; onChange: (value: Settings) => void; onTest: (value: Settings) => void }) {
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false), [name, setName] = useState("Minha etiqueta"), [note, setNote] = useState("");
  const [value, setValue] = useState<Settings>(applied);
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
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    try { const data = JSON.parse(localStorage.getItem(`${labelSettingsStorageKey()}:profiles`) || "[]"); return Array.isArray(data) ? data.filter(p => typeof p?.name === "string" && p.settings && !validateLabelPrint(p.settings).length).slice(0, 10) : []; }
    catch { return []; }
  });
  const activeProfile = profiles.find(p => (Object.keys(DEFAULT_LABEL_PRINT) as (keyof Settings)[]).every(key => p.settings[key] === applied[key]));
  const errors = validateLabelPrint(value), g = labelGeometry(value);
  const open = () => { setValue({ ...applied }); setName(activeProfile?.name || "Minha etiqueta"); setNote(""); setIsOpen(true); void loadPrinters(); };
  const close = () => setIsOpen(false);
  const set = (patch: Partial<Settings>) => { setValue({ ...value, ...patch }); setNote(""); };
  function preset(id: string) {
    const selected = LABEL_PRINT_PRESETS.find(p => p.id === id);
    if (selected) setValue({ ...selected.settings, printer: selected.settings.mode === "thermal" ? value.printer : "generic" });
  }
  function save() {
    if (errors.length) return;
    const title = Array.from(name.trim()).slice(0, 60).join("");
    if (!title) { setNote("Dê um nome ao perfil."); return; }
    const index = profiles.findIndex(p => p.name.toLowerCase() === title.toLowerCase());
    if (index < 0 && profiles.length >= 10) { setNote("Já existem 10 perfis. Use o nome de um deles para atualizá-lo."); return; }
    const next = [...profiles]; const item = { name: title, settings: { ...value } };
    if (index >= 0) next[index] = item; else next.push(item);
    try {
      localStorage.setItem(`${labelSettingsStorageKey()}:profiles`, JSON.stringify(next));
      localStorage.setItem(labelSettingsStorageKey(), JSON.stringify(value));
      setProfiles(next); apply({ ...value }); close();
      toast.success(`Configuração salva e aplicada: ${title}.`);
    }
    catch { const message = "Não foi possível salvar no navegador. Verifique o armazenamento disponível."; setNote(message); toast.error(message); }
  }
  const number = (key: keyof Settings, label: string, min = 0, max = 100, hint?: string) => <Input key={key} label={label} type="number" step="0.1" min={min} max={max} showCount={false} hint={hint} value={Number.isFinite(value[key] as number) ? value[key] as number : ""} onChange={event => set({ [key]: event.target.value === "" ? NaN : Number(event.target.value) })} />;

  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="Formato de impressão de etiquetas" data-tour="barcodes-print-settings">
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
      <div className="flex min-w-0 items-center gap-3"><div className="rounded-lg bg-blue-50 p-2.5 text-blue-600"><Ruler size={20} /></div><div className="min-w-0"><h3 className="text-sm font-semibold text-slate-900">Formato e alinhamento da impressão</h3><p className="mt-1 text-xs text-slate-500">{applied.mode === "thermal" ? "Bobina" : "Folha"} · {applied.width} × {applied.height} mm · {applied.columns} coluna{applied.columns > 1 ? "s" : ""}{applied.printer === "elgin-btp-l42" ? " · Elgin BTP-L42(U)" : ""}</p>{activeProfile && <p className="mt-1 break-words text-xs font-medium text-emerald-700">Perfil ativo: {activeProfile.name}</p>}</div></div>
      <Button size="sm" variant="outline" aria-haspopup="dialog" onClick={open} iconLeft={<Settings2 size={14} />}>Configurar medidas</Button>
    </div>
    <Modal isOpen={isOpen} onClose={close} title="Configurar etiquetas" subtitle="Defina o papel, as medidas e o alinhamento. Salve para aplicar à impressão." size="2xl" mobileStyle="fullscreen" footer={<>
      {note && <p role="alert" className="mb-3 text-xs text-red-700">{note}</p>}
      <ModalFooter>
        <Button variant="outline" onClick={close}>Cancelar</Button>
        <Button variant="outline" onClick={() => onTest(value)} disabled={errors.length > 0} iconLeft={<Printer size={14} />}>Teste de alinhamento</Button>
        <Button onClick={save} disabled={errors.length > 0} iconLeft={<Save size={14} />}>Salvar e aplicar</Button>
      </ModalFooter>
    </>}>
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Select label="Tipo de papel" value={value.mode} onChange={event => { if (event.target.value === "sheet") setValue({ ...DEFAULT_LABEL_PRINT }); else preset(`roll-${Math.min(3, value.columns)}`); }}><option value="sheet">Folha A4 / folha personalizada</option><option value="thermal">Bobina de etiquetas</option></Select>
        <Select label="Impressora / limite de largura" value={value.printer} onChange={event => setValue({ ...(event.target.value === "elgin-btp-l42" && value.mode !== "thermal" ? LABEL_PRINT_PRESETS[3].settings : value), printer: event.target.value as Settings["printer"] })}><option value="generic">Outra impressora / driver do Windows</option><option value="elgin-btp-l42">Elgin BTP-L42(U) / L42</option></Select>
        <Select label="Modelo de partida" value="" onChange={event => preset(event.target.value)}><option value="">Escolher um exemplo</option>{LABEL_PRINT_PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <Select label="Colunas lado a lado" value={value.columns} onChange={event => set({ columns: Number(event.target.value), skip: 0 })}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} coluna{n > 1 ? "s" : ""}</option>)}</Select>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-slate-800">Impressoras do computador</strong>{canListPrinters && <Button variant="outline" size="sm" onClick={() => void loadPrinters()} disabled={loadingPrinters} iconLeft={<RefreshCw size={12} />}>Atualizar lista</Button>}</div>
        {canListPrinters ? <><p className="mt-1">Selecione um destes nomes na janela de impressão do Windows. O perfil acima define apenas as medidas e o limite de largura.</p><ul className="mt-2 max-h-28 space-y-1 overflow-y-auto">{printers.map(p => <li key={p.name} className="break-words rounded border border-slate-200 bg-white px-2 py-1">{p.displayName || p.name}{p.isDefault ? " · Padrão do Windows" : ""}</li>)}</ul>{loadingPrinters ? <p role="status">Consultando impressoras…</p> : printerError ? <p role="alert" className="text-red-700">{printerError}</p> : !printers.length && <p>Nenhuma impressora foi retornada pelo Windows.</p>}</> : <p className="mt-1">No navegador, suas impressoras aparecem na janela aberta ao clicar em Imprimir. No aplicativo BoxSys para Windows, esta tela também lista as impressoras instaladas. O perfil acima define as medidas; ele não instala nem seleciona uma impressora.</p>}
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
      <div className="grid items-end gap-3 sm:grid-cols-2">
        <Select label="Carregar perfil deste navegador" value="" onChange={event => { if (event.target.value === "") return; const profile = profiles[Number(event.target.value)]; if (profile) { setValue({ ...profile.settings }); setName(profile.name); setNote(""); } }}><option value="">Perfis salvos</option>{profiles.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}</Select>
        <Input label="Nome do perfil" value={name} showCount={false} maxLength={60} onChange={event => setName(event.target.value)} />
      </div>
      <p className="text-xs text-slate-500">Ao salvar, o perfil será aplicado e guardado para este usuário neste navegador. Cancelar mantém a configuração anterior. Faça um teste antes de imprimir um lote.</p>
    </div>
    </Modal>
  </section>;
}
