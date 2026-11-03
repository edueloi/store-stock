// Blocos compartilhados dos PDFs de relatório (Histórico de Caixa e Relatório
// Financeiro): identidade do estabelecimento, cartões de resumo e gráficos em
// HTML/CSS puro (sem SVG/canvas — renderiza igual no html2canvas de lib/pdf.ts).

export interface ReportIdentity {
  name: string;
  legalName: string;
  document: string;
  stateRegistration: string;
  address: string;
  phone: string;
  email: string;
  logo: string; // data URL (ou "" quando não tem/ não carregou)
}

const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const pct = (part: number, total: number) =>
  total > 0 ? `${((part / total) * 100).toFixed(1).replace(".", ",")}%` : "0%";

function formatDocument(raw: string) {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return raw || "";
}

function formatPhone(raw: string) {
  const d = (raw || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return raw || "";
}

async function logoToDataUrl(url: string): Promise<string> {
  if (!url) return "";
  try {
    const abs = url.startsWith("http") || url.startsWith("data:") ? url : `${window.location.origin}${url}`;
    if (abs.startsWith("data:")) return abs;
    const res = await fetch(abs);
    if (!res.ok) return "";
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => resolve("");
      fr.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

// Dados do estabelecimento pro cabeçalho. Nunca lança: se algo faltar, o
// cabeçalho só omite a linha correspondente.
export async function loadReportIdentity(): Promise<ReportIdentity> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let t: any = {};
  try {
    const res = await fetch("/api/tenant", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
    if (res.ok) t = await res.json();
  } catch { /* segue com o que tem */ }

  const street = [t.address_street, t.address_number].filter(Boolean).join(", ");
  const parts = [
    street,
    t.address_complement,
    t.address_district,
    [t.address_city, t.address_state].filter(Boolean).join("/"),
    t.address_zip ? `CEP ${t.address_zip}` : "",
  ].filter(Boolean);

  return {
    name: t.name || "Estabelecimento",
    legalName: t.razao_social && t.razao_social !== t.name ? t.razao_social : "",
    document: formatDocument(t.document || ""),
    stateRegistration: t.inscricao_estadual || "",
    address: parts.length ? parts.join(" · ") : t.address || "",
    phone: formatPhone(t.whatsapp || ""),
    email: t.email || "",
    logo: await logoToDataUrl(t.logo_url || ""),
  };
}

export const REPORT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 28px 32px; font-size: 11px; line-height: 1.35; background: #fff; }
  .rp-head { display: flex; align-items: center; gap: 16px; padding-bottom: 14px; border-bottom: 3px solid #1e3a5f; }
  .rp-logo { max-height: 64px; max-width: 150px; object-fit: contain; }
  .rp-id { flex: 1; min-width: 0; }
  .rp-id h1 { font-size: 17px; font-weight: 800; color: #0f172a; }
  .rp-id .legal { font-size: 10px; color: #475569; margin-top: 1px; }
  .rp-id .line { font-size: 10px; color: #475569; margin-top: 2px; }
  .rp-title { text-align: right; flex-shrink: 0; }
  .rp-title .kind { font-size: 9px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #64748b; }
  .rp-title .name { font-size: 15px; font-weight: 800; color: #1e3a5f; margin-top: 2px; }
  .rp-title .period { font-size: 10px; color: #475569; margin-top: 3px; }
  h2 { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: #1e3a5f; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 16px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 9px 11px; }
  .kpi label { display: block; font-size: 8.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #64748b; margin-bottom: 3px; }
  .kpi .v { font-size: 14px; font-weight: 800; color: #0f172a; }
  .kpi .s { font-size: 9px; color: #64748b; margin-top: 2px; }
  .kpi.hl { background: #1e3a5f; border-color: #1e3a5f; }
  .kpi.hl label, .kpi.hl .s { color: #cbd5e1; } .kpi.hl .v { color: #fff; }
  .kpi.pos .v { color: #047857; } .kpi.neg .v { color: #be123c; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  th { background: #1e3a5f; color: #fff; padding: 6px 8px; text-align: left; font-size: 9px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
  td { padding: 5px 8px; border-bottom: 1px solid #eef2f6; font-size: 10.5px; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  .r { text-align: right; } .c { text-align: center; }
  tr.total td { font-weight: 800; background: #e8eef6 !important; border-top: 2px solid #1e3a5f; }
  .pos { color: #047857; font-weight: 700; } .neg { color: #be123c; font-weight: 700; }
  .muted { color: #64748b; }
  .bars .row { display: flex; align-items: center; gap: 8px; margin: 5px 0; }
  .bars .lab { width: 120px; font-size: 10px; flex-shrink: 0; }
  .bars .track { flex: 1; height: 12px; background: #eef2f6; border-radius: 3px; overflow: hidden; }
  .bars .fill { height: 100%; border-radius: 3px; }
  .bars .val { width: 130px; text-align: right; font-size: 10px; font-weight: 700; flex-shrink: 0; }
  .cols { display: flex; align-items: flex-end; gap: 4px; height: 120px; border-bottom: 1px solid #cbd5e1; padding: 0 2px; }
  .cols .col { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; height: 100%; min-width: 0; }
  .cols .bar { width: 100%; max-width: 28px; border-radius: 3px 3px 0 0; min-height: 1px; }
  .cols-lab { display: flex; gap: 4px; padding: 3px 2px 0; }
  .cols-lab span { flex: 1; text-align: center; font-size: 8px; color: #64748b; min-width: 0; overflow: hidden; }
  .legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; font-size: 9.5px; color: #475569; }
  .legend i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
  .note { font-size: 9.5px; color: #64748b; margin-top: 6px; }
  .rp-foot { margin-top: 24px; padding-top: 8px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; }
  tr { page-break-inside: avoid; }
`;

export function reportHeaderHtml(id: ReportIdentity, kind: string, title: string, period: string) {
  const fiscal = [
    id.document ? `CNPJ/CPF: ${esc(id.document)}` : "",
    id.stateRegistration ? `IE: ${esc(id.stateRegistration)}` : "",
  ].filter(Boolean).join(" &nbsp;·&nbsp; ");
  const contact = [id.phone ? `Tel/WhatsApp: ${esc(id.phone)}` : "", id.email ? esc(id.email) : ""].filter(Boolean).join(" &nbsp;·&nbsp; ");
  return `
<div class="rp-head">
  ${id.logo ? `<img class="rp-logo" src="${id.logo}" alt=""/>` : ""}
  <div class="rp-id">
    <h1>${esc(id.name)}</h1>
    ${id.legalName ? `<div class="legal">${esc(id.legalName)}</div>` : ""}
    ${fiscal ? `<div class="line">${fiscal}</div>` : ""}
    ${id.address ? `<div class="line">${esc(id.address)}</div>` : ""}
    ${contact ? `<div class="line">${contact}</div>` : ""}
  </div>
  <div class="rp-title">
    <div class="kind">${esc(kind)}</div>
    <div class="name">${esc(title)}</div>
    <div class="period">${esc(period)}</div>
  </div>
</div>`;
}

export function reportFooterHtml(id: ReportIdentity) {
  return `<div class="rp-foot"><span>${esc(id.name)}${id.document ? ` · ${esc(id.document)}` : ""}</span><span>Emitido em ${new Date().toLocaleString("pt-BR")} · BoxSys Store</span></div>`;
}

export interface Kpi { label: string; value: string; sub?: string; tone?: "hl" | "pos" | "neg" }
export function kpisHtml(items: Kpi[], columns = 4) {
  return `<div class="kpis" style="grid-template-columns:repeat(${columns},1fr)">${items.map((k) =>
    `<div class="kpi ${k.tone ?? ""}"><label>${esc(k.label)}</label><div class="v">${esc(k.value)}</div>${k.sub ? `<div class="s">${esc(k.sub)}</div>` : ""}</div>`).join("")}</div>`;
}

export interface BarItem { label: string; value: number; color: string; display?: string }
// Barras horizontais com a participação de cada item no total.
export function hBarsHtml(items: BarItem[]) {
  const total = items.reduce((s, i) => s + i.value, 0);
  const max = Math.max(...items.map((i) => i.value), 0);
  if (!items.length || max <= 0) return `<p class="note">Sem dados no período.</p>`;
  return `<div class="bars">${items.map((i) =>
    `<div class="row"><div class="lab">${esc(i.label)}</div><div class="track"><div class="fill" style="width:${Math.max(2, (i.value / max) * 100)}%;background:${i.color}"></div></div><div class="val">${esc(i.display ?? brl(i.value))} <span class="muted">(${pct(i.value, total)})</span></div></div>`).join("")}</div>`;
}

export interface ColumnItem { label: string; value: number; color?: string }
// Colunas verticais (uma por dia/mês). Negativos ficam de fora da escala (usa o módulo).
export function columnsHtml(items: ColumnItem[], defaultColor = "#2563eb") {
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 0);
  if (!items.length || max <= 0) return `<p class="note">Sem dados no período.</p>`;
  return `<div class="cols">${items.map((i) =>
    `<div class="col"><div class="bar" style="height:${Math.max(1, (Math.abs(i.value) / max) * 100)}%;background:${i.value < 0 ? "#e11d48" : i.color ?? defaultColor}"></div></div>`).join("")}</div>
<div class="cols-lab">${items.map((i) => `<span>${esc(i.label)}</span>`).join("")}</div>`;
}

export function legendHtml(items: { label: string; color: string }[]) {
  return `<div class="legend">${items.map((i) => `<span><i style="background:${i.color}"></i>${esc(i.label)}</span>`).join("")}</div>`;
}

export function wrapReportDocument(title: string, body: string, extraCss = "") {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>${esc(title)}</title><style>${REPORT_CSS}${extraCss}</style></head><body>${body}</body></html>`;
}

export { esc as escapeHtml };
