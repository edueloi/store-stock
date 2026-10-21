import GlassDrawing, { frameSwatch, glassSwatch } from "./GlassDrawing";
import type { ReactNode } from "react";
import { PIECE_KINDS, PIECE_SHAPES, SHAPE_KINDS, pieceCut, pieceLabel, resolveGlassOptions, shapeLabel, type GlassDefaults, type GlassOptions, type PieceKind, type PieceShape, type PieceSpec } from "../lib/glassPieces";

export type { GlassDefaults, GlassOptions };

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
  shape: PieceShape;  // formato do vidro (peças de uma folha)
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
  kind: "janela_correr", width_mm: "", height_mm: "", leaves: 2, glass: "Incolor", thickness_mm: 8, finish: "Branco", notes: "", shape: "retangular",
  ...techDefaultsFor("janela_correr", store),
});

/** Formulário já preenchido com o que o serviço (marcado como peça de vidraçaria) define: tipo, vidro, espessura e perfil. */
export function draftForService(
  service: { piece_kind?: string | null; piece_defaults?: { glass?: string; thickness_mm?: number; finish?: string } | null } | null | undefined,
  store?: GlassDefaults,
): PieceDraft {
  const base = emptyPieceDraft(store);
  const kindInfo = PIECE_KINDS.find((k) => k.value === service?.piece_kind);
  if (!kindInfo) return base;
  const d = service?.piece_defaults ?? {};
  return {
    ...base,
    kind: kindInfo.value,
    leaves: kindInfo.leaves ? 2 : 1,
    ...(d.glass ? { glass: d.glass } : {}),
    ...(d.thickness_mm ? { thickness_mm: d.thickness_mm } : {}),
    ...(d.finish ? { finish: d.finish } : {}),
    ...techDefaultsFor(kindInfo.value, store),
  };
}

/** Preenche o formulário a partir de uma peça já lançada (edição). */
export function specToDraft(spec: PieceSpec): PieceDraft {
  return {
    kind: spec.kind, width_mm: String(spec.width_mm), height_mm: String(spec.height_mm), leaves: spec.leaves ?? 1,
    glass: spec.glass ?? "Incolor", thickness_mm: spec.thickness_mm ?? 8, finish: spec.finish ?? "Branco", notes: spec.notes ?? "", shape: spec.shape ?? "retangular",
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
    ...(d.shape !== "retangular" && SHAPE_KINDS.includes(d.kind) ? { shape: d.shape } : {}),
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

/** Medida em mm com − e + para ajuste fino (Shift = passos de 100 mm). */
function Stepper({ value, onChange, placeholder, unit = "mm", step = 10 }: { value: string; onChange: (v: string) => void; placeholder?: string; unit?: string; step?: number }) {
  const n = Number(String(value).replace(",", ".")) || 0;
  const bump = (dir: 1 | -1, big: boolean) => onChange(String(Math.max(0, Math.round(n + dir * (big ? step * 10 : step)))));
  const btn = "flex w-10 shrink-0 items-center justify-center text-lg font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 active:bg-slate-200";
  return (
    <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200">
      <button type="button" aria-label="Diminuir" title="Diminuir (Shift: 100 mm)" className={`${btn} border-r border-slate-200`} onClick={(e) => bump(-1, e.shiftKey)}>−</button>
      <div className="relative min-w-0 flex-1">
        <input className="w-full bg-transparent px-3 py-2 pr-10 text-center text-sm font-semibold text-slate-900 outline-none" inputMode="numeric" placeholder={placeholder} value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))} />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">{unit}</span>
      </div>
      <button type="button" aria-label="Aumentar" title="Aumentar (Shift: 100 mm)" className={`${btn} border-l border-slate-200`} onClick={(e) => bump(1, e.shiftKey)}>+</button>
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

/** Cartão de escolha com miniatura do desenho (tipo de peça e formato). */
function PickCard({ spec, label: text, active, onClick }: { spec: PieceSpec; label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`flex flex-col items-stretch rounded-xl border p-1.5 text-center transition ${active ? "border-blue-600 bg-blue-50 ring-2 ring-blue-200" : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"}`}>
      <div className="overflow-hidden rounded-lg bg-white"><GlassDrawing spec={spec} mini /></div>
      <span className={`mt-1 truncate px-0.5 text-[11px] font-semibold ${active ? "text-blue-700" : "text-slate-600"}`}>{text}</span>
    </button>
  );
}

