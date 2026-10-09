import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Phone, Mail, MapPin, AlertTriangle, X, Plus, ChevronRight, Trash2,
  DollarSign, Clock, CheckCircle2, FileText, ShoppingBag, StickyNote,
  Edit2, Save, XCircle, Shield, Star, Gift, Award, Loader2, Users,
  AlertCircle, ChevronLeft, CreditCard, Search, Calendar, Printer,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Button, IconButton, Input, Textarea, Select, Modal, ModalFooter, Badge, Alert, EmptyState, ContentCard, PanelCard, DetailField, StatGrid, StatCard, Tabs } from "../../components/ui";
import { useToast } from "../../components/ui/Toast";
import { downloadHtmlAsPdf } from "../../lib/pdf";
import PaymentSegmentsEditor, { PaymentSegment, newPaymentSegment } from "../../components/PaymentSegmentsEditor";
import { buildDebtPaymentReceiptText, buildInstallmentBookletText, buildOrderReceiptText, printThermalText, type ReceiptTenantInfo } from "../../lib/thermalReceipt";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  address?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_district?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  address_country?: string;
  notes?: string;
  credit_limit?: number;
  consignment_limit?: number;
  birth_date?: string;
  risk_flag: boolean;
  risk_reason?: string;
  created_at: string;
  // Dados fiscais preenchidos ao buscar o CNPJ (BrasilAPI)
  legal_name?: string;
  trade_name?: string;
  cnae_code?: string;
  cnae_description?: string;
  legal_nature?: string;
  registration_status?: string;
  registration_status_date?: string;
}

interface DebtPayment {
  id: number;
  amount: number;
  payment_method?: string;
  paid_at: string;
}

interface OrderItem {
  id: number;
  name?: string;
  quantity: number;
  unit_price: number;
}

interface Order {
  id: number;
  total_amount: number;
  gross_amount?: number | null;
  discount_amount?: number | null;
  fee_amount?: number | null;
  surcharge_amount?: number | null;
  payment_method?: string;
  created_at: string;
  items: OrderItem[];
}

interface Installment {
  id: number;
  number: number;
  due_date: string;
  amount: number;
  amount_paid: number;
  status: "open" | "paid";
  paid_at?: string;
}

interface Debt {
  id: number;
  description: string;
  amount: number;
  amount_paid: number;
  installments_count: number;
  due_date?: string;
  paid_at?: string;
  status: "open" | "paid";
  created_at: string;
  order_id?: number | null;
  order?: Order | null;
  payments?: DebtPayment[];
  installments?: Installment[];
}

interface Note {
  id: number;
  body: string;
  created_at: string;
}

interface CustomerDetailData extends Customer {
  debts: Debt[];
  customer_notes: Note[];
  orders: Order[];
  total_debt: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string) => new Date(s).toLocaleDateString("pt-BR");
const todayInputDate = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const authH = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

function isOverdue(due_date?: string) {
  if (!due_date) return false;
  return new Date(due_date) < new Date();
}

// Sugestão de juros pro-rata sobre o valor restante da parcela — sempre calculada na
// hora pra exibir, nunca acumulada automaticamente. `rate` é % ao mês.
function suggestedInterest(remaining: number, due_date: string, rate: number, graceDays: number): number {
  if (rate <= 0) return 0;
  const daysLate = Math.floor((Date.now() - new Date(due_date).getTime()) / 86400000);
  const billableDays = Math.max(0, daysLate - graceDays);
  if (billableDays <= 0) return 0;
  return Math.round(remaining * (rate / 100) * (billableDays / 30) * 100) / 100;
}

// Parser de forma de pagamento — espelha parsePaymentMethod/buildMethodSummary
// do backend (backend/controllers/sales.controller.ts), para exibir de forma
// legível o formato composto "method-brand-installments:amount|...".
const PM_LABELS: Record<string, string> = {
  money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito", crediario: "Crediário",
};

function formatPaymentMethod(pm?: string): string {
  if (!pm) return "—";
  return pm.split("|").map((seg) => {
    const [methodPart] = seg.split(":");
    const tokens = methodPart.split("-");
    const method = tokens[0] ?? "money";
    const brand = tokens[1];
    const installments = tokens[2] ? parseInt(tokens[2].replace("x", ""), 10) : 1;
    const label = PM_LABELS[method] ?? method;
    const b = brand && brand !== "other" ? ` ${brand.toUpperCase()}` : "";
    const i = method === "credit" && installments > 1 ? ` ${installments}x` : "";
    return `${label}${b}${i}`;
  }).join(" + ");
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}

function maskDoc(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4").replace(/-$/, "").replace(/\.{1,}$/, "");
  }
  return d.slice(0, 14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5").replace(/-$/, "").replace(/\/$/, "");
}

// Exibição somente-leitura — aplica a máscara certa (CPF ou CNPJ) conforme o
// tamanho do documento já salvo, sem alterar o valor armazenado.
function displayDoc(v?: string | null): string {
  if (!v) return "";
  return maskDoc(v);
}

function displayPhone(v?: string | null): string {
  if (!v) return "";
  return maskPhone(v);
}

function displayZip(v?: string | null): string {
  const d = (v ?? "").replace(/\D/g, "");
  if (d.length !== 8) return v ?? "";
  return d.replace(/(\d{5})(\d{3})/, "$1-$2");
}

type DetailTab = "summary" | "fiado" | "history" | "notes" | "loyalty";

const DETAIL_TABS = [
  { id: "summary", label: "Resumo", icon: Users },
  { id: "fiado", label: "Crediário / Fiado", icon: DollarSign },
  { id: "history", label: "Compras", icon: ShoppingBag },
  { id: "notes", label: "Notas", icon: StickyNote },
  { id: "loyalty", label: "Pontos", icon: Star },
] as const satisfies readonly { id: DetailTab; label: string; icon: React.ElementType }[];

