import GlassDrawing from "./GlassDrawing";
import type { ReactNode } from "react";
import { FINISHES, GLASS_THICKNESS, GLASS_TYPES, PIECE_KINDS, pieceCut, pieceLabel, type GlassDefaults, type PieceKind, type PieceSpec } from "../lib/glassPieces";

export type { GlassDefaults };

// Formulário da peça de vidro + desenho ao vivo. Usado no orçamento do painel e na
// solicitação de orçamento da vitrine (por isso só Tailwind básico, sem componentes do painel).

export interface PieceDraft {
  kind: PieceKind;
  width_mm: string;
  height_mm: string;
  leaves: number;
  glass: string;
  thickness_mm: number;
  finish: string;
  notes: string;
  gap_mm: string;     // sangria por lado (mm)
  waste_pct: string;  // margem de segurança (%)
}

// Sangria e margem costumam ser as mesmas em todo o trabalho: lembra os últimos valores usados neste navegador.
// Cada tipo de peça tem a sua própria sangria (box, janela e espelho costumam ser diferentes): guarda
// o último valor usado por tipo e, para tipo ainda sem histórico, o último valor usado em geral.
const TECH_KEY = "vidra:tecnico";
type TechValues = { gap_mm: string; waste_pct: string };
const readTechStore = (): Record<string, TechValues> => {
  try { return JSON.parse(localStorage.getItem(TECH_KEY) || "{}") ?? {}; } catch { return {}; }
};
export function readTechnicalDefaults(kind?: string): TechValues {
  const store = readTechStore();
  const saved = (kind && store[kind]) || store._last || ({} as Partial<TechValues>);
  return { gap_mm: String(saved.gap_mm ?? ""), waste_pct: String(saved.waste_pct ?? "") };
}
export function rememberTechnicalDefaults(d: Pick<PieceDraft, "gap_mm" | "waste_pct"> & { kind?: string }) {
  try {
    const store = readTechStore();
    const values = { gap_mm: d.gap_mm, waste_pct: d.waste_pct };
    store._last = values;
    if (d.kind) store[d.kind] = values;
    localStorage.setItem(TECH_KEY, JSON.stringify(store));
  } catch { /* sem armazenamento */ }
}

/**
 * Sangria/margem iniciais de um tipo de peça: primeiro o padrão da loja (Configurações),
 * depois o último valor usado neste navegador.
 */
export function techDefaultsFor(kind: string, store?: GlassDefaults): TechValues {
  const perKind = store?.by_kind?.[kind];
  const gap = perKind?.gap_mm ?? store?.gap_mm;
  const waste = perKind?.waste_pct ?? store?.waste_pct;
  if (gap !== undefined || waste !== undefined) return { gap_mm: gap ? String(gap) : "", waste_pct: waste ? String(waste) : "" };
  return readTechnicalDefaults(kind);
}

export const emptyPieceDraft = (store?: GlassDefaults): PieceDraft => ({
  kind: "janela_correr", width_mm: "", height_mm: "", leaves: 2, glass: "Incolor", thickness_mm: 8, finish: "Branco", notes: "",
  ...techDefaultsFor("janela_correr", store),
});

/** Preenche o formulário a partir de uma peça já lançada (edição). */
export function specToDraft(spec: PieceSpec): PieceDraft {
  return {
    kind: spec.kind, width_mm: String(spec.width_mm), height_mm: String(spec.height_mm), leaves: spec.leaves ?? 1,
    glass: spec.glass ?? "Incolor", thickness_mm: spec.thickness_mm ?? 8, finish: spec.finish ?? "Branco", notes: spec.notes ?? "",
    gap_mm: spec.gap_mm ? String(spec.gap_mm) : "", waste_pct: spec.waste_pct ? String(spec.waste_pct) : "",
  };
}

