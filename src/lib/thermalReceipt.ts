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

// Formato compacto (dd/mm HH:MM, 11 chars) — thermalRow corta o lado direito em
// 15 chars, e "12/09/2026, 16:42:33" (toLocaleString completo) tem 21 chars e
// sempre saía cortado no meio da hora ("16:").
function dateTimeShort(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface CashCloseReceiptPaymentEntry {
  expected: number;
  counted?: number;
  difference?: number;
  fee?: number;
  net?: number;
  sales_amount?: number;
  debt_payment_amount?: number;
}

export interface CashCloseReceiptSession {
  opening_amount: number | string;
  counted_amount: number | string;
  expected_amount: number | string;
  difference_amount: number | string;
  payment_breakdown: Record<string, CashCloseReceiptPaymentEntry> | null;
  opened_at: string;
  closed_at: string | null;
}

// Comprovante impresso ao fechar o caixa — resumo de entradas por forma de
// pagamento (esperado x contado x diferença). Usado tanto no fechamento ao
// vivo (PDV.tsx/PDVStandalone.tsx) quanto na reimpressão a partir do
// Histórico de Caixa — precisa ser o MESMO texto nos dois lugares, por isso
// vive aqui em vez de duplicado em cada tela.
export function buildCashCloseReceiptText(
  tenantName: string,
  operatorName: string,
  session: CashCloseReceiptSession,
  pmLabel: Record<string, string>,
): string {
  let receipt = "\n";
  receipt += `${thermalCenter(tenantName.toUpperCase())}\n`;
  receipt += `${thermalRule}\n${thermalCenter("FECHAMENTO DE CAIXA")}\n${thermalThin}\n`;
  receipt += thermalRow("Operador", operatorName || "-") + "\n";
  receipt += thermalRow("Abertura", dateTimeShort(new Date(session.opened_at))) + "\n";
  receipt += thermalRow("Fechamento", session.closed_at ? dateTimeShort(new Date(session.closed_at)) : "-") + "\n";
  receipt += `${thermalThin}\n`;
  let totalFee = 0;
  if (session.payment_breakdown) {
    receipt += `${thermalThin}\n${thermalCenter("POR FORMA DE PAGAMENTO")}\n${thermalThin}\n`;
    Object.entries(session.payment_breakdown).forEach(([method, entry]) => {
      if (method === "money") {
        const openingAmount = Number(session.opening_amount);
        const salesAmount = entry.sales_amount ?? Math.round((entry.expected - openingAmount) * 100) / 100;
        receipt += `${thermalCenter("DINHEIRO NA GAVETA")}\n`;
        receipt += thermalRow("Fundo inicial (troco)", `R$ ${thermalMoney(openingAmount)}`) + "\n";
        receipt += thermalRow("+ Vendas em dinheiro", `R$ ${thermalMoney(salesAmount)}`) + "\n";
        if (entry.debt_payment_amount) {
          receipt += thermalRow("+ Receb. crediário", `R$ ${thermalMoney(entry.debt_payment_amount)}`) + "\n";
        }
        receipt += thermalRow("= TOTAL ESPERADO", `R$ ${thermalMoney(entry.expected)}`) + "\n";
      } else {
        receipt += thermalRow(pmLabel[method] ?? method, `R$ ${thermalMoney(entry.expected)}`) + "\n";
      }
      if (entry.fee) {
        totalFee += entry.fee;
        receipt += thermalRow("  Taxa maquininha", `-R$ ${thermalMoney(entry.fee)}`) + "\n";
        receipt += thermalRow("  Líquido", `R$ ${thermalMoney(entry.net ?? entry.expected - entry.fee)}`) + "\n";
      }
      if (entry.counted !== undefined) {
        receipt += thermalRow("  Contado", `R$ ${thermalMoney(entry.counted)}`) + "\n";
      }
      if (entry.difference !== undefined && entry.difference !== 0) {
        receipt += thermalRow("  Diferença", `${entry.difference > 0 ? "+" : ""}R$ ${thermalMoney(entry.difference)}`) + "\n";
      }
    });
  }
  receipt += `${thermalRule}\n`;
  receipt += thermalRow("TOTAL ESPERADO", `R$ ${thermalMoney(Number(session.expected_amount))}`) + "\n";
  if (totalFee > 0) {
    receipt += thermalRow("TOTAL TAXAS", `-R$ ${thermalMoney(totalFee)}`) + "\n";
    receipt += thermalRow("TOTAL LÍQUIDO", `R$ ${thermalMoney(Number(session.expected_amount) - totalFee)}`) + "\n";
  }
  receipt += thermalRow("TOTAL CONTADO", `R$ ${thermalMoney(Number(session.counted_amount))}`) + "\n";
  const diff = Number(session.difference_amount);
  receipt += thermalRow(diff === 0 ? "CAIXA CONFERE" : diff > 0 ? "SOBRA" : "FALTA", `R$ ${thermalMoney(Math.abs(diff))}`) + "\n";
  receipt += `${thermalRule}\n\n\n`;
  return receipt;
}

export interface OrderReceiptTenant {
  name?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  document?: string | null;
}

export interface OrderReceiptItem {
  product_name: string;
  quantity: number;
  unit_price: number | string;
}

export interface OrderReceiptOrder {
  id: number;
  created_at: string;
  customer_name?: string | null;
  seller_name?: string | null;
  items: OrderReceiptItem[];
  payment_method?: string | null;
  gross_amount?: number | string | null;
  discount_amount?: number | string | null;
  fee_amount?: number | string | null;
  surcharge_amount?: number | string | null;
  total_amount: number | string;
}

const ORDER_RECEIPT_PM_LABEL: Record<string, string> = { money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito", crediario: "Crediário" };

function parseOrderReceiptPayments(raw?: string | null) {
  if (!raw) return [{ method: "", label: "Não informado", installments: 1, amount: 0 }];
  return raw.split("|").map((seg) => {
    const [methodPart, amountStr] = seg.trim().split(":");
    const tokens = (methodPart ?? "").split("-");
    const method = tokens[0]?.toLowerCase() ?? "";
    const installments = tokens[2] ? parseInt(tokens[2].replace("x", ""), 10) || 1 : 1;
    const amount = Number(amountStr) || 0;
    return { method, label: ORDER_RECEIPT_PM_LABEL[method] ?? (method ? method.charAt(0).toUpperCase() + method.slice(1) : "—"), installments, amount };
  });
}

// Cupom de venda — mesmo texto/formato de 42 colunas que sai impresso de
// verdade na hora da venda (PDV.tsx). Extraído aqui pra ser compartilhado
// entre a reimpressão em Pedidos (Orders.tsx) e o link "Imprimir Cupom" no
// Fluxo de Caixa (Finance.tsx), que antes não tinha esse botão — sem essa
// função única, os dois lugares divergiam do cupom real do PDV.
export function buildOrderReceiptText(tenant: OrderReceiptTenant | null | undefined, order: OrderReceiptOrder): string {
  const orderId = `#${String(order.id).padStart(6, "0")}`;
  const dateTime = new Date(order.created_at).toLocaleString("pt-BR");

  let receipt = "\n";
  receipt += `${thermalCenter((tenant?.name || "").toUpperCase())}\n`;
  if (tenant?.address_street) {
    const addr = [tenant.address_street, tenant.address_number].filter(Boolean).join(", ");
    if (addr) receipt += `${thermalCenter(addr)}\n`;
  }
  if (tenant?.document) receipt += `${thermalCenter(`CNPJ: ${tenant.document}`)}\n`;
  receipt += `${thermalRow(dateTime, `COO: ${orderId}`)}\n${thermalRule}\n`;
  receipt += `${thermalCenter("CUPOM")}\n${thermalThin}\n`;
  receipt += "ITEM  DESCRIÇÃO\n";
  receipt += "      QTD  X UNITÁRIO       VALOR (R$)\n";
  receipt += `${thermalThin}\n`;
  order.items.forEach((item, idx) => {
    receipt += `${String(idx + 1).padStart(3, "0")}   ${truncate(item.product_name, 34)}\n`;
    receipt += thermalRow(`      ${item.quantity} UN x ${thermalMoney(Number(item.unit_price))}`, thermalMoney(Number(item.unit_price) * item.quantity)) + "\n";
  });
  receipt += `${thermalThin}\n`;
  receipt += thermalRow("Cliente", order.customer_name || "Consumidor final") + "\n";
  if (order.seller_name) receipt += thermalRow("Vendedor", order.seller_name) + "\n";
  receipt += thermalRow("Qtde. Total Itens", String(order.items.reduce((sum, i) => sum + i.quantity, 0))) + "\n";
  const grossAmount = order.gross_amount != null ? Number(order.gross_amount) : Number(order.total_amount);
  const discountAmount = order.discount_amount ? Number(order.discount_amount) : 0;
  const feeAmount = order.fee_amount ? Number(order.fee_amount) : 0;
  // Pedidos criados antes do campo surcharge_amount existir têm o acréscimo
  // embutido só na diferença gross/total — reconstituído como fallback.
  const surchargeAmount = order.surcharge_amount != null
    ? Number(order.surcharge_amount)
    : (order.gross_amount != null
        ? Number(order.total_amount) - grossAmount - feeAmount + discountAmount
        : 0);
  if (discountAmount > 0 || feeAmount > 0 || surchargeAmount > 0.009) {
    receipt += thermalRow("Subtotal", `R$ ${thermalMoney(grossAmount)}`) + "\n";
  }
  if (discountAmount > 0) receipt += thermalRow("Desconto", `- R$ ${thermalMoney(discountAmount)}`) + "\n";
  if (surchargeAmount > 0.009) receipt += thermalRow("Acréscimo", `+ R$ ${thermalMoney(surchargeAmount)}`) + "\n";
  if (feeAmount > 0) receipt += thermalRow("Taxa Maquininha", `+ R$ ${thermalMoney(feeAmount)}`) + "\n";
  receipt += `${thermalRule}\n${thermalRow("Valor Total R$", thermalMoney(Number(order.total_amount)))}\n${thermalRule}\n`;
  const parsedPayments = parseOrderReceiptPayments(order.payment_method);
  parsedPayments.forEach((p) => {
    const installmentsLabel = p.method === "credit" && p.installments > 1 ? ` ${p.installments}x` : "";
    receipt += thermalRow(`Forma Pagamento: ${p.label}${installmentsLabel}`, `R$ ${thermalMoney(p.amount)}`) + "\n";
  });
  // Troco recalculado da diferença real — não depende de order.change_amount,
  // que pode estar null.
  const paidTotalThermal = parsedPayments.reduce((sum, p) => sum + p.amount, 0);
  const changeThermal = Math.round((paidTotalThermal - Number(order.total_amount)) * 100) / 100;
  if (changeThermal > 0) {
    receipt += thermalRow("Troco R$", thermalMoney(changeThermal)) + "\n";
  }
  receipt += `${thermalThin}\n${thermalCenter("Obrigado pela preferência!")}\n${thermalCenter("Volte sempre!")}\n\n\n`;
  return receipt;
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