export default function CustomerDetail() {
  const toast = useToast();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const customerId = Number(id);

  // Permite chegar aqui já na aba certa via link (ex.: "Ver Crediário" a partir
  // de Contas a Receber) — `?tab=fiado` abre direto na aba de fiado em vez de
  // sempre cair no resumo.
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [detail, setDetail] = useState<CustomerDetailData | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>(
    initialTab === "fiado" || initialTab === "history" || initialTab === "notes" || initialTab === "loyalty"
      ? initialTab
      : "summary"
  );
  const [loadingDetail, setLoadingDetail] = useState(true);

  // Debt form
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [dDesc, setDDesc] = useState("");
  const [dAmt, setDAmt] = useState("");
  const [dDue, setDDue] = useState("");
  const [savingDebt, setSavingDebt] = useState(false);

  // Debt payment (chevron + pagamento parcial)
  const [expandedDebtId, setExpandedDebtId] = useState<number | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [selectedDebtIds, setSelectedDebtIds] = useState<Set<number>>(new Set());
  const [payAmounts, setPayAmounts] = useState<Record<number, string>>({});
  const [paySegments, setPaySegments] = useState<PaymentSegment[]>([newPaymentSegment()]);
  const [debtPaymentDate, setDebtPaymentDate] = useState(todayInputDate);
  const [payingDebts, setPayingDebts] = useState(false);
  const [payDebtsError, setPayDebtsError] = useState<string | null>(null);

  // Parcelas do crediário
  const [selectedInstallmentIds, setSelectedInstallmentIds] = useState<Set<number>>(new Set());
  const [installmentPayAmounts, setInstallmentPayAmounts] = useState<Record<number, string>>({});
  const [installmentPaySegments, setInstallmentPaySegments] = useState<Record<number, PaymentSegment[]>>({});
  const [payingInstallmentId, setPayingInstallmentId] = useState<number | null>(null);
  const [payInstallmentError, setPayInstallmentError] = useState<Record<number, string>>({});

  // Estorno de pagamento (operador marcou por engano) — pede confirmação antes de
  // reverter, já que desfaz um pagamento real e cria um lançamento de estorno no
  // financeiro.
  const [reversingPaymentId, setReversingPaymentId] = useState<number | null>(null);
  const [reconfigureDebtId, setReconfigureDebtId] = useState<number | null>(null);
  const [reconfigureCount, setReconfigureCount] = useState("1");
  const [reconfigureFirstDue, setReconfigureFirstDue] = useState("");
  const [reconfiguring, setReconfiguring] = useState(false);

  // Juros de crediário (configurado em Settings, aplicado manualmente por parcela)
  const [sendingDebtEmailKey, setSendingDebtEmailKey] = useState<string | null>(null);
  const [crediarioInterestRate, setCrediarioInterestRate] = useState(0);
  const [crediarioGraceDays, setCrediarioGraceDays] = useState(0);
  const [applyingInterestId, setApplyingInterestId] = useState<number | null>(null);

  // Taxa de maquininha/bandeiras/parcelas — mesma config usada no checkout do PDV,
  // reaproveitada aqui pra calcular a taxa quando o pagamento de fiado é no cartão.
  const [cardFees, setCardFees] = useState<Record<string, number[]>>({});
  const [maxInstallments, setMaxInstallments] = useState(1);
  const [enabledBrands, setEnabledBrands] = useState<Record<string, boolean>>({});
  const [tenantName, setTenantName] = useState("Loja");
  const [tenantInfo, setTenantInfo] = useState<ReceiptTenantInfo>({ name: "Loja" });

  // Note form
  const [noteBody, setNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Loyalty
  interface PointEntry { id: number; delta: number; balance_after: number; description?: string; created_at: string; }
  interface LoyaltyReward { id: number; name: string; type: string; discount_value?: number; discount_type?: string; product_id?: number; points_cost: number; is_active: boolean; }
  const [loyaltyBalance, setLoyaltyBalance] = useState<number>(0);
  const [loyaltyEntries, setLoyaltyEntries] = useState<PointEntry[]>([]);
  const [loyaltyRewards, setLoyaltyRewards] = useState<LoyaltyReward[]>([]);
  const [loyaltyProgram, setLoyaltyProgram] = useState<{ spend_per_point: number; is_active: boolean } | null>(null);
  const [pointAdj, setPointAdj] = useState("");
  const [pointDesc, setPointDesc] = useState("");
  const [savingPoints, setSavingPoints] = useState(false);
  const [redeemingId, setRedeemingId] = useState<number | null>(null);
  const [pointOrderDetail, setPointOrderDetail] = useState<Order | null>(null);

  const fetchDetail = useCallback(async (custId: number) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/customers/${custId}`, { headers: authH() });
      const data = await res.json();
      setDetail(data);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const fetchLoyalty = useCallback(async (custId: number) => {
    const [ptRes, pgRes, rwRes] = await Promise.all([
      fetch(`/api/loyalty/customers/${custId}/points`, { headers: authH() }),
      fetch("/api/loyalty/program", { headers: authH() }),
      fetch("/api/loyalty/rewards", { headers: authH() }),
    ]);
    const pt = await ptRes.json();
    const pg = await pgRes.json();
    const rw = await rwRes.json();
    setLoyaltyBalance(pt.balance ?? 0);
    setLoyaltyEntries(pt.entries ?? []);
    setLoyaltyProgram({ spend_per_point: Number(pg.spend_per_point ?? 10), is_active: pg.is_active ?? false });
    setLoyaltyRewards(Array.isArray(rw) ? rw.filter((r: LoyaltyReward) => r.is_active) : []);
  }, []);

  useEffect(() => {
    if (customerId) fetchDetail(customerId);
  }, [customerId, fetchDetail]);

  // Taxa de juros configurada em Configurações > Crediário & Juros — só usada
  // pra calcular a sugestão exibida numa parcela vencida; nada é cobrado sozinho.
  useEffect(() => {
    fetch("/api/tenant", { headers: authH() })
      .then((r) => r.json())
      .then((d) => {
        setCrediarioInterestRate(Number(d?.crediario_interest_rate) || 0);
        setCrediarioGraceDays(Number(d?.crediario_grace_days) || 0);
        if (d?.card_fees) setCardFees(d.card_fees);
        if (d?.max_installments) setMaxInstallments(Number(d.max_installments));
        if (d?.enabled_brands) setEnabledBrands(d.enabled_brands as Record<string, boolean>);
        if (d?.name) setTenantName(d.name);
        if (d) setTenantInfo({
          name: d.name, document: d.document, phone: d.whatsapp,
          address_street: d.address_street, address_number: d.address_number,
          address_district: d.address_district, address_city: d.address_city, address_state: d.address_state,
        });
      })
      .catch(() => {});
  }, []);

  function handleDelete() {
    if (!detail) return;
    setConfirmDialog({
      title: "Excluir cliente",
      message: "Excluir este cliente? Todas as dívidas e notas serão removidas.",
      onConfirm: async () => {
        await fetch(`/api/customers/${detail.id}`, { method: "DELETE", headers: authH() });
        navigate("/admin/customers");
      },
    });
  }

  // ── debt actions

  async function handleAddDebt() {
    if (!detail || !dDesc.trim() || !dAmt) return;
    setSavingDebt(true);
    try {
      await fetch(`/api/customers/${detail.id}/debts`, {
        method: "POST", headers: authH(),
        body: JSON.stringify({ description: dDesc, amount: Number(dAmt), due_date: dDue || null }),
      });
      setDDesc(""); setDAmt(""); setDDue("");
      setShowDebtForm(false);
      await fetchDetail(detail.id);
    } finally { setSavingDebt(false); }
  }

  function openDebtPayment(debtId: number, remaining: number) {
    // Um recebimento por vez deixa o fluxo do caixa claro: dívida escolhida,
    // forma de pagamento e valor recebido. O valor pode ser editado para uma
    // baixa parcial sem jamais quitar o saldo inteiro automaticamente.
    setSelectedDebtIds(new Set([debtId]));
    setPayAmounts({ [debtId]: remaining.toFixed(2) });
    setPaySegments([newPaymentSegment(remaining.toFixed(2))]);
    setDebtPaymentDate(todayInputDate());
    setPayDebtsError(null);
  }

  function cancelDebtPayment() {
    setSelectedDebtIds(new Set());
    setPayAmounts({});
    setPaySegments([newPaymentSegment()]);
    setPayDebtsError(null);
  }

  async function handlePaySelectedDebts() {
    if (!detail || selectedDebtIds.size === 0) return;
    setPayingDebts(true);
    setPayDebtsError(null);
    try {
      const payments = paySegments
        .filter((s) => (Number(s.amount) || 0) > 0)
        .map((s) => ({ method: s.method, brand: s.cardBrand, installments: s.installments, amount: Math.round(Number(s.amount) * 100) / 100 }));
      if (payments.length === 0) { setPayDebtsError("Informe ao menos uma forma de pagamento"); return; }

      const selectedDebts = Array.from(selectedDebtIds).map((debtId) => {
        const debt = detail.debts.find((item) => item.id === debtId);
        const remaining = debt ? Number(debt.amount) - Number(debt.amount_paid ?? 0) : 0;
        const requested = Number(payAmounts[debtId] ?? 0);
        return { debtId, amount: Math.min(Math.max(0, requested), remaining) };
      }).filter((debt) => debt.amount > 0);

      const requestedTotal = selectedDebts.reduce((sum, debt) => sum + debt.amount, 0);
      const receivedTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
      if (receivedTotal > requestedTotal + 0.005) {
        setPayDebtsError("O valor recebido é maior que o total selecionado das dívidas.");
        return;
      }

      // Consome exatamente o que foi recebido. Quando o pagamento é parcial,
      // o restante da dívida permanece em aberto; nunca se aumenta o valor dos
      // segmentos para quitar uma dívida inteira.
      const pendingPayments = payments.map((payment) => ({ ...payment }));
      let remainingToAllocate = Math.round(receivedTotal * 100) / 100;

      for (const { debtId, amount } of selectedDebts) {
        if (remainingToAllocate <= 0.005) break;
        let amountForDebt = Math.min(amount, remainingToAllocate);
        const debtPayments: typeof payments = [];

        for (const payment of pendingPayments) {
          if (amountForDebt <= 0.005) break;
          if (payment.amount <= 0.005) continue;

          const allocated = Math.min(payment.amount, amountForDebt);
          debtPayments.push({ ...payment, amount: Math.round(allocated * 100) / 100 });
          payment.amount = Math.round((payment.amount - allocated) * 100) / 100;
          amountForDebt = Math.round((amountForDebt - allocated) * 100) / 100;
        }

        if (debtPayments.length === 0) break;
        // Cada chamada recebe somente a parcela efetivamente alocada. Antes,
        // a escala podia transformar R$ 500 recebidos em baixa de R$ 1.000.
        const res = await fetch(`/api/customers/${detail.id}/debts/${debtId}/pay-multi`, {
          method: "POST", headers: authH(),
          body: JSON.stringify({ payments: debtPayments, paid_at: debtPaymentDate }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setPayDebtsError(data.error || "Falha ao registrar pagamento");
          return;
        }
        const allocatedTotal = debtPayments.reduce((sum, payment) => sum + payment.amount, 0);
        remainingToAllocate = Math.round((remainingToAllocate - allocatedTotal) * 100) / 100;
      }
      setSelectedDebtIds(new Set());
      setPayAmounts({});
      setPaySegments([newPaymentSegment()]);
      await fetchDetail(detail.id);
    } finally {
      setPayingDebts(false);
    }
  }

  function toggleInstallmentSelection(installmentId: number, checked: boolean, remaining: number) {
    setSelectedInstallmentIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(installmentId); else next.delete(installmentId);
      return next;
    });
    if (checked) {
      setInstallmentPayAmounts((prev) => ({ ...prev, [installmentId]: prev[installmentId] ?? remaining.toFixed(2) }));
      setDebtPaymentDate(todayInputDate());
    }
  }

  async function handlePayInstallment(debtId: number, installmentId: number, installmentNumber: number, amount: number) {
    if (!detail || amount <= 0) return;
    setPayingInstallmentId(installmentId);
    setPayInstallmentError((prev) => { const next = { ...prev }; delete next[installmentId]; return next; });
    try {
      const segments = installmentPaySegments[installmentId] ?? [newPaymentSegment(amount.toFixed(2))];
      const payments = segments
        .filter((s) => (Number(s.amount) || 0) > 0)
        .map((s) => ({ method: s.method, brand: s.cardBrand, installments: s.installments, amount: Number(s.amount) }));
      if (payments.length === 0) {
        setPayInstallmentError((prev) => ({ ...prev, [installmentId]: "Informe ao menos uma forma de pagamento" }));
        return;
      }
      const res = await fetch(`/api/customers/${detail.id}/debts/${debtId}/pay-multi`, {
        method: "POST", headers: authH(),
        body: JSON.stringify({ payments, installment_id: installmentId, paid_at: debtPaymentDate }),
      });
      if (res.ok) {
        const methodLabel = payments.length > 1 ? "Múltiplas formas" : PM_LABELS[payments[0].method] ?? payments[0].method;
        const debt = detail.debts.find((item) => item.id === debtId);
        const totalOpenBeforePayment = debt?.installments?.reduce(
          (sum, item) => sum + Math.max(0, Number(item.amount) - Number(item.amount_paid || 0)), 0
        ) ?? amount;
        const receipt = buildDebtPaymentReceiptText(tenantInfo, {
          customerName: detail.name,
          debtDescription: debt?.description || "Crediário",
          installmentNumber,
          installmentsTotal: debt?.installments?.length || installmentNumber,
          amount,
          paymentMethod: methodLabel,
          remainingBalance: totalOpenBeforePayment - amount,
          paidAt: new Date(`${debtPaymentDate}T12:00:00`),
        });
        await printThermalText(receipt, `Pagamento de parcela — ${detail.name}`);
      } else {
        const data = await res.json().catch(() => ({}));
        setPayInstallmentError((prev) => ({ ...prev, [installmentId]: data.error || "Falha ao registrar pagamento" }));
        return;
      }
      setSelectedInstallmentIds((prev) => { const next = new Set(prev); next.delete(installmentId); return next; });
      setInstallmentPayAmounts((prev) => { const next = { ...prev }; delete next[installmentId]; return next; });
      setInstallmentPaySegments((prev) => { const next = { ...prev }; delete next[installmentId]; return next; });
      await fetchDetail(detail.id);
    } finally {
      setPayingInstallmentId(null);
    }
  }

  // Aplica juros a uma parcela vencida — ação manual e explícita, sempre com
  // confirmação (não tem "desfazer" nesta versão).
  async function handleApplyInterest(debtId: number, installmentId: number, suggested: number) {
    if (!detail || suggested <= 0) return;
    if (!window.confirm(`Aplicar R$ ${suggested.toFixed(2)} de juros a esta parcela? Isso não pode ser desfeito automaticamente.`)) return;
    setApplyingInterestId(installmentId);
    try {
      await fetch(`/api/customers/${detail.id}/debts/${debtId}/installments/${installmentId}/apply-interest`, {
        method: "POST", headers: authH(),
        body: JSON.stringify({ interest_amount: suggested }),
      });
      await fetchDetail(detail.id);
    } finally {
      setApplyingInterestId(null);
    }
  }

  async function downloadInstallmentBooklet(debt: Debt) {
    if (!detail || !debt.installments?.length) return;
    const rows = debt.installments.map((inst) => {
      const remaining = Number(inst.amount) - Number(inst.amount_paid ?? 0);
      return `<tr>
        <td>${inst.number}/${debt.installments!.length}</td>
        <td>${fmtDate(inst.due_date)}</td>
        <td>${fmt(Number(inst.amount))}</td>
        <td>${inst.status === "paid" ? "PAGA" : isOverdue(inst.due_date) ? "VENCIDA" : "ABERTA"}</td>
        <td>${inst.status === "paid" ? "—" : fmt(remaining)}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Carnê — ${debt.description}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; color: #1e293b; padding: 24px; }
  h1 { font-size: 16px; margin-bottom: 2px; }
  .sub { font-size: 12px; color: #64748b; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
  th { background: #f1f5f9; text-transform: ; font-size: 10px; letter-spacing: 0.05em; }
  .total { margin-top: 16px; font-size: 13px; font-weight: bold; text-align: right; }
</style></head>
<body>
  <h1>Carnê de Pagamento — ${detail.name}</h1>
  <p class="sub">${debt.description} · Total ${fmt(Number(debt.amount))} em ${debt.installments.length}x</p>
  <table>
    <thead><tr><th>Parcela</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Saldo</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="total">Total: ${fmt(Number(debt.amount))}</p>
</body></html>`;

    await downloadHtmlAsPdf(html, `carne-${detail.name.replace(/\s+/g, "-").toLowerCase()}-${debt.id}.pdf`);
  }

  // Imprime o carnê de verdade na impressora térmica — um canhoto por parcela
  // ainda em aberto (reimpressão não repete parcelas já pagas), mesmo template
  // usado no PDV logo após fechar uma venda parcelada.
  const paymentHistory = (detail?.debts ?? [])
    .flatMap((debt) => (debt.payments ?? []).map((payment) => ({ debt, payment })))
    .sort((a, b) => new Date(b.payment.paid_at).getTime() - new Date(a.payment.paid_at).getTime() || b.payment.id - a.payment.id);

  // Reimpressão do comprovante de um pagamento de crediário (mesmo cupom emitido na baixa).
  async function printDebtPaymentReceipt(debt: Debt, payment: DebtPayment) {
    if (!detail) return;
    const ordered = [...(debt.payments ?? [])].sort((a, b) => new Date(a.paid_at).getTime() - new Date(b.paid_at).getTime() || a.id - b.id);
    const paidUntil = ordered.slice(0, ordered.findIndex((x) => x.id === payment.id) + 1).reduce((sum, x) => sum + Number(x.amount), 0);
    const receipt = buildDebtPaymentReceiptText(tenantInfo, {
      customerName: detail.name,
      debtDescription: debt.description || "Crediário",
      installmentNumber: 0,
      installmentsTotal: debt.installments?.length ?? 0,
      amount: Number(payment.amount),
      paymentMethod: payment.payment_method ? PM_LABELS[payment.payment_method] ?? payment.payment_method : "Não informado",
      remainingBalance: Number(debt.amount) - paidUntil,
      paidAt: new Date(payment.paid_at),
    });
    await printThermalText(receipt, `Recibo de pagamento — ${detail.name}`);
  }

  // Envio por e-mail (pelo modo de envio configurado na loja) do comprovante de um pagamento
  // ou, sem payment, do extrato do crediário. Se o cliente não tem e-mail, pede um na hora.
  async function sendDebtEmail(debt: Debt, payment?: DebtPayment) {
    if (!detail) return;
    const key = payment ? `p${payment.id}` : `d${debt.id}`;
    let email: string | undefined;
    if (!detail.email?.trim()) {
      const typed = window.prompt("Este cliente não tem e-mail cadastrado. Informe o e-mail para enviar:");
      if (!typed) return;
      email = typed.trim();
    }
    setSendingDebtEmailKey(key);
    try {
      const res = await fetch(`/api/customers/${detail.id}/debts/${debt.id}/send-email`, {
        method: "POST",
        headers: authH(),
        body: JSON.stringify({ payment_id: payment?.id, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data?.error || "Não foi possível enviar o e-mail."); return; }
      toast.success(`${payment ? "Comprovante" : "Extrato"} enviado para ${data.recipient}.`);
    } catch {
      toast.error("Erro de conexão ao enviar o e-mail.");
    } finally {
      setSendingDebtEmailKey(null);
    }
  }

  // Reimpressão do cupom de venda — mesmo cupom do PDV (Reimprimir Venda).
  async function printOrderReceipt(order: Order) {
    if (!detail) return;
    await printThermalText(buildOrderReceiptText(tenantInfo, {
      id: order.id,
      created_at: order.created_at,
      customer_name: detail.name,
      items: order.items.map((it) => ({ product_name: it.name ?? `Item #${it.id}`, quantity: it.quantity, unit_price: it.unit_price })),
      payment_method: order.payment_method,
      gross_amount: order.gross_amount,
      discount_amount: order.discount_amount,
      fee_amount: order.fee_amount,
      surcharge_amount: order.surcharge_amount,
      total_amount: order.total_amount,
    }), "Comprovante");
  }

  async function printInstallmentBooklet(debt: Debt) {
    if (!detail || !debt.installments?.length) return;
    const openInstallments = debt.installments.filter((i) => i.status !== "paid");
    if (openInstallments.length === 0) return;
    const text = buildInstallmentBookletText(tenantName, detail.name, debt.description, openInstallments);
    await printThermalText(text, `Carnê — ${debt.description}`);
  }

  function openReconfigure(debt: Debt) {
    setReconfigureDebtId(debt.id);
    setReconfigureCount(String(debt.installments_count || 1));
    const firstDue = debt.installments?.[0]?.due_date;
    setReconfigureFirstDue(firstDue ? firstDue.slice(0, 10) : "");
  }

  async function handleReconfigureInstallments() {
    if (!detail || !reconfigureDebtId || !reconfigureFirstDue) return;
    setReconfiguring(true);
    try {
      await fetch(`/api/customers/${detail.id}/debts/${reconfigureDebtId}/installments`, {
        method: "PUT", headers: authH(),
        body: JSON.stringify({ installments_count: Number(reconfigureCount) || 1, first_due_date: reconfigureFirstDue }),
      });
      setReconfigureDebtId(null);
      await fetchDetail(detail.id);
    } finally {
      setReconfiguring(false);
    }
  }

  function handleDeleteDebt(debtId: number) {
    if (!detail) return;
    const customerId = detail.id;
    setConfirmDialog({
      title: "Remover fiado",
      message: "Remover esta dívida?",
      onConfirm: async () => {
        await fetch(`/api/customers/${customerId}/debts/${debtId}`, { method: "DELETE", headers: authH() });
        await fetchDetail(customerId);
      },
    });
  }

  function handleReversePayment(debtId: number, paymentId: number, amount: number) {
    if (!detail) return;
    const customerId = detail.id;
    setConfirmDialog({
      title: "Estornar pagamento",
      message: `Reverter este pagamento de ${fmt(amount)}? A dívida/parcela volta a ficar em aberto e um lançamento de estorno é criado no financeiro. Não pode ser desfeito automaticamente.`,
      onConfirm: async () => {
        setReversingPaymentId(paymentId);
        try {
          const res = await fetch(`/api/customers/${customerId}/debts/${debtId}/payments/${paymentId}/reverse`, {
            method: "POST", headers: authH(),
          });
          if (res.ok) await fetchDetail(customerId);
        } finally {
          setReversingPaymentId(null);
        }
      },
    });
  }

  // ── note actions

  async function handleAddNote() {
    if (!detail || !noteBody.trim()) return;
    setSavingNote(true);
    try {
      await fetch(`/api/customers/${detail.id}/notes`, {
        method: "POST", headers: authH(),
        body: JSON.stringify({ body: noteBody }),
      });
      setNoteBody("");
      await fetchDetail(detail.id);
    } finally { setSavingNote(false); }
  }

  function handleDeleteNote(noteId: number) {
    if (!detail) return;
    const customerId = detail.id;
    setConfirmDialog({
      title: "Remover nota",
      message: "Remover esta nota?",
      onConfirm: async () => {
        await fetch(`/api/customers/${customerId}/notes/${noteId}`, { method: "DELETE", headers: authH() });
        await fetchDetail(customerId);
      },
    });
  }

  if (loadingDetail && !detail) {
    return (
      <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
        <Loader2 size={18} className="animate-spin" />Carregando cliente…
      </div>
    );
  }

  if (!detail) {
    return (
      <ContentCard>
        <EmptyState
          icon={Users}
          title="Cliente não encontrado"
          description="O cadastro pode ter sido removido."
          action={<Button variant="outline" size="sm" onClick={() => navigate("/admin/customers")}>Voltar para Clientes</Button>}
        />
      </ContentCard>
    );
  }

  // debts vinculadas a cada order (para o badge de crediário na aba Compras)
  const debtByOrderId = new Map(detail.debts.filter((d) => d.order_id).map((d) => [d.order_id as number, d]));
  const detailTabItems = DETAIL_TABS.map((t) =>
    t.id === "fiado" ? { ...t, badge: detail.debts.filter((d) => d.status === "open").length }
    : t.id === "history" ? { ...t, badge: detail.orders.length }
    : t.id === "notes" ? { ...t, badge: detail.customer_notes.length }
    : t
  );
  const contactLinkClass = "inline-flex h-8 min-w-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50";
  const fieldsClass = "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6";

  return (
    <div className="mx-auto min-w-0 w-full max-w-[1600px] space-y-4">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" iconLeft={<ChevronLeft size={14} />} onClick={() => navigate("/admin/customers")}>
          Voltar para Clientes
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" iconLeft={<Edit2 size={13} />} onClick={() => navigate(`/admin/customers/${customerId}/editar`)}>Editar</Button>
          <Button variant="danger" size="sm" iconLeft={<Trash2 size={13} />} onClick={handleDelete}>Excluir</Button>
        </div>
      </div>

      {/* Cabeçalho da entidade */}
      <ContentCard padding="md">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <div className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border text-xl font-semibold",
            detail.risk_flag ? "border-rose-200 bg-rose-50 text-rose-600" : "border-blue-100 bg-blue-50 text-blue-700"
          )}>
            {detail.name[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words text-base font-semibold text-slate-900 sm:text-lg">{detail.name}</h1>
              {detail.risk_flag && <Badge dot color="danger" icon={<AlertTriangle size={10} />}>Risco</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {["Ficha completa do cliente", detail.document ? displayDoc(detail.document) : "", [detail.address_city, detail.address_state].filter(Boolean).join(" / ")].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
            {detail.phone && (
              <a href={`tel:${detail.phone}`} className={contactLinkClass}>
                <Phone size={12} className="shrink-0" /> <span className="truncate">{displayPhone(detail.phone)}</span>
              </a>
            )}
            {detail.email && (
              <a href={`mailto:${detail.email}`} className={contactLinkClass}>
                <Mail size={12} className="shrink-0" /> <span className="truncate">{detail.email}</span>
              </a>
            )}
          </div>
        </div>

        {(detail.total_debt > 0 || detail.risk_reason) && (
          <div className="mt-3 space-y-2">
            {detail.total_debt > 0 && (
              <Alert variant="error">Deve {fmt(detail.total_debt)} em aberto (Crediário/Fiado)</Alert>
            )}
            {detail.risk_reason && (
              <Alert variant="warning" title="Motivo do risco">{detail.risk_reason}</Alert>
            )}
          </div>
        )}
      </ContentCard>

      {/* Detail tabs */}
      <Tabs<DetailTab>
        items={detailTabItems}
        value={detailTab}
        onChange={(t) => { setDetailTab(t); if (t === "loyalty") fetchLoyalty(detail.id); }}
        label="Detalhes do cliente"
      >
        {/* ─ SUMMARY ─ */}
        {detailTab === "summary" && (
          <div className="space-y-3">
            <StatGrid cols={4}>
              <StatCard title="Total de Compras" value={detail.orders.length} icon={ShoppingBag} color="info" />
              <StatCard title="Gasto Total" value={fmt(detail.orders.reduce((s, o) => s + Number(o.total_amount), 0))} icon={DollarSign} color="success" />
              <StatCard title="Em Aberto" value={fmt(Number(detail.total_debt))} icon={AlertCircle} color="danger" />
              <StatCard title="Limite de Crédito" value={detail.credit_limit ? fmt(Number(detail.credit_limit)) : "Não definido"} icon={CreditCard} color="purple" />
            </StatGrid>

            <PanelCard
              title="Dados do cliente"
              description="Informações salvas no cadastro"
              action={<Button variant="outline" size="xs" iconLeft={<Edit2 size={12} />} onClick={() => navigate(`/admin/customers/${customerId}/editar`)}>Editar</Button>}
            >
              <dl className={fieldsClass}>
                <DetailField label="Telefone" value={displayPhone(detail.phone)} />
                <DetailField label="E-mail" value={detail.email} />
                <DetailField label="CPF/CNPJ" value={displayDoc(detail.document)} />
                <DetailField label="Aniversário" value={detail.birth_date ? fmtDate(detail.birth_date) : ""} />
                <DetailField label="Cliente desde" value={fmtDate(detail.created_at)} />
              </dl>
              {detail.legal_name && (
                <>
                  <h3 className="mb-2 mt-4 text-xs font-semibold text-slate-700">Dados fiscais</h3>
                  <dl className={fieldsClass}>
                    <DetailField label="Razão Social" value={detail.legal_name} />
                    <DetailField label="Situação Cadastral" value={detail.registration_status} />
                    <DetailField
                      label="CNAE Principal"
                      value={detail.cnae_description ? `${detail.cnae_code ? `${detail.cnae_code} — ` : ""}${detail.cnae_description}` : ""}
                    />
                  </dl>
                </>
              )}
            </PanelCard>

            <PanelCard title="Limites e situação" icon={CreditCard}>
              <dl className={fieldsClass}>
                <DetailField label="Limite de crédito" value={detail.credit_limit ? fmt(Number(detail.credit_limit)) : "Não definido"} />
                <DetailField label="Limite de consignação" value={detail.consignment_limit ? fmt(Number(detail.consignment_limit)) : "Não definido"} />
              </dl>
            </PanelCard>

            <PanelCard title="Endereço" icon={MapPin}>
              {(detail.address_street || detail.address) ? (
                <dl className={fieldsClass}>
                  <DetailField label="Logradouro" value={detail.address_street || detail.address} />
                  <DetailField label="Número / complemento" value={[detail.address_number, detail.address_complement].filter(Boolean).join(" · ")} />
                  <DetailField label="Bairro" value={detail.address_district} />
                  <DetailField label="Cidade / UF" value={[detail.address_city, detail.address_state].filter(Boolean).join(" / ")} />
                  <DetailField label="CEP" value={displayZip(detail.address_zip)} />
                  <DetailField label="País" value={detail.address_country || "Brasil"} />
                </dl>
              ) : (
                <p className="py-2 text-xs text-slate-500">Nenhum endereço cadastrado.</p>
              )}
            </PanelCard>

            <PanelCard title="Preferências" icon={StickyNote}>
              <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-700">
                {detail.notes?.trim() || "Nenhuma preferência ou observação cadastrada."}
              </p>
            </PanelCard>
          </div>
        )}

        {/* ─ FIADO / CREDIÁRIO ─ */}
        {detailTab === "fiado" && (
          <div className="space-y-3">
            <PanelCard
              title="Controle de crediário"
              description="Escolha uma dívida para informar valor e forma de pagamento."
              icon={DollarSign}
            >
              <dl className="grid grid-cols-1 gap-x-6">
                <DetailField label="Total em aberto" value={fmt(Number(detail.total_debt))} />
              </dl>
            </PanelCard>
            {!showDebtForm ? (
              <Button variant="outline" fullWidth iconLeft={<Plus size={14} />} onClick={() => setShowDebtForm(true)}>
                Adicionar Fiado Manual
              </Button>
            ) : (
              <PanelCard title="Novo Fiado">
                <div className="space-y-3">
                  <Input aria-label="Descrição do fiado" value={dDesc} onChange={(e) => setDDesc(e.target.value)} placeholder="Descrição (ex: 1 kg de frango)" />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      aria-label="Valor do fiado"
                      type="number" min={0} step="0.01" value={dAmt}
                      onChange={(e) => setDAmt(e.target.value)} placeholder="0,00"
                      addonLeft="R$"
                    />
                    <Input aria-label="Vencimento do fiado" type="date" value={dDue} onChange={(e) => setDDue(e.target.value)} />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowDebtForm(false)}>Cancelar</Button>
                    <Button size="sm" onClick={handleAddDebt} loading={savingDebt} disabled={savingDebt || !dDesc.trim() || !dAmt}>
                      Registrar
                    </Button>
                  </div>
                </div>
              </PanelCard>
            )}

            {detail.debts.length === 0 ? (
              <EmptyState icon={DollarSign} title="Nenhum fiado/crediário registrado" />
            ) : (
              <div className="space-y-2">
                {detail.debts.map((d) => {
                  const remaining = Number(d.amount) - Number(d.amount_paid ?? 0);
                  const isExpanded = expandedDebtId === d.id;
                  const hasOrderItems = !!d.order?.items?.length;
                  const isInstallmentPlan = (d.installments?.length ?? 0) > 1;
                  const hasAnyPayment = (d.installments ?? []).some((i) => Number(i.amount_paid) > 0);
                  const hasPayments = (d.payments?.length ?? 0) > 0;
                  const canExpand = hasOrderItems || isInstallmentPlan || hasPayments;
                  return (
                    <div key={d.id} className={cn(
                      "overflow-hidden rounded-lg border transition-all",
                      d.status === "paid" ? "border-emerald-200 bg-emerald-50" : isOverdue(d.due_date) ? "border-red-200 bg-red-50" : "border-slate-200 bg-white",
                      selectedDebtIds.has(d.id) && "border-violet-300 ring-2 ring-violet-400"
                    )}>
                      <div className="flex items-start gap-3 p-3">
                        <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", d.status === "paid" ? "bg-emerald-100" : "bg-red-100")}>
                          {d.status === "paid" ? <CheckCircle2 size={15} className="text-emerald-600" /> : <Clock size={15} className="text-red-500" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {canExpand && (
                              <button
                                type="button"
                                aria-label={isExpanded ? "Recolher detalhes" : "Expandir detalhes"}
                                onClick={() => setExpandedDebtId(isExpanded ? null : d.id)}
                                className="shrink-0 text-slate-400 hover:text-slate-700"
                              >
                                <ChevronRight size={14} className={cn("transition-transform", isExpanded && "rotate-90")} />
                              </button>
                            )}
                            <p className="break-words text-[13px] font-medium text-slate-800">{d.description}</p>
                            {isInstallmentPlan && <Badge color="warning">{d.installments!.length}x</Badge>}
                          </div>
                          <p className="text-[13px] font-semibold tabular-nums text-red-600">{fmt(remaining)}</p>
                          {Number(d.amount_paid) > 0 && (
                            <p className="text-[11px] font-medium text-emerald-600">Pago: {fmt(Number(d.amount_paid))} de {fmt(Number(d.amount))}</p>
                          )}
                          <div className="mt-0.5 flex flex-wrap gap-2">
                            <span className="text-[11px] text-slate-500">{fmtDate(d.created_at)}</span>
                            {d.due_date && !isInstallmentPlan && (
                              <span className={cn("text-[11px] font-medium", isOverdue(d.due_date) && d.status === "open" ? "text-red-500" : "text-slate-500")}>
                                Vence: {fmtDate(d.due_date)}{isOverdue(d.due_date) && d.status === "open" && " (vencido)"}
                              </span>
                            )}
                            {d.status === "paid" && d.paid_at && (
                              <span className="text-[11px] font-medium text-emerald-600">Pago em {fmtDate(d.paid_at)}</span>
                            )}
                          </div>
                        </div>
                        {d.status === "open" && (
                          <div className="flex shrink-0 flex-wrap justify-end gap-1">
                            {!isInstallmentPlan && (
                              <Button
                                size="xs"
                                variant={selectedDebtIds.has(d.id) ? "primary" : "success"}
                                iconLeft={<DollarSign size={11} />}
                                onClick={() => selectedDebtIds.has(d.id) ? cancelDebtPayment() : openDebtPayment(d.id, remaining)}
                              >
                                {selectedDebtIds.has(d.id) ? "Recebendo" : "Receber"}
                              </Button>
                            )}
                            {isInstallmentPlan && (
                              <IconButton size="xs" variant="outline" aria-label="Imprimir carnê" title="Imprimir carnê (impressora térmica)" onClick={() => printInstallmentBooklet(d)}>
                                <Printer size={13} />
                              </IconButton>
                            )}
                            {isInstallmentPlan && (
                              <IconButton size="xs" variant="outline" aria-label="Gerar carnê em PDF" title="Gerar carnê (PDF)" onClick={() => downloadInstallmentBooklet(d)}>
                                <FileText size={13} />
                              </IconButton>
                            )}
                            <IconButton size="xs" variant="outline" aria-label="Enviar extrato por e-mail" title="Enviar extrato do crediário por e-mail" loading={sendingDebtEmailKey === `d${d.id}`} onClick={() => sendDebtEmail(d)}>
                              <Mail size={13} />
                            </IconButton>
                            {isInstallmentPlan && !hasAnyPayment && (
                              <IconButton size="xs" variant="outline" aria-label="Reconfigurar parcelas" title="Reconfigurar parcelas" onClick={() => openReconfigure(d)}>
                                <Edit2 size={13} />
                              </IconButton>
                            )}
                            <IconButton size="xs" variant="danger" aria-label="Remover dívida" title="Remover" onClick={() => handleDeleteDebt(d.id)}>
                              <Trash2 size={13} />
                            </IconButton>
                          </div>
                        )}
                      </div>
                      {isExpanded && hasOrderItems && (
                        <div className="space-y-1 border-t border-slate-100 px-3 pb-3 pt-0 pl-14">
                          {d.order!.items.map((it) => (
                            <div key={it.id} className="flex justify-between pt-2 text-[11px] text-slate-600">
                              <span>{it.name ?? `Item #${it.id}`} × {it.quantity}</span>
                              <span className="tabular-nums">{fmt(Number(it.unit_price) * it.quantity)}</span>
                            </div>
                          ))}
                          {(() => {
                            const o = d.order!;
                            const gross = o.gross_amount != null ? Number(o.gross_amount) : null;
                            const discount = o.discount_amount ? Number(o.discount_amount) : 0;
                            const fee = o.fee_amount ? Number(o.fee_amount) : 0;
                            const surcharge = o.surcharge_amount != null
                              ? Number(o.surcharge_amount)
                              : (gross != null ? Number(o.total_amount) - gross - fee + discount : 0);
                            if (discount <= 0 && fee <= 0 && surcharge <= 0.009) return null;
                            return (
                              <div className="mt-1 space-y-0.5 border-t border-slate-100 pt-2">
                                {discount > 0 && (
                                  <div className="flex justify-between text-[11px] text-rose-500">
                                    <span>Desconto</span>
                                    <span className="tabular-nums">− {fmt(discount)}</span>
                                  </div>
                                )}
                                {surcharge > 0.009 && (
                                  <div className="flex justify-between text-[11px] text-amber-600">
                                    <span>Acréscimo</span>
                                    <span className="tabular-nums">+ {fmt(surcharge)}</span>
                                  </div>
                                )}
                                {fee > 0 && (
                                  <div className="flex justify-between text-[11px] text-amber-600">
                                    <span>Taxa Maquininha</span>
                                    <span className="tabular-nums">+ {fmt(fee)}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      {isExpanded && isInstallmentPlan && (
                        <div className="space-y-1.5 border-t border-slate-100 px-3 pb-3 pt-2">
                          {d.installments!.map((inst) => {
                            const instRemaining = Number(inst.amount) - Number(inst.amount_paid ?? 0);
                            const instOverdue = isOverdue(inst.due_date) && inst.status === "open";
                            const suggested = instOverdue
                              ? suggestedInterest(instRemaining, inst.due_date, crediarioInterestRate, crediarioGraceDays)
                              : 0;
                            return (
                              <div key={inst.id} className={cn(
                                "space-y-1.5 rounded-lg border p-2",
                                inst.status === "paid" ? "border-emerald-200 bg-emerald-50" : instOverdue ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"
                              )}>
                              <div className="flex items-center gap-2">
                                {inst.status === "open" && (
                                  <input type="checkbox" checked={selectedInstallmentIds.has(inst.id)}
                                    aria-label={`Selecionar parcela ${inst.number}`}
                                    onChange={(e) => toggleInstallmentSelection(inst.id, e.target.checked, instRemaining)}
                                    className="h-4 w-4 shrink-0 accent-blue-600" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-medium text-slate-700">Parcela {inst.number}/{d.installments!.length}</p>
                                  <p className={cn("text-[11px] font-medium", instOverdue ? "text-red-500" : "text-slate-500")}>
                                    Vence {fmtDate(inst.due_date)}{instOverdue && " (vencida)"}
                                  </p>
                                </div>
                                <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-700">{fmt(instRemaining)}</span>
                                {inst.status !== "open" && <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />}
                              </div>
                              {inst.status === "open" && selectedInstallmentIds.has(inst.id) && (
                                <div className="space-y-2 pt-1">
                                  <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                                    <Input
                                      size="sm"
                                      label="Data do recebimento"
                                      type="date"
                                      value={debtPaymentDate}
                                      max={todayInputDate()}
                                      onChange={(event) => setDebtPaymentDate(event.target.value)}
                                    />
                                    {debtPaymentDate !== todayInputDate() && <p className="mt-1 text-[11px] leading-snug text-amber-700">O histórico e o financeiro usam esta data; caixa fechado não é alterado.</p>}
                                  </div>
                                  <PaymentSegmentsEditor
                                    segments={installmentPaySegments[inst.id] ?? [newPaymentSegment((installmentPayAmounts[inst.id] ?? instRemaining.toFixed(2)))]}
                                    onChange={(segs) => setInstallmentPaySegments((prev) => ({ ...prev, [inst.id]: segs }))}
                                    cardFees={cardFees}
                                    maxInstallments={maxInstallments}
                                    enabledBrands={enabledBrands}
                                    totalToPay={Number(installmentPayAmounts[inst.id] ?? instRemaining)}
                                    allowPartial
                                  />
                                  {payInstallmentError[inst.id] && (
                                    <Alert variant="error">{payInstallmentError[inst.id]}</Alert>
                                  )}
                                  <Button
                                    variant="success"
                                    size="sm"
                                    fullWidth
                                    iconLeft={<CheckCircle2 size={13} />}
                                    loading={payingInstallmentId === inst.id}
                                    disabled={payingInstallmentId === inst.id}
                                    onClick={() => handlePayInstallment(d.id, inst.id, inst.number, (installmentPaySegments[inst.id] ?? []).reduce((s, seg) => s + (Number(seg.amount) || 0), 0) || instRemaining)}
                                  >
                                    Confirmar pagamento
                                  </Button>
                                </div>
                              )}
                                {suggested > 0 && (
                                  <div className="flex items-center justify-between gap-2 border-t border-red-200 pt-1.5">
                                    <p className="text-[11px] font-medium text-red-600">Juros sugerido: {fmt(suggested)}</p>
                                    <Button
                                      variant="danger"
                                      size="xs"
                                      loading={applyingInterestId === inst.id}
                                      disabled={applyingInterestId === inst.id}
                                      onClick={() => handleApplyInterest(d.id, inst.id, suggested)}
                                    >
                                      Aplicar juros
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {isExpanded && hasPayments && (
                        <div className="space-y-1.5 border-t border-slate-100 px-3 pb-3 pt-2">
                          <p className="text-[11px] text-slate-500">Pagamentos registrados</p>
                          {d.payments!.map((p) => (
                            <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold tabular-nums text-slate-700">{fmt(Number(p.amount))}</p>
                                <p className="text-[11px] text-slate-500">
                                  {p.payment_method ? PM_LABELS[p.payment_method] ?? p.payment_method : "—"} · {fmtDate(p.paid_at)}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5">
                              <Button variant="outline" size="xs" title="Imprimir recibo deste pagamento" iconLeft={<Printer size={11} />} onClick={() => printDebtPaymentReceipt(d, p)}>
                                Imprimir recibo
                              </Button>
                              <Button variant="outline" size="xs" title="Enviar comprovante por e-mail" iconLeft={<Mail size={11} />} loading={sendingDebtEmailKey === `p${p.id}`} onClick={() => sendDebtEmail(d, p)}>
                                Enviar por e-mail
                              </Button>
                              <Button
                                variant="danger"
                                size="xs"
                                title="Estornar pagamento"
                                iconLeft={<XCircle size={11} />}
                                loading={reversingPaymentId === p.id}
                                disabled={reversingPaymentId === p.id}
                                onClick={() => handleReversePayment(d.id, p.id, Number(p.amount))}
                              >
                                Estornar
                              </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {paymentHistory.length > 0 && (
              <PanelCard
                title="Histórico de pagamentos"
                description={`${paymentHistory.length} pagamento${paymentHistory.length !== 1 ? "s" : ""} · total recebido ${fmt(paymentHistory.reduce((sum, h) => sum + Number(h.payment.amount), 0))}`}
                contentClassName="p-0"
              >
                <ul className="divide-y divide-slate-100">
                  {paymentHistory.map(({ debt, payment }) => (
                    <li key={`${debt.id}-${payment.id}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <p className="break-words text-xs font-medium text-slate-800">{debt.description}</p>
                        <p className="text-[11px] text-slate-500">
                          {fmtDate(payment.paid_at)} · {payment.payment_method ? PM_LABELS[payment.payment_method] ?? payment.payment_method : "Forma não informada"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold tabular-nums text-emerald-700">{fmt(Number(payment.amount))}</span>
                        <Button variant="outline" size="xs" iconLeft={<Printer size={11} />} onClick={() => printDebtPaymentReceipt(debt, payment)}>
                          Imprimir recibo
                        </Button>
                        <Button variant="outline" size="xs" iconLeft={<Mail size={11} />} loading={sendingDebtEmailKey === `p${payment.id}`} onClick={() => sendDebtEmail(debt, payment)}>
                          Enviar por e-mail
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </PanelCard>
            )}

            {selectedDebtIds.size > 0 && (
              <ContentCard className="sticky bottom-0 space-y-3 border-violet-200">
                {(() => {
                  const debtId = Array.from(selectedDebtIds)[0];
                  const debt = detail.debts.find((item) => item.id === debtId);
                  const remaining = debt ? Number(debt.amount) - Number(debt.amount_paid ?? 0) : 0;
                  const receiving = paySegments.reduce((sum, segment) => sum + (Number(segment.amount) || 0), 0);
                  const afterPayment = Math.max(0, remaining - receiving);
                  return (
                    <div className="flex items-start justify-between gap-3 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-violet-500">Receber pagamento</p>
                        <p className="mt-0.5 truncate text-xs font-semibold text-slate-800">{debt?.description ?? "Dívida selecionada"}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">Em aberto: {fmt(remaining)} · Após esta baixa: {fmt(afterPayment)}</p>
                      </div>
                      <Button variant="outline" size="xs" onClick={cancelDebtPayment}>Cancelar</Button>
                    </div>
                  );
                })()}
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <Input
                    wrapperClassName="max-w-[200px]"
                    label="Data em que o pagamento foi recebido"
                    type="date"
                    value={debtPaymentDate}
                    max={todayInputDate()}
                    onChange={(event) => setDebtPaymentDate(event.target.value)}
                  />
                  {debtPaymentDate !== todayInputDate() && <p className="mt-1.5 text-[11px] leading-snug text-amber-700">Lançamento retroativo: ficará no histórico do crediário e no financeiro da data informada. Um caixa já fechado não será alterado automaticamente.</p>}
                </div>
                <PaymentSegmentsEditor
                  segments={paySegments}
                  onChange={setPaySegments}
                  cardFees={cardFees}
                  maxInstallments={maxInstallments}
                  enabledBrands={enabledBrands}
                  totalToPay={Array.from(selectedDebtIds).reduce((s, id) => s + Number(payAmounts[id] ?? 0), 0)}
                  allowPartial
                />
                {payDebtsError && <Alert variant="error">{payDebtsError}</Alert>}
                <Button
                  variant="success"
                  fullWidth
                  iconLeft={<DollarSign size={14} />}
                  loading={payingDebts}
                  disabled={payingDebts}
                  onClick={handlePaySelectedDebts}
                >
                  {payingDebts ? "Registrando…" : "Confirmar recebimento"}
                </Button>
              </ContentCard>
            )}
          </div>
        )}

        {/* ─ HISTORY ─ */}
        {detailTab === "history" && (
          <div className="space-y-2">
            {detail.orders.length === 0 ? (
              <EmptyState icon={ShoppingBag} title="Nenhuma compra registrada" />
            ) : (
              detail.orders.map((o) => {
                const isExpanded = expandedOrderId === o.id;
                const visibleItems = isExpanded ? o.items : o.items.slice(0, 4);
                const linkedDebt = debtByOrderId.get(o.id);
                return (
                  <ContentCard key={o.id} className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-500">{fmtDate(o.created_at)}</span>
                      <div className="flex flex-wrap items-center gap-2">
                        {linkedDebt && (
                          <span title={linkedDebt.status === "open" ? `Falta pagar ${fmt(Number(linkedDebt.amount) - Number(linkedDebt.amount_paid))}` : "Crediário quitado"}>
                            <Badge color={linkedDebt.status === "open" ? "warning" : "success"} pill icon={<CreditCard size={9} />}>
                              Crediário {linkedDebt.status === "open" ? "aberto" : "pago"}
                            </Badge>
                          </span>
                        )}
                        {o.payment_method && <Badge pill>{formatPaymentMethod(o.payment_method)}</Badge>}
                        <span className="text-[13px] font-semibold tabular-nums text-emerald-700">{fmt(Number(o.total_amount))}</span>
                        <Button variant="outline" size="xs" iconLeft={<Printer size={11} />} onClick={() => printOrderReceipt(o)} title="Imprimir recibo da venda (mesmo cupom do PDV)">
                          Imprimir recibo
                        </Button>
                      </div>
                    </div>
                    {o.items.length > 0 && (
                      <div className="space-y-0.5">
                        {visibleItems.map((it) => (
                          <div key={it.id} className="flex items-center justify-between text-[11px] text-slate-600">
                            <span className="truncate">{it.name ?? `Item #${it.id}`} × {it.quantity}</span>
                            <span className="ml-2 shrink-0 font-medium tabular-nums">{fmt(Number(it.unit_price) * it.quantity)}</span>
                          </div>
                        ))}
                        {o.items.length > 4 && (
                          <button type="button" onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
                            className="flex items-center gap-1 pt-0.5 text-[11px] font-medium text-blue-600 transition-colors hover:text-blue-700">
                            <ChevronRight size={11} className={cn("transition-transform", isExpanded && "rotate-90")} />
                            {isExpanded ? "Ver menos" : `+${o.items.length - 4} itens`}
                          </button>
                        )}
                      </div>
                    )}
                  </ContentCard>
                );
              })
            )}
          </div>
        )}

        {/* ─ NOTES ─ */}
        {detailTab === "notes" && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Textarea
                aria-label="Nova nota interna"
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                rows={3}
                placeholder="Adicionar nota interna… Ex: cliente costuma atrasar pagamento, cuidado ao fazer fiado."
              />
              <Button size="sm" iconLeft={<Save size={12} />} onClick={handleAddNote} loading={savingNote} disabled={savingNote || !noteBody.trim()}>
                {savingNote ? "Salvando…" : "Salvar Nota"}
              </Button>
            </div>
            {detail.customer_notes.length === 0 ? (
              <EmptyState icon={StickyNote} title="Nenhuma nota ainda" />
            ) : (
              <div className="space-y-2">
                {detail.customer_notes.map((n) => (
                  <div key={n.id} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <StickyNote size={13} className="mt-0.5 shrink-0 text-amber-500" />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-xs text-amber-900">{n.body}</p>
                      <p className="mt-1 text-[11px] text-amber-600">{fmtDate(n.created_at)}</p>
                    </div>
                    <IconButton size="xs" aria-label="Remover nota" onClick={() => handleDeleteNote(n.id)}>
                      <XCircle size={13} />
                    </IconButton>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─ LOYALTY ─ */}
        {detailTab === "loyalty" && (
          <div className="space-y-3">
            <PanelCard title="Saldo de Pontos" icon={Award}>
              <p className="text-2xl font-semibold text-amber-600">{loyaltyBalance.toLocaleString("pt-BR")} pts</p>
              {loyaltyProgram && (
                <p className="mt-1 text-[11px] text-slate-500">A cada {fmt(loyaltyProgram.spend_per_point)} gastos = 1 ponto</p>
              )}
            </PanelCard>

            <PanelCard title="Ajuste Manual de Pontos">
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input label="Delta (+ ou -)" type="number" value={pointAdj} onChange={(e) => setPointAdj(e.target.value)} placeholder="Ex: 50 ou -20" />
                  <Input label="Motivo" value={pointDesc} onChange={(e) => setPointDesc(e.target.value)} placeholder="Ex: Correção" />
                </div>
                <Button
                  size="sm"
                  loading={savingPoints}
                  disabled={savingPoints || !pointAdj}
                  onClick={async () => {
                    if (!pointAdj) return;
                    setSavingPoints(true);
                    try {
                      await fetch(`/api/loyalty/customers/${detail.id}/points`, {
                        method: "POST", headers: authH(),
                        body: JSON.stringify({ delta: Number(pointAdj), description: pointDesc || null }),
                      });
                      setPointAdj(""); setPointDesc("");
                      fetchLoyalty(detail.id);
                    } finally { setSavingPoints(false); }
                  }}
                >
                  {savingPoints ? "Salvando…" : "Aplicar Ajuste"}
                </Button>
              </div>
            </PanelCard>

            {loyaltyRewards.length > 0 && (
              <PanelCard title="Resgatar Recompensa" icon={Gift}>
                <div className="space-y-2">
                  {loyaltyRewards.map((r) => {
                    const canRedeem = loyaltyBalance >= r.points_cost;
                    return (
                      <div key={r.id} className={cn("flex items-center gap-3 rounded-lg border p-3 transition-all", canRedeem ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-slate-50 opacity-60")}>
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-white">
                          {r.type === "discount" ? <DollarSign size={14} className="text-blue-500" /> : <Gift size={14} className="text-purple-500" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-xs font-medium text-slate-900">{r.name}</p>
                          <div className="mt-0.5 flex items-center gap-1">
                            <Star size={10} className="text-amber-400" fill="currentColor" />
                            <span className="text-[11px] font-medium text-amber-600">{r.points_cost} pts</span>
                          </div>
                        </div>
                        <Button
                          size="xs"
                          loading={redeemingId === r.id}
                          disabled={!canRedeem || redeemingId === r.id}
                          onClick={async () => {
                            setRedeemingId(r.id);
                            try {
                              await fetch(`/api/loyalty/customers/${detail.id}/redeem`, {
                                method: "POST", headers: authH(),
                                body: JSON.stringify({ reward_id: r.id }),
                              });
                              fetchLoyalty(detail.id);
                            } finally { setRedeemingId(null); }
                          }}
                        >
                          Resgatar
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </PanelCard>
            )}

            <PanelCard title="Histórico de Pontos">
              {loyaltyEntries.length === 0 ? (
                <p className="py-2 text-xs text-slate-500">Sem movimentações ainda.</p>
              ) : (
                <div className="space-y-1.5">
                  {loyaltyEntries.map((e) => {
                    const orderMatch = e.description?.match(/#(\d+)/);
                    const linkedOrder = orderMatch ? detail.orders.find((o) => o.id === Number(orderMatch[1])) : undefined;
                    return (
                      <button
                        type="button"
                        key={e.id}
                        onClick={() => linkedOrder && setPointOrderDetail(linkedOrder)}
                        disabled={!linkedOrder}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border border-slate-100 bg-white p-3 text-left transition-colors",
                          linkedOrder && "cursor-pointer hover:border-blue-200 hover:bg-blue-50/30"
                        )}
                      >
                        <Badge color={e.delta > 0 ? "success" : "danger"} pill>{e.delta > 0 ? "+" : ""}{e.delta}</Badge>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-700">{e.description ?? "—"}</p>
                          <p className="text-[11px] text-slate-500">{fmtDate(e.created_at)}</p>
                        </div>
                        <span className="shrink-0 text-[11px] font-medium text-slate-500">{e.balance_after} pts</span>
                        {linkedOrder && <ChevronRight size={13} className="shrink-0 text-slate-300" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </PanelCard>
          </div>
        )}
      </Tabs>

      {/* Detalhe de compra a partir do histórico de pontos */}
      <Modal open={!!pointOrderDetail} onClose={() => setPointOrderDetail(null)} title={pointOrderDetail ? `Compra #${pointOrderDetail.id}` : ""} size="sm">
        {pointOrderDetail && (
          <div className="space-y-3">
            <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              <DetailField label="Data" value={fmtDate(pointOrderDetail.created_at)} />
              <DetailField label="Total" value={fmt(Number(pointOrderDetail.total_amount))} />
              <DetailField className="sm:col-span-2" label="Forma de pagamento" value={formatPaymentMethod(pointOrderDetail.payment_method)} />
            </dl>
            <div className="space-y-1">
              {pointOrderDetail.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between border-b border-slate-100 py-1.5 text-xs text-slate-600 last:border-0">
                  <span>{it.name ?? `Item #${it.id}`} × {it.quantity}</span>
                  <span className="font-medium tabular-nums">{fmt(Number(it.unit_price) * it.quantity)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Reconfigurar parcelas do crediário */}
      <Modal
        open={!!reconfigureDebtId}
        onClose={() => { if (!reconfiguring) setReconfigureDebtId(null); }}
        title="Reconfigurar Parcelas"
        size="sm"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setReconfigureDebtId(null)}>Cancelar</Button>
            <Button loading={reconfiguring} disabled={!reconfigureFirstDue} onClick={handleReconfigureInstallments}>Salvar</Button>
          </ModalFooter>
        }
      >
        <div className="space-y-3">
          <Input label="Nº de parcelas" type="number" min={1} max={24} step={1} value={reconfigureCount}
            onChange={(e) => setReconfigureCount(e.target.value)} />
          <Input label="Vencimento da 1ª parcela" type="date" value={reconfigureFirstDue} onChange={(e) => setReconfigureFirstDue(e.target.value)} />
          <p className="text-[11px] text-slate-500">As parcelas atuais serão substituídas. Só é possível reconfigurar enquanto nenhum pagamento foi feito.</p>
        </div>
      </Modal>

      <Modal
        open={!!confirmDialog}
        onClose={() => { if (!confirming) setConfirmDialog(null); }}
        title={confirmDialog?.title ?? ""}
        size="sm"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)} disabled={confirming}>Cancelar</Button>
            <Button
              variant="danger"
              loading={confirming}
              onClick={async () => {
                if (!confirmDialog) return;
                setConfirming(true);
                try {
                  await confirmDialog.onConfirm();
                  setConfirmDialog(null);
                } finally {
                  setConfirming(false);
                }
              }}
            >
              Confirmar
            </Button>
          </ModalFooter>
        }
      >
        <p className="text-[13px] text-slate-600">{confirmDialog?.message}</p>
      </Modal>
    </div>
  );
}
