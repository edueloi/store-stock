export interface DocumentTenant {
  name: string;
  document?: string;
  logo_url?: string;
  whatsapp?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_district?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  address?: string;
  primary_color?: string;
  razao_social?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
}

export const fmtMoney = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function docLabel(doc: string): string {
  const digits = doc.replace(/\D/g, "");
  if (digits.length > 11) return "CNPJ";
  if (digits.length > 0) return "CPF";
  return "Documento";
}

function resolveLogoUrl(logoUrl?: string | null): string {
  if (!logoUrl) return "";
  return logoUrl.startsWith("http") ? logoUrl : `${window.location.origin}${logoUrl}`;
}

function buildStoreMetaLines(tenant: DocumentTenant | null): string[] {
  if (!tenant) return [];
  const lines: string[] = [];

  const addrParts = (() => {
    if (tenant.address_street) {
      const parts = [
        `${tenant.address_street}${tenant.address_number ? ", " + tenant.address_number : ""}`,
        tenant.address_complement,
        tenant.address_district,
        tenant.address_city && tenant.address_state
          ? `${tenant.address_city} - ${tenant.address_state}`
          : tenant.address_city ?? tenant.address_state ?? "",
        tenant.address_zip ? `CEP: ${tenant.address_zip}` : "",
      ].filter(Boolean);
      return parts.join(" - ");
    }
    return tenant.address ?? "";
  })();
  if (addrParts) lines.push(addrParts);

  const contactParts = [
    tenant.whatsapp ? `Tel/WhatsApp: ${tenant.whatsapp}` : "",
    tenant.document ? `${docLabel(tenant.document)}: ${tenant.document}` : "",
  ].filter(Boolean);
  if (contactParts.length) lines.push(contactParts.join("  |  "));

  const fiscalParts = [
    tenant.inscricao_estadual ? `IE: ${tenant.inscricao_estadual}` : "",
    tenant.inscricao_municipal ? `IM: ${tenant.inscricao_municipal}` : "",
  ].filter(Boolean);
  if (fiscalParts.length) lines.push(fiscalParts.join("  |  "));

  return lines;
}

export interface DocumentTableColumn {
  label: string;
  align?: "left" | "center" | "right";
  width?: string;
}

export interface DocumentTableRow {
  cells: string[];
  sub?: string;
}

export interface DocumentHeaderOptions {
  docTitle: string;
  docNumber: string;
  docDateLabel: string;
  docDate: string;
  extraTopRight?: string[];
}

/** Cabeçalho compartilhado — logo pequeno + nome/dados fiscais da loja + título/número do documento à direita. */
export function buildDocumentHeaderHtml(tenant: DocumentTenant | null, opts: DocumentHeaderOptions): string {
  const storeName = tenant?.razao_social || tenant?.name || "Estabelecimento";
  const fantasyName = tenant?.razao_social && tenant?.name && tenant.razao_social !== tenant.name ? tenant.name : "";
  const storeLogo = resolveLogoUrl(tenant?.logo_url);
  const metaLines = buildStoreMetaLines(tenant);

  return `
<div class="doc-header">
  <div class="doc-header-left">
    ${storeLogo ? `<img src="${storeLogo}" class="doc-logo" alt="Logo"/>` : `<div class="doc-logo-placeholder">LOGO</div>`}
    <div class="doc-store-info">
      <div class="doc-store-name">${storeName}</div>
      ${fantasyName ? `<div class="doc-store-fantasy">${fantasyName}</div>` : ""}
      ${metaLines.map((l) => `<div class="doc-store-meta-line">${l}</div>`).join("")}
    </div>
  </div>
  <div class="doc-header-right">
    <div class="doc-title">${opts.docTitle}</div>
    <div class="doc-number">Nº ${opts.docNumber}</div>
    <div class="doc-date">${opts.docDateLabel}: ${opts.docDate}</div>
    ${(opts.extraTopRight ?? []).map((l) => `<div class="doc-date">${l}</div>`).join("")}
  </div>
</div>
<hr class="doc-accent-rule"/>`;
}

