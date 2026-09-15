// Helpers de formatação de cupom térmico de 42 colunas — mesmo padrão usado em
// buildThermalText (recibo de venda) e buildCashCloseReceiptText (fechamento de
// caixa) em PDV.tsx/PDVStandalone.tsx, extraído aqui pra ser compartilhado sem
// duplicar em mais um lugar (carnê de pagamento).
const W = 42;

export const thermalRule = "=".repeat(W);
export const thermalThin = "-".repeat(W);

export function thermalMoney(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function truncate(value: string, max = W): string {
  return String(value || "").slice(0, max);
}

export function thermalCenter(value: string): string {
  const text = truncate(value);
  return " ".repeat(Math.max(0, Math.floor((W - text.length) / 2))) + text;
}

export function thermalRow(left: string, right = ""): string {
  const rightText = truncate(right, 15);
  const leftText = truncate(left, W - rightText.length - 1);
  return `${leftText}${" ".repeat(Math.max(1, W - leftText.length - rightText.length))}${rightText}`;
}

export interface BookletInstallment {
  number: number;
  due_date: string;
  amount: number | string;
}

// Formata uma data que pode chegar como "YYYY-MM-DD" pura ou como ISO completo
// (ex.: Prisma serializa DateTime como "2026-10-15T00:00:00.000Z") — pegar só os
// 10 primeiros chars antes de montar o Date evita concatenar um T00:00:00 extra
// numa string que já tinha hora, o que produzia "Invalid Date".
function formatDueDate(dueDate: string): string {
  const datePart = dueDate.slice(0, 10);
  return new Date(`${datePart}T00:00:00`).toLocaleDateString("pt-BR");
}

// Carnê de pagamento — um canhoto por parcela (número, vencimento, valor, campo
// de assinatura), separados por linha de corte, no mesmo padrão de 42 colunas
// já usado no resto do sistema pra impressão térmica.
export function buildInstallmentBookletText(
  tenantName: string,
  customerName: string,
  debtDescription: string,
  installments: BookletInstallment[],
): string {
  const total = installments.length;
  let text = "";
  installments.forEach((inst, idx) => {
    text += "\n";
    text += `${thermalCenter(tenantName.toUpperCase())}\n`;
    text += `${thermalRule}\n${thermalCenter("CARNÊ DE PAGAMENTO")}\n${thermalThin}\n`;
    text += thermalRow("Cliente", customerName) + "\n";
    text += thermalRow("Referente a", debtDescription) + "\n";
    text += `${thermalThin}\n`;
    text += thermalRow("Parcela", `${inst.number}/${total}`) + "\n";
    text += thermalRow("Vencimento", formatDueDate(inst.due_date)) + "\n";
    text += `${thermalRule}\n`;
    // amount chega como string quando serializado a partir de um Decimal do
    // Prisma (ex.: "27.46") — Number() normaliza antes de formatar.
    text += thermalRow("VALOR", `R$ ${thermalMoney(Number(inst.amount))}`) + "\n";
    text += `${thermalRule}\n\n`;
    text += "Assinatura: ________________________\n";
    text += "\n";
    // Linha de corte entre canhotos — não corta depois do último.
    if (idx < installments.length - 1) {
      text += `${"- ".repeat(Math.floor(W / 2))}\n\n\n`;
    } else {
      text += "\n\n";
    }
  });
  return text;
}

export function buildThermalHtml(text: string, title: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { margin: 0; padding: 0; width: 80mm; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 10px;
      line-height: 1.35;
      width: 80mm;
      padding: 2mm 4mm;
      margin: 0;
      white-space: pre;
      background: white;
      color: black;
    }
    @media print {
      @page { margin: 0; size: 80mm auto; }
      body { margin: 0; padding: 2mm 4mm; width: 80mm; }
    }
  </style>
</head>
<body>${text}</body>
</html>`;
}

function printViaIframe(html: string, delay = 400) {
  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "none" });
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1500);
  }, delay);
}

// Imprime na impressora térmica nativa (app desktop); cai no diálogo do
// navegador (via iframe oculto) quando não há app desktop ou nenhuma
// impressora configurada — mesmo mecanismo de printThermalReceipt em PDV.tsx.
export async function printThermalText(text: string, title: string): Promise<{ ok: boolean; error?: string }> {
  if (window.boxsysDesktop?.printReceipt) {
    const result = await window.boxsysDesktop.printReceipt(text);
    return result;
  }
  printViaIframe(buildThermalHtml(text, title));
  return { ok: true };
}