export function draftToSpec(d: PieceDraft): PieceSpec {
  const hasLeaves = PIECE_KINDS.find((k) => k.value === d.kind)?.leaves;
  return {
    kind: d.kind,
    width_mm: Math.round(Number(d.width_mm.replace(",", ".")) || 0),
    height_mm: Math.round(Number(d.height_mm.replace(",", ".")) || 0),
    ...(hasLeaves ? { leaves: d.leaves } : {}),
    glass: d.glass, thickness_mm: d.thickness_mm, finish: d.finish,
    ...(d.notes.trim() ? { notes: d.notes.trim() } : {}),
    ...(Number(d.gap_mm.replace(",", ".")) > 0 ? { gap_mm: Number(d.gap_mm.replace(",", ".")) } : {}),
    ...(Number(d.waste_pct.replace(",", ".")) > 0 ? { waste_pct: Number(d.waste_pct.replace(",", ".")) } : {}),
  };
}

const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";
const label = "mb-1 block text-xs font-semibold text-slate-600";

function Block({ title, hint, tone = "slate", children }: { title: string; hint?: string; tone?: "slate" | "amber"; children: ReactNode }) {
  const amber = tone === "amber";
  return (
    <section className={`rounded-xl border p-3.5 ${amber ? "border-amber-200 bg-amber-50/70" : "border-slate-200 bg-white"}`}>
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <h4 className={`text-[11px] font-bold uppercase tracking-wide ${amber ? "text-amber-800" : "text-slate-500"}`}>{title}</h4>
        {hint && <span className={`text-[11px] ${amber ? "text-amber-700/70" : "text-slate-400"}`}>{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/** Campo numérico com a unidade encostada à direita (mm, %). */
function Unit({ unit, children }: { unit: string; children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">{unit}</span>
    </div>
  );
}

function Row({ name, value, strong }: { name: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-500">{name}</dt>
      <dd className={`text-right font-mono ${strong ? "text-sm font-bold text-slate-900" : "font-medium text-slate-700"}`}>{value}</dd>
    </div>
  );
}

/**
 * showTechnical: sangria e margem de segurança só aparecem para a equipe (nunca na solicitação do cliente).
 * summary: conteúdo extra no quadro da direita (ex.: valor da peça no orçamento).
 */
export default function GlassPieceFields({ draft, onChange, showTechnical = false, defaults, summary }: {
  draft: PieceDraft; onChange: (d: PieceDraft) => void; showTechnical?: boolean; defaults?: GlassDefaults; summary?: ReactNode;
}) {
  const set = <K extends keyof PieceDraft>(k: K, v: PieceDraft[K]) => onChange({ ...draft, [k]: v });
  const spec = draftToSpec(draft);
  const hasLeaves = PIECE_KINDS.find((k) => k.value === draft.kind)?.leaves;
  const ready = spec.width_mm >= 50 && spec.height_mm >= 50;
  const cut = pieceCut(spec);
  const hasGap = (spec.gap_mm ?? 0) > 0;
  const hasWaste = (spec.waste_pct ?? 0) > 0;
  const glass = [spec.glass, spec.thickness_mm ? `${spec.thickness_mm} mm` : ""].filter(Boolean).join(" ");

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* ── formulário em blocos ───────────────────────────────────────── */}
      <div className="space-y-3">
        <Block title="Peça">
          <div className="grid grid-cols-3 gap-3">
            <div className={hasLeaves ? "col-span-2" : "col-span-3"}>
              <label className={label}>Tipo de peça</label>
              <select className={field} value={draft.kind} onChange={(e) => {
                const kind = e.target.value as PieceKind;
                const leaves = PIECE_KINDS.find((k) => k.value === kind)?.leaves ? Math.max(2, draft.leaves) : 1;
                // ao trocar o tipo, traz a sangria/margem do padrão da loja (ou a última usada) para esse tipo
                onChange({ ...draft, kind, leaves, ...(showTechnical ? techDefaultsFor(kind, defaults) : {}) });
              }}>
                {PIECE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </div>
            {hasLeaves && (
              <div>
                <label className={label}>Folhas</label>
                <select className={field} value={draft.leaves} onChange={(e) => set("leaves", Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} {n === 1 ? "folha" : "folhas"}</option>)}
                </select>
              </div>
            )}
          </div>
        </Block>

        <Block title="Medidas do vão" hint="em milímetros">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Largura</label>
              <Unit unit="mm"><input className={`${field} pr-10`} inputMode="numeric" placeholder="1500" value={draft.width_mm} onChange={(e) => set("width_mm", e.target.value.replace(/[^\d.,]/g, ""))} /></Unit>
            </div>
            <div>
              <label className={label}>Altura</label>
              <Unit unit="mm"><input className={`${field} pr-10`} inputMode="numeric" placeholder="1000" value={draft.height_mm} onChange={(e) => set("height_mm", e.target.value.replace(/[^\d.,]/g, ""))} /></Unit>
            </div>
          </div>
        </Block>

        <Block title="Vidro e acabamento">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={label}>Vidro</label>
              <select className={field} value={draft.glass} onChange={(e) => set("glass", e.target.value)}>
                {GLASS_TYPES.map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Espessura</label>
              <select className={field} value={draft.thickness_mm} onChange={(e) => set("thickness_mm", Number(e.target.value))}>
                {GLASS_THICKNESS.map((t) => <option key={t} value={t}>{t} mm</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Perfil</label>
              <select className={field} value={draft.finish} onChange={(e) => set("finish", e.target.value)}>
                {FINISHES.map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>
          </div>
        </Block>

        {showTechnical && (
          <Block title="Corte do vidro" tone="amber" hint="só a equipe vê">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Sangria (por lado)</label>
                <Unit unit="mm"><input className={`${field} pr-10`} inputMode="decimal" placeholder="Ex.: 3" value={draft.gap_mm} onChange={(e) => set("gap_mm", e.target.value.replace(/[^\d.,]/g, ""))} /></Unit>
              </div>
              <div>
                <label className={label}>Margem de segurança</label>
                <Unit unit="%"><input className={`${field} pr-9`} inputMode="decimal" placeholder="Ex.: 5" value={draft.waste_pct} onChange={(e) => set("waste_pct", e.target.value.replace(/[^\d.,]/g, ""))} /></Unit>
              </div>
            </div>
          </Block>
        )}

        <Block title="Observações">
          <textarea className={field} rows={2} maxLength={300} value={draft.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Ex.: instalação no 2º andar, com fechadura" />
        </Block>
      </div>

      {/* ── quadro da direita: desenho grande + resumo ao vivo ───────────── */}
      <div className="space-y-3 lg:sticky lg:top-0 lg:self-start">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Pré-visualização</span>
            {ready && <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">{pieceLabel(spec.kind)}</span>}
          </div>
          <div className="flex min-h-[250px] items-center justify-center rounded-xl bg-white p-2 ring-1 ring-slate-100">
            {ready
              ? <GlassDrawing spec={spec} />
              : <p className="px-6 text-center text-sm text-slate-400">Informe a largura e a altura para ver o desenho da peça.</p>}
          </div>
        </div>

        {ready && (
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Resumo da peça</h4>
            <dl className="space-y-1.5 text-xs">
              <Row name="Medida do vão" value={`${spec.width_mm} × ${spec.height_mm} mm`} />
              {showTechnical ? (
                <>
                  {hasGap && <Row name="Sangria" value={`${spec.gap_mm} mm por lado`} />}
                  <Row name="Medida de corte" value={`${cut.cutW} × ${cut.cutH} mm`} strong />
                  {cut.leaves > 1 && <Row name="Cada folha" value={`≈ ${cut.leafW} mm de largura`} />}
                  <Row name="Área de corte" value={`${cut.areaCut.toFixed(2)} m²`} />
                  {hasWaste && <Row name="Margem de segurança" value={`+${spec.waste_pct}% → ${cut.areaBilled.toFixed(2)} m²`} />}
                </>
              ) : (
                <Row name="Área" value={`${cut.areaBilled.toFixed(2)} m²`} strong />
              )}
              {glass && <Row name="Vidro" value={glass} />}
            </dl>
          </div>
        )}

        {summary}
      </div>
    </div>
  );
}
