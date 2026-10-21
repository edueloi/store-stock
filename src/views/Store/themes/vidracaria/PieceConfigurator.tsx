import { useState } from "react";
import { Plus, Ruler } from "lucide-react";
import GlassDrawing from "../../../../components/GlassDrawing";
import { PIECE_KINDS, sanitizePieceSpec } from "../../../../lib/glassPieces";
import { glassOptions, glassPrice, glassMeasureLabel, glassMeasurements, type GlassCatalogItem } from "../../../../../shared/glassCatalog";
import type { ProjectPiece } from "./project";

export default function PieceConfigurator({ item, itemKey, onAdd, initial, label = "Adicionar ao projeto", allowNotes = true }: { item: GlassCatalogItem; itemKey: string; onAdd: (piece: ProjectPiece) => void; initial?: ProjectPiece; label?: string; allowNotes?: boolean }) {
  const [unit, setUnit] = useState("cm");
  const [width, setWidth] = useState(initial?.spec ? String(initial.spec.width_mm / 10) : "");
  const [height, setHeight] = useState(initial?.spec ? String(initial.spec.height_mm / 10) : "");
  const settings = glassMeasurements(item);
  const kind = PIECE_KINDS.find(k => k.value === settings.kind)?.value || "fixo";
  const [leaves, setLeaves] = useState(initial?.spec?.leaves || 2);
  const [notes, setNotes] = useState(initial?.spec?.notes || initial?.selected_options?.["Observações da peça"] || "");
  const [quantity, setQuantity] = useState(initial?.quantity || 1);
  const [later, setLater] = useState(settings.enabled && (initial ? !initial.spec : false));
  const groups = glassOptions(item);
  const [options, setOptions] = useState<Record<string, string>>(initial?.selected_options || {});
  const [error, setError] = useState("");
  const factor = unit === "m" ? 1000 : unit === "cm" ? 10 : 1;
  const mm = (v: string) => Math.round(Number(v.replace(",", ".")) * factor);
  const spec = sanitizePieceSpec({ kind, width_mm: mm(width), height_mm: mm(height), leaves, notes });
  const price = glassPrice(item, spec?.width_mm || 0, spec?.height_mm || 0, quantity);
  const known = price.known && ((!item.sale_unit || item.sale_unit === "unidade") || !!spec && !later && settings.enabled);
  const submit = (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    if (settings.enabled && !later && !spec) return setError("Informe medidas entre 5 cm e 10 m. Você também pode solicitar a conferência pela loja.");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return setError("Informe de 1 a 99 peças iguais.");
    if (groups.some(g => !g.values.includes(options[g.name]))) return setError("Selecione as opções disponíveis no catálogo.");
    onAdd({ id: initial?.id || crypto.randomUUID(), key: itemKey, spec: later || !settings.enabled ? null : spec, quantity, selected_options: { ...options, ...(notes.trim() ? { "Observações da peça": notes.trim() } : {}) } });
  };
  return <form className="vitra-config" onSubmit={submit}>
    {settings.enabled && <div className="vitra-config-title"><Ruler size={19}/><div><h2>Do tamanho do seu projeto</h2><p>Informe as medidas desta peça.</p></div></div>}
    {groups.map(group => <label key={group.name}>{group.name}<select aria-label={group.name} required value={options[group.name] || ""} onChange={e => setOptions({ ...options, [group.name]: e.target.value })}><option value="" disabled>Selecione uma opção</option>{group.values.map(value => <option key={value}>{value}</option>)}</select></label>)}
    {settings.enabled && settings.allowLater && <label className="vitra-checkline"><input type="checkbox" checked={later} onChange={e => setLater(e.target.checked)}/>Ainda não tenho as medidas; preciso da orientação da loja</label>}
    {settings.enabled && !later && <>
      <div className="vitra-measure-heading"><label>Unidade das medidas<select aria-label="Unidade das medidas" value={unit} onChange={e => { const next = e.target.value; const nextFactor = next === "m" ? 1000 : next === "cm" ? 10 : 1; if (width) setWidth(String(Number((mm(width) / nextFactor).toFixed(3)))); if (height) setHeight(String(Number((mm(height) / nextFactor).toFixed(3)))); setUnit(next); }}><option value="cm">Centímetros (cm)</option><option value="m">Metros (m)</option><option value="mm">Milímetros (mm)</option></select></label></div>
      <div className="vitra-form-grid"><label>Largura ({unit})<input inputMode="decimal" required placeholder={unit === "cm" ? "Ex.: 120" : unit === "m" ? "Ex.: 1,20" : "Ex.: 1200"} value={width} onChange={e => setWidth(e.target.value.replace(/[^\d.,]/g, ""))}/></label><label>Altura ({unit})<input inputMode="decimal" required placeholder={unit === "cm" ? "Ex.: 100" : unit === "m" ? "Ex.: 1,00" : "Ex.: 1000"} value={height} onChange={e => setHeight(e.target.value.replace(/[^\d.,]/g, ""))}/></label></div>
      {PIECE_KINDS.find(k => k.value === kind)?.leaves && <label>Folhas<select value={leaves} onChange={e => setLeaves(Number(e.target.value))}>{[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}</select></label>}
      <div className="vitra-live-drawing">{spec ? <><GlassDrawing spec={spec}/><span>{(spec.width_mm * spec.height_mm / 1000000).toLocaleString("pt-BR", { maximumFractionDigits: 4 })} m² por peça · desenho ilustrativo</span></> : <p>O desenho aparece aqui conforme você informa as medidas.</p>}</div>
    </>}
    <div className="vitra-form-grid"><label>Quantidade de peças iguais<input type="number" required min={1} max={99} value={quantity} onChange={e => setQuantity(Number(e.target.value))}/></label><div className="vitra-estimate"><small>{known ? "Estimativa das peças" : "Valor"}</small><strong>{known ? price.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Sob consulta"}</strong><small>{known ? `Preço por ${glassMeasureLabel(item)}` : "A loja prepara o orçamento"}</small></div></div>
    {known && price.minimumApplied && <p className="vitra-hint">Mínimo faturável aplicado: {price.billed.toLocaleString("pt-BR")} {glassMeasureLabel(item)} por peça.</p>}
    {allowNotes && <label>Observações (opcional)<textarea rows={2} maxLength={300} value={notes} onChange={e => setNotes(e.target.value)}/></label>}
    {settings.enabled && <p className="vitra-hint">Medidas preliminares, sujeitas à conferência pela loja.</p>}
    {error && <p className="vitra-form-error" role="alert">{error}</p>}
    <button className="vitra-btn-primary" type="submit"><Plus size={16}/>{label}</button>
  </form>;
}