/** Tabela compartilhada — código/descrição/unidade/qtd/valores, no padrão de recibo de distribuidora. */
export function buildDocumentTableHtml(columns: DocumentTableColumn[], rows: DocumentTableRow[]): string {
  const thead = columns
    .map((c) => `<th style="text-align:${c.align ?? "left"}${c.width ? `;width:${c.width}` : ""}">${c.label}</th>`)
    .join("");

  const tbody = rows
    .map((r) => {
      const cells = r.cells
        .map((c, i) => `<td style="text-align:${columns[i]?.align ?? "left"}">${c}</td>`)
        .join("");
      const subRow = r.sub
        ? `<tr class="doc-sub-row"><td colspan="${columns.length}">${r.sub}</td></tr>`
        : "";
      return `<tr>${cells}</tr>${subRow}`;
    })
    .join("");

  return `
<table class="doc-table">
  <thead><tr>${thead}</tr></thead>
  <tbody>${tbody}</tbody>
</table>`;
}

/** CSS compartilhado entre os documentos (OS, Orçamento) — visual de recibo profissional. */
export const DOCUMENT_BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12.5px; color: #1e293b; background: #fff; padding: 28px 36px; max-width: 794px; margin: 0 auto; }

  .doc-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .doc-header-left { display: flex; align-items: flex-start; gap: 12px; }
  .doc-logo { width: 52px; height: 52px; object-fit: contain; border-radius: 6px; }
  .doc-logo-placeholder { width: 52px; height: 52px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #cbd5e1; text-align: center; flex-shrink: 0; }
  .doc-store-name { font-size: 15px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.2px; }
  .doc-store-fantasy { font-size: 11px; color: #64748b; margin-top: 1px; }
  .doc-store-meta-line { font-size: 10px; color: #64748b; margin-top: 2px; line-height: 1.5; }
  .doc-header-right { text-align: right; flex-shrink: 0; }
  .doc-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--doc-brand, #2563eb); }
  .doc-number { font-size: 11px; font-weight: 700; color: #0f172a; margin-top: 2px; }
  .doc-date { font-size: 9.5px; color: #94a3b8; margin-top: 1px; }
  .doc-accent-rule { border: none; border-top: 1.5px solid var(--doc-brand, #2563eb); margin: 10px 0 16px; }

  .doc-section { margin-bottom: 14px; }
  .doc-section-label { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 6px; border-bottom: 1px solid #f1f5f9; padding-bottom: 3px; }
  .doc-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 18px; }
  .doc-info-row { font-size: 11.5px; color: #475569; }
  .doc-info-row b { color: #0f172a; font-weight: 700; }

  .doc-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 2px; }
  .doc-table thead tr { border-bottom: 1.5px solid #cbd5e1; }
  .doc-table thead th { padding: 5px 8px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; }
  .doc-table tbody td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
  .doc-table tbody tr:nth-child(odd) { background: #fafbfc; }
  .doc-sub-row td { padding: 0 8px 5px; font-size: 9.5px; color: #94a3b8; font-style: italic; border-bottom: 1px solid #f1f5f9; background: transparent !important; }

  .doc-totals { display: flex; justify-content: flex-end; margin-top: 10px; }
  .doc-totals-box { width: 240px; }
  .doc-totals-row { display: flex; justify-content: space-between; font-size: 11.5px; color: #475569; padding: 3px 0; }
  .doc-totals-row.grand { border-top: 1.5px solid var(--doc-brand, #2563eb); margin-top: 4px; padding-top: 6px; font-size: 14px; font-weight: 700; color: var(--doc-brand, #2563eb); }

  .doc-obs-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; margin-top: 6px; font-size: 11.5px; line-height: 1.55; background: #fafafa; }

  .doc-signatures { display: flex; justify-content: space-between; gap: 32px; margin-top: 44px; }
  .doc-sig-block { flex: 1; border-top: 1px solid #cbd5e1; padding-top: 8px; text-align: center; font-size: 10.5px; color: #64748b; }

  .doc-footer { text-align: center; font-size: 9.5px; color: #cbd5e1; margin-top: 26px; border-top: 1px solid #f1f5f9; padding-top: 10px; line-height: 1.7; }
`;