/** Amostra de cor (vidro ou perfil) com o nome ao lado. */
function Swatch({ active, background, label: text, onClick }: { active: boolean; background: string; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-xs font-medium transition ${active ? "border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-200" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"}`}>
      <span className="h-6 w-6 shrink-0 rounded-full border border-slate-300 shadow-inner" style={{ background }} />
      {text}
    </button>
  );
}

const meters = (mm: number) => `${(mm / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;

/**
 * showTechnical: sangria e margem de segurança só aparecem para a equipe (nunca na solicitação do cliente).
 * summary: conteúdo extra no quadro da direita (ex.: valor da peça no orçamento).
 */
export default function GlassPieceFields({ draft, onChange, showTechnical = false, defaults, options, summary }: {
  draft: PieceDraft; onChange: (d: PieceDraft) => void; showTechnical?: boolean; defaults?: GlassDefaults; options?: GlassOptions; summary?: ReactNode;
}) {
  const set = <K extends keyof PieceDraft>(k: K, v: PieceDraft[K]) => onChange({ ...draft, [k]: v });
  const spec = draftToSpec(draft);
  const hasLeaves = PIECE_KINDS.find((k) => k.value === draft.kind)?.leaves;
  const ready = spec.width_mm >= 50 && spec.height_mm >= 50;
  const cut = pieceCut(spec);
  const hasGap = (spec.gap_mm ?? 0) > 0;
  const hasWaste = (spec.waste_pct ?? 0) > 0;
  const glass = [spec.glass, spec.thickness_mm ? `${spec.thickness_mm} mm` : ""].filter(Boolean).join(" ");
  const allowsShape = SHAPE_KINDS.includes(draft.kind);

  // Listas configuradas pela loja; o valor já escolhido continua aparecendo mesmo que tenha saído da lista.
  const opts = resolveGlassOptions(options);
  const withCurrent = <T,>(list: T[], current: T) => (list.includes(current) ? list : [current, ...list]);
  const kindList = opts.kinds.some((k) => k.value === draft.kind) ? opts.kinds : [PIECE_KINDS.find((k) => k.value === draft.kind)!, ...opts.kinds];
  const glassList = withCurrent(opts.glassTypes, draft.glass);
  const thicknessList = withCurrent(opts.thicknesses, draft.thickness_mm);
  const finishList = withCurrent(opts.finishes, draft.finish);

  const miniSpec = (kind: PieceKind, extra: Partial<PieceSpec> = {}): PieceSpec => ({
    kind, width_mm: 1500, height_mm: 1000, leaves: PIECE_KINDS.find((k) => k.value === kind)?.leaves ? 2 : 1,
    glass: draft.glass, finish: draft.finish, thickness_mm: draft.thickness_mm, ...extra,
  });

  const pickKind = (kind: PieceKind) => {
    const leaves = PIECE_KINDS.find((k) => k.value === kind)?.leaves ? Math.max(2, draft.leaves) : 1;
    // ao trocar o tipo, traz a sangria/margem do padrão da loja (ou a última usada) e volta ao formato retangular
    onChange({ ...draft, kind, leaves, shape: SHAPE_KINDS.includes(kind) ? draft.shape : "retangular", ...(showTechnical ? techDefaultsFor(kind, defaults) : {}) });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      {/* ── formulário em blocos ───────────────────────────────────────── */}
      <div className="space-y-3">
        <Block title="Tipo de peça" hint={pieceLabel(draft.kind)}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {kindList.map((k) => (
              <PickCard key={k.value} spec={miniSpec(k.value)} label={k.label} active={draft.kind === k.value} onClick={() => pickKind(k.value)} />
            ))}
          </div>
          {hasLeaves && (
            <div className="mt-3">
              <label className={label}>Folhas</label>
              <div className="inline-flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button key={n} type="button" onClick={() => set("leaves", n)} aria-pressed={draft.leaves === n}
                    className={`min-w-[2.75rem] rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${draft.leaves === n ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-blue-300"}`}>{n}</button>
                ))}
              </div>
            </div>
          )}
        </Block>

        {allowsShape && (
          <Block title="Formato do vidro" hint="a cobrança é pelo retângulo do vão">
            <div className="grid grid-cols-4 gap-2 lg:grid-cols-8">
              {PIECE_SHAPES.map((sh) => (
                <PickCard key={sh.value} spec={miniSpec(draft.kind, { shape: sh.value, leaves: 1 })} label={sh.label} active={draft.shape === sh.value} onClick={() => set("shape", sh.value)} />
              ))}
            </div>
          </Block>
        )}

        <Block title="Medidas do vão" hint="− / + ajustam de 10 em 10 mm (Shift: 100 mm)">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Largura {spec.width_mm >= 50 && <span className="font-normal text-slate-400">· {meters(spec.width_mm)}</span>}</label>
              <Stepper value={draft.width_mm} placeholder="1500" onChange={(v) => set("width_mm", v)} />
            </div>
            <div>
              <label className={label}>Altura {spec.height_mm >= 50 && <span className="font-normal text-slate-400">· {meters(spec.height_mm)}</span>}</label>
              <Stepper value={draft.height_mm} placeholder="1000" onChange={(v) => set("height_mm", v)} />
            </div>
          </div>
        </Block>

        <Block title="Vidro e acabamento">
          <div className="space-y-3.5">
            <div>
              <label className={label}>Tipo de vidro</label>
              <div className="flex flex-wrap gap-1.5">
                {glassList.map((g) => <Swatch key={g} active={draft.glass === g} background={glassSwatch(g)} label={g} onClick={() => set("glass", g)} />)}
              </div>
            </div>
            <div>
              <label className={label}>Espessura</label>
              <div className="flex flex-wrap gap-1.5">
                {thicknessList.map((t) => (
                  <button key={t} type="button" onClick={() => set("thickness_mm", t)} aria-pressed={draft.thickness_mm === t}
                    className={`min-w-[4rem] rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${draft.thickness_mm === t ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-blue-300"}`}>{t} mm</button>
                ))}
              </div>
            </div>
            <div>
              <label className={label}>Cor do perfil / ferragem</label>
              <div className="flex flex-wrap gap-1.5">
                {finishList.map((f) => <Swatch key={f} active={draft.finish === f} background={frameSwatch(f)} label={f} onClick={() => set("finish", f)} />)}
              </div>
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
      <div className="space-y-3 xl:sticky xl:top-0 xl:self-start">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Pré-visualização</span>
            {ready && <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">{pieceLabel(spec.kind)}{spec.shape && spec.shape !== "retangular" ? ` · ${shapeLabel(spec.shape)}` : ""}</span>}
          </div>
          <div className="flex min-h-[260px] items-center justify-center rounded-xl bg-white p-2 ring-1 ring-slate-100">
            {ready
              ? <GlassDrawing spec={spec} showCut={showTechnical} />
              : <p className="px-6 text-center text-sm text-slate-400">Informe a largura e a altura para ver o desenho da peça.</p>}
          </div>
        </div>

        {ready && (
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Resumo da peça</h4>
            <dl className="space-y-1.5 text-xs">
              <Row name="Medida do vão" value={`${spec.width_mm} × ${spec.height_mm} mm`} />
              {spec.shape && spec.shape !== "retangular" && <Row name="Formato" value={shapeLabel(spec.shape)} />}
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
              {spec.finish && <Row name="Perfil" value={spec.finish} />}
            </dl>
          </div>
        )}

        {summary}
      </div>
    </div>
  );
}
