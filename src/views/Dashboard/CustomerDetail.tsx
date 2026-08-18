import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Phone, Mail, MapPin, AlertTriangle, X, Plus, ChevronRight, Trash2,
  DollarSign, Clock, CheckCircle2, FileText, ShoppingBag, StickyNote,
  Edit2, Save, XCircle, Shield, Star, Gift, Award, Loader2, Users,
  AlertCircle, ChevronLeft, CreditCard, Search, Calendar,
} from "lucide-react";
import { cn } from "../../lib/utils";
import PageHeader from "../../components/layout/PageHeader";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { downloadHtmlAsPdf } from "../../lib/pdf";

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
  birth_date?: string;
  risk_flag: boolean;
  risk_reason?: string;
  created_at: string;
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

type DetailTab = "summary" | "fiado" | "history" | "notes" | "loyalty";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const customerId = Number(id);

  const [detail, setDetail] = useState<CustomerDetailData | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("summary");
  const [loadingDetail, setLoadingDetail] = useState(true);

  // Edit form (reaproveita o mesmo modal simplificado de edição rápida)
  const [showForm, setShowForm] = useState(false);
  const [fName, setFName] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fDoc, setFDoc] = useState("");
  const [fAddr, setFAddr] = useState("");
  const [fStreet, setFStreet] = useState("");
  const [fNumber, setFNumber] = useState("");
  const [fComplement, setFComplement] = useState("");
  const [fDistrict, setFDistrict] = useState("");
  const [fCity, setFCity] = useState("");
  const [fState, setFState] = useState("");
  const [fZip, setFZip] = useState("");
  const [fCountry, setFCountry] = useState("Brasil");
  const [cepLoading, setCepLoading] = useState(false);
  const [fCredit, setFCredit] = useState("");
  const [fBirth, setFBirth] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [fRisk, setFRisk] = useState(false);
  const [fRiskReason, setFRiskReason] = useState("");
  const [saving, setSaving] = useState(false);

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
  const [payMethod, setPayMethod] = useState("money");
  const [payingDebts, setPayingDebts] = useState(false);

  // Parcelas do crediário
  const [selectedInstallmentIds, setSelectedInstallmentIds] = useState<Set<number>>(new Set());
  const [installmentPayAmounts, setInstallmentPayAmounts] = useState<Record<number, string>>({});
  const [installmentPayMethod, setInstallmentPayMethod] = useState<Record<number, "money" | "pix" | "debit" | "credit">>({});
  const [payingInstallmentId, setPayingInstallmentId] = useState<number | null>(null);
  const [reconfigureDebtId, setReconfigureDebtId] = useState<number | null>(null);
  const [reconfigureCount, setReconfigureCount] = useState("1");
  const [reconfigureFirstDue, setReconfigureFirstDue] = useState("");
  const [reconfiguring, setReconfiguring] = useState(false);

  // Juros de crediário (configurado em Settings, aplicado manualmente por parcela)
  const [crediarioInterestRate, setCrediarioInterestRate] = useState(0);
  const [crediarioGraceDays, setCrediarioGraceDays] = useState(0);
  const [applyingInterestId, setApplyingInterestId] = useState<number | null>(null);

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
      })
      .catch(() => {});
  }, []);

  function openEdit() {
    if (!detail) return;
    setFName(detail.name); setFEmail(detail.email ?? ""); setFPhone(maskPhone(detail.phone ?? ""));
    setFDoc(maskDoc(detail.document ?? "")); setFAddr(detail.address ?? ""); setFNotes(detail.notes ?? "");
    setFStreet(detail.address_street ?? ""); setFNumber(detail.address_number ?? ""); setFComplement(detail.address_complement ?? "");
    setFDistrict(detail.address_district ?? ""); setFCity(detail.address_city ?? ""); setFState(detail.address_state ?? ""); setFZip(detail.address_zip ?? "");
    setFCountry(detail.address_country ?? "Brasil");
    setFCredit(detail.credit_limit ? String(detail.credit_limit) : "");
    setFBirth(detail.birth_date ? detail.birth_date.slice(0, 10) : "");
    setFRisk(detail.risk_flag); setFRiskReason(detail.risk_reason ?? "");
    setShowForm(true);
  }

  async function handleLookupCEP() {
    const raw = fZip.replace(/\D/g, "");
    if (raw.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      const d = await res.json();
      if (!d.erro) {
        setFStreet(d.logradouro ?? "");
        setFDistrict(d.bairro ?? "");
        setFCity(d.localidade ?? "");
        setFState(d.uf ?? "");
        setFZip(raw);
      }
    } catch {
      // silencioso — mesmo comportamento do lookup de CEP em Customers.tsx
    } finally {
      setCepLoading(false);
    }
  }

  async function handleSave() {
    if (!detail || !fName.trim()) return;
    setSaving(true);
    try {
      const computedAddress = [
        fStreet && fNumber ? `${fStreet}, ${fNumber}` : fStreet,
        fDistrict,
        fCity && fState ? `${fCity} - ${fState}` : fCity || fState,
      ].filter(Boolean).join(", ");
      await fetch(`/api/customers/${detail.id}`, {
        method: "PUT", headers: authH(),
        body: JSON.stringify({
          name: fName, email: fEmail,
          phone: fPhone.replace(/\D/g, "") || null,
          document: fDoc.replace(/\D/g, "") || null,
          address: computedAddress || fAddr || null, notes: fNotes,
          address_street: fStreet || null,
          address_number: fNumber || null,
          address_complement: fComplement || null,
          address_district: fDistrict || null,
          address_city: fCity || null,
          address_state: fState || null,
          address_zip: fZip.replace(/\D/g, "") || null,
          address_country: fCountry || null,
          credit_limit: fCredit ? Number(fCredit) : null,
          birth_date: fBirth || null,
          risk_flag: fRisk, risk_reason: fRiskReason || null,
        }),
      });
      await fetchDetail(detail.id);
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

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

  async function handlePayDebt(debtId: number) {
    if (!detail) return;
    await fetch(`/api/customers/${detail.id}/debts/${debtId}/pay`, { method: "POST", headers: authH() });
    await fetchDetail(detail.id);
  }

  function toggleDebtSelection(debtId: number, checked: boolean, remaining: number) {
    setSelectedDebtIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(debtId); else next.delete(debtId);
      return next;
    });
    if (checked) {
      setPayAmounts((prev) => ({ ...prev, [debtId]: prev[debtId] ?? remaining.toFixed(2) }));
    }
  }

  async function handlePaySelectedDebts() {
    if (!detail || selectedDebtIds.size === 0) return;
    setPayingDebts(true);
    try {
      for (const debtId of selectedDebtIds) {
        const amount = Number(payAmounts[debtId] ?? 0);
        if (amount <= 0) continue;
        await fetch(`/api/customers/${detail.id}/debts/${debtId}/pay-partial`, {
          method: "POST", headers: authH(),
          body: JSON.stringify({ amount, payment_method: payMethod }),
        });
      }
      setSelectedDebtIds(new Set());
      setPayAmounts({});
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
    }
  }

  async function handlePayInstallment(debtId: number, installmentId: number, installmentNumber: number, amount: number) {
    if (!detail || amount <= 0) return;
    setPayingInstallmentId(installmentId);
    try {
      const res = await fetch(`/api/customers/${detail.id}/debts/${debtId}/pay-partial`, {
        method: "POST", headers: authH(),
        body: JSON.stringify({ amount, payment_method: installmentPayMethod[installmentId] ?? "money", installment_id: installmentId }),
      });
      if (res.ok) {
        await downloadPaymentReceipt(installmentNumber, amount);
      }
      setSelectedInstallmentIds((prev) => { const next = new Set(prev); next.delete(installmentId); return next; });
      setInstallmentPayAmounts((prev) => { const next = { ...prev }; delete next[installmentId]; return next; });
      setInstallmentPayMethod((prev) => { const next = { ...prev }; delete next[installmentId]; return next; });
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

  async function downloadPaymentReceipt(installmentNumber: number, amount: number) {
    if (!detail) return;
    const now = new Date();
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Recibo de Pagamento</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; color: #1e293b; padding: 24px; }
  h1 { font-size: 15px; margin-bottom: 12px; }
  .row { display: table; width: 100%; margin: 4px 0; font-size: 12px; }
  .row .lbl { display: table-cell; color: #64748b; }
  .row .val { display: table-cell; text-align: right; font-weight: bold; }
  .amount { margin-top: 16px; font-size: 16px; font-weight: bold; text-align: center; border: 1px solid #cbd5e1; padding: 10px; }
</style></head>
<body>
  <h1>Recibo de Pagamento</h1>
  <div class="row"><span class="lbl">Cliente</span><span class="val">${detail.name}</span></div>
  <div class="row"><span class="lbl">Parcela</span><span class="val">${installmentNumber}</span></div>
  <div class="row"><span class="lbl">Forma de pagamento</span><span class="val">${PM_LABELS[payMethod] ?? payMethod}</span></div>
  <div class="row"><span class="lbl">Data</span><span class="val">${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR")}</span></div>
  <div class="amount">${fmt(amount)}</div>
</body></html>`;

    await downloadHtmlAsPdf(html, `recibo-${detail.name.replace(/\s+/g, "-").toLowerCase()}-${now.getTime()}.pdf`);
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
  th { background: #f1f5f9; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
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
    return <div className="flex justify-center py-24 text-slate-400 text-sm">Carregando…</div>;
  }

  if (!detail) {
    return (
      <div className="flex flex-col items-center py-24 text-slate-400 gap-3">
        <Users size={40} strokeWidth={1} />
        <p className="text-sm font-medium">Cliente não encontrado</p>
        <button onClick={() => navigate("/admin/customers")} className="h-8 px-4 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700">
          Voltar para Clientes
        </button>
      </div>
    );
  }

  // debts vinculadas a cada order (para o badge de crediário na aba Compras)
  const debtByOrderId = new Map(detail.debts.filter((d) => d.order_id).map((d) => [d.order_id as number, d]));

  return (
    <div className="space-y-4">
      <PageHeader
        title={detail.name}
        subtitle="Ficha completa do cliente"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => navigate("/admin/customers")}
              className="h-9 px-3 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 text-[12px] font-bold transition-all">
              <ChevronLeft size={14} /> <span className="hidden sm:inline">Voltar</span>
            </button>
            <button onClick={openEdit} className="h-9 px-3 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 text-[12px] font-bold transition-all">
              <Edit2 size={13} /> <span className="hidden sm:inline">Editar</span>
            </button>
            <button onClick={handleDelete} className="h-9 px-3 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 flex items-center gap-1.5 text-[12px] font-bold transition-all">
              <Trash2 size={13} /> <span className="hidden sm:inline">Excluir</span>
            </button>
          </div>
        }
      />

      {/* Customer header card */}
      <div className={cn("rounded-2xl border p-4 sm:p-5", detail.risk_flag ? "bg-rose-50 border-rose-200" : "bg-white border-slate-200 shadow-sm")}>
        <div className="flex items-start gap-3 sm:gap-4">
          <div className={cn(
            "w-11 h-11 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-black text-lg sm:text-2xl uppercase shrink-0",
            detail.risk_flag ? "bg-rose-100 text-rose-600" : "bg-blue-50 text-blue-600"
          )}>
            {detail.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-black text-slate-900 text-[16px] sm:text-[18px] leading-tight break-words">{detail.name}</h2>
              {detail.risk_flag && (
                <span className="flex items-center gap-1 text-[9px] font-black text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full uppercase shrink-0">
                  <AlertTriangle size={9} /> Risco
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-4 mt-1.5">
              {detail.phone && (
                <a href={`tel:${detail.phone}`} className="text-[12px] text-slate-500 flex items-center gap-1 hover:text-blue-600">
                  <Phone size={11} /> {detail.phone}
                </a>
              )}
              {detail.email && (
                <a href={`mailto:${detail.email}`} className="text-[12px] text-slate-500 flex items-center gap-1 hover:text-blue-600">
                  <Mail size={11} /> {detail.email}
                </a>
              )}
              {detail.address && (
                <span className="text-[12px] text-slate-500 flex items-center gap-1">
                  <MapPin size={11} /> {detail.address}
                </span>
              )}
            </div>
          </div>
        </div>

        {detail.total_debt > 0 && (
          <div className="mt-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
            <DollarSign size={14} className="text-red-500 shrink-0" />
            <span className="text-[12px] font-black text-red-600">Deve {fmt(detail.total_debt)} em aberto (Crediário/Fiado)</span>
          </div>
        )}
        {detail.risk_reason && (
          <div className="mt-2 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
            <Shield size={13} className="text-rose-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-rose-700 font-semibold">{detail.risk_reason}</p>
          </div>
        )}
      </div>

      {/* Detail tabs */}
      <div className="flex gap-0 border-b border-slate-200 overflow-x-auto">
        {([
          { value: "summary", label: "Resumo", icon: Users },
          { value: "fiado", label: `Crediário / Fiado (${detail.debts.filter((d) => d.status === "open").length})`, icon: DollarSign },
          { value: "history", label: `Compras (${detail.orders.length})`, icon: ShoppingBag },
          { value: "notes", label: `Notas (${detail.customer_notes.length})`, icon: StickyNote },
          { value: "loyalty", label: "Pontos", icon: Star },
        ] as { value: DetailTab; label: string; icon: React.FC<{ size: number }> }[]).map((t) => (
          <button
            key={t.value}
            onClick={() => { setDetailTab(t.value); if (t.value === "loyalty") fetchLoyalty(detail.id); }}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-bold whitespace-nowrap border-b-2 transition-all",
              detailTab === t.value ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="max-w-3xl">
        {/* ─ SUMMARY ─ */}
        {detailTab === "summary" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total de Compras", value: detail.orders.length, icon: ShoppingBag },
                { label: "Gasto Total", value: fmt(detail.orders.reduce((s, o) => s + Number(o.total_amount), 0)), icon: DollarSign },
                { label: "Fiados em Aberto", value: detail.debts.filter((d) => d.status === "open").length, icon: AlertCircle },
                { label: "Notas Internas", value: detail.customer_notes.length, icon: StickyNote },
              ].map((s) => (
                <div key={s.label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{s.label}</p>
                  <p className="text-lg font-black text-slate-800 mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Dados Cadastrais</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">CPF/CNPJ</p>
                  <p className="text-slate-700 font-medium">{detail.document || "—"}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1"><Calendar size={9} /> Aniversário</p>
                  <p className="text-slate-700 font-medium">{detail.birth_date ? fmtDate(detail.birth_date) : "—"}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Limite de Crédito</p>
                  <p className="text-slate-700 font-medium">{detail.credit_limit ? fmt(Number(detail.credit_limit)) : "Sem limite definido"}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Cliente desde</p>
                  <p className="text-slate-700 font-medium">{fmtDate(detail.created_at)}</p>
                </div>
              </div>
              {(detail.address_street || detail.address) && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1"><MapPin size={9} /> Endereço</p>
                  <p className="text-sm text-slate-700">
                    {detail.address_street ? (
                      <>
                        {detail.address_street}{detail.address_number ? `, ${detail.address_number}` : ""}
                        {detail.address_complement ? ` - ${detail.address_complement}` : ""}
                        {detail.address_district ? ` · ${detail.address_district}` : ""}
                        {detail.address_city ? ` · ${detail.address_city}${detail.address_state ? `/${detail.address_state}` : ""}` : ""}
                        {detail.address_zip ? ` · CEP ${detail.address_zip}` : ""}
                      </>
                    ) : detail.address}
                  </p>
                </div>
              )}
            </div>

            {detail.notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[12px] text-amber-800">
                <p className="font-bold mb-1 flex items-center gap-1"><FileText size={11} /> Observações do cadastro</p>
                {detail.notes}
              </div>
            )}
          </div>
        )}

        {/* ─ FIADO / CREDIÁRIO ─ */}
        {detailTab === "fiado" && (
          <div className="space-y-3">
            {!showDebtForm ? (
              <button onClick={() => setShowDebtForm(true)}
                className="w-full h-9 border-2 border-dashed border-slate-200 rounded-xl text-[12px] font-bold text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-all flex items-center justify-center gap-1.5">
                <Plus size={14} /> Adicionar Fiado Manual
              </button>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <p className="text-[11px] font-black uppercase tracking-wider text-blue-600">Novo Fiado</p>
                <input value={dDesc} onChange={(e) => setDDesc(e.target.value)} placeholder="Descrição (ex: 1 kg de frango)"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">R$</span>
                    <input type="number" min={0} step="0.01" value={dAmt} onChange={(e) => setDAmt(e.target.value)} placeholder="0,00"
                      className="w-full h-9 pl-8 pr-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <input type="date" value={dDue} onChange={(e) => setDDue(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowDebtForm(false)} className="flex-1 h-9 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancelar</button>
                  <button onClick={handleAddDebt} disabled={savingDebt || !dDesc.trim() || !dAmt}
                    className="flex-1 h-9 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50">
                    {savingDebt ? "Salvando…" : "Registrar"}
                  </button>
                </div>
              </div>
            )}

            {detail.debts.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">Nenhum fiado/crediário registrado</p>
            ) : (
              <div className="space-y-2">
                {detail.debts.map((d) => {
                  const remaining = Number(d.amount) - Number(d.amount_paid ?? 0);
                  const isExpanded = expandedDebtId === d.id;
                  const hasOrderItems = !!d.order?.items?.length;
                  const isInstallmentPlan = (d.installments?.length ?? 0) > 1;
                  const hasAnyPayment = (d.installments ?? []).some((i) => Number(i.amount_paid) > 0);
                  const canExpand = hasOrderItems || isInstallmentPlan;
                  return (
                    <div key={d.id} className={cn(
                      "rounded-xl border overflow-hidden",
                      d.status === "paid" ? "bg-emerald-50 border-emerald-200" : isOverdue(d.due_date) ? "bg-red-50 border-red-200" : "bg-white border-slate-200"
                    )}>
                      <div className="flex items-start gap-3 p-3">
                        {d.status === "open" && !isInstallmentPlan && (
                          <input type="checkbox" checked={selectedDebtIds.has(d.id)}
                            onChange={(e) => toggleDebtSelection(d.id, e.target.checked, remaining)}
                            className="mt-1.5 w-4 h-4 accent-blue-600" />
                        )}
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", d.status === "paid" ? "bg-emerald-100" : "bg-red-100")}>
                          {d.status === "paid" ? <CheckCircle2 size={15} className="text-emerald-600" /> : <Clock size={15} className="text-red-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {canExpand && (
                              <button onClick={() => setExpandedDebtId(isExpanded ? null : d.id)} className="text-slate-400 hover:text-slate-700 shrink-0">
                                <ChevronRight size={14} className={cn("transition-transform", isExpanded && "rotate-90")} />
                              </button>
                            )}
                            <p className="font-semibold text-[13px] text-slate-800">{d.description}</p>
                            {isInstallmentPlan && (
                              <span className="text-[9px] font-black uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                                {d.installments!.length}x
                              </span>
                            )}
                          </div>
                          <p className="font-black text-[13px] text-red-600">{fmt(remaining)}</p>
                          {Number(d.amount_paid) > 0 && (
                            <p className="text-[10px] text-emerald-600 font-semibold">Pago: {fmt(Number(d.amount_paid))} de {fmt(Number(d.amount))}</p>
                          )}
                          <div className="flex flex-wrap gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-400">{fmtDate(d.created_at)}</span>
                            {d.due_date && !isInstallmentPlan && (
                              <span className={cn("text-[10px] font-semibold", isOverdue(d.due_date) && d.status === "open" ? "text-red-500" : "text-slate-400")}>
                                Vence: {fmtDate(d.due_date)}{isOverdue(d.due_date) && d.status === "open" && " (vencido)"}
                              </span>
                            )}
                            {d.status === "paid" && d.paid_at && (
                              <span className="text-[10px] text-emerald-600 font-semibold">Pago em {fmtDate(d.paid_at)}</span>
                            )}
                          </div>
                        </div>
                        {d.status === "open" && (
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            {!isInstallmentPlan && selectedDebtIds.has(d.id) && (
                              <input type="number" min={0} max={remaining} step="0.01"
                                value={payAmounts[d.id] ?? remaining.toFixed(2)}
                                onChange={(e) => setPayAmounts((prev) => ({ ...prev, [d.id]: e.target.value }))}
                                className="w-20 h-7 px-2 rounded-lg border border-slate-200 text-[11px] font-mono focus:outline-none focus:border-blue-400" />
                            )}
                            <div className="flex gap-1">
                              {isInstallmentPlan && (
                                <button onClick={() => downloadInstallmentBooklet(d)} title="Gerar carnê (PDF)" className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors">
                                  <FileText size={13} />
                                </button>
                              )}
                              {isInstallmentPlan && !hasAnyPayment && (
                                <button onClick={() => openReconfigure(d)} title="Reconfigurar parcelas" className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors">
                                  <Edit2 size={13} />
                                </button>
                              )}
                              {!isInstallmentPlan && (
                                <button onClick={() => handlePayDebt(d.id)} title="Quitar tudo agora" className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-600 rounded-lg transition-colors">
                                  <CheckCircle2 size={13} />
                                </button>
                              )}
                              <button onClick={() => handleDeleteDebt(d.id)} title="Remover" className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-400 rounded-lg transition-colors">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      {isExpanded && hasOrderItems && (
                        <div className="px-3 pb-3 pt-0 pl-14 space-y-1 border-t border-slate-100">
                          {d.order!.items.map((it) => (
                            <div key={it.id} className="flex justify-between text-[11px] text-slate-600 pt-2">
                              <span>{it.name ?? `Item #${it.id}`} × {it.quantity}</span>
                              <span className="font-mono">{fmt(Number(it.unit_price) * it.quantity)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {isExpanded && isInstallmentPlan && (
                        <div className="px-3 pb-3 pt-2 border-t border-slate-100 space-y-1.5">
                          {d.installments!.map((inst) => {
                            const instRemaining = Number(inst.amount) - Number(inst.amount_paid ?? 0);
                            const instOverdue = isOverdue(inst.due_date) && inst.status === "open";
                            const suggested = instOverdue
                              ? suggestedInterest(instRemaining, inst.due_date, crediarioInterestRate, crediarioGraceDays)
                              : 0;
                            return (
                              <div key={inst.id} className={cn(
                                "rounded-lg border p-2 space-y-1.5",
                                inst.status === "paid" ? "bg-emerald-50 border-emerald-200" : instOverdue ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"
                              )}>
                              <div className="flex items-center gap-2">
                                {inst.status === "open" && (
                                  <input type="checkbox" checked={selectedInstallmentIds.has(inst.id)}
                                    onChange={(e) => toggleInstallmentSelection(inst.id, e.target.checked, instRemaining)}
                                    className="w-3.5 h-3.5 accent-blue-600 shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-bold text-slate-700">Parcela {inst.number}/{d.installments!.length}</p>
                                  <p className={cn("text-[10px] font-semibold", instOverdue ? "text-red-500" : "text-slate-400")}>
                                    Vence {fmtDate(inst.due_date)}{instOverdue && " (vencida)"}
                                  </p>
                                </div>
                                <span className="text-[12px] font-mono font-black text-slate-700 shrink-0">{fmt(instRemaining)}</span>
                                {inst.status === "open" ? (
                                  <>
                                    {selectedInstallmentIds.has(inst.id) && (
                                      <>
                                        <select value={installmentPayMethod[inst.id] ?? "money"}
                                          onChange={(e) => setInstallmentPayMethod((prev) => ({ ...prev, [inst.id]: e.target.value as "money" | "pix" | "debit" | "credit" }))}
                                          className="h-7 px-1 rounded-lg border border-slate-200 text-[9px] font-bold focus:outline-none focus:border-blue-400 shrink-0">
                                          <option value="money">Dinheiro</option>
                                          <option value="pix">PIX</option>
                                          <option value="debit">Débito</option>
                                          <option value="credit">Crédito</option>
                                        </select>
                                        <input type="number" min={0} max={instRemaining} step="0.01"
                                          value={installmentPayAmounts[inst.id] ?? instRemaining.toFixed(2)}
                                          onChange={(e) => setInstallmentPayAmounts((prev) => ({ ...prev, [inst.id]: e.target.value }))}
                                          className="w-16 h-7 px-1.5 rounded-lg border border-slate-200 text-[10px] font-mono focus:outline-none focus:border-blue-400 shrink-0" />
                                      </>
                                    )}
                                    <button
                                      onClick={() => handlePayInstallment(d.id, inst.id, inst.number, Number(installmentPayAmounts[inst.id] ?? instRemaining))}
                                      disabled={payingInstallmentId === inst.id}
                                      className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-600 rounded-lg transition-colors shrink-0 disabled:opacity-50">
                                      {payingInstallmentId === inst.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                                    </button>
                                  </>
                                ) : (
                                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                                )}
                              </div>
                                {suggested > 0 && (
                                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-red-200">
                                    <p className="text-[9px] text-red-600 font-semibold">Juros sugerido: {fmt(suggested)}</p>
                                    <button
                                      onClick={() => handleApplyInterest(d.id, inst.id, suggested)}
                                      disabled={applyingInterestId === inst.id}
                                      className="h-6 px-2 rounded-md bg-red-600 text-white text-[9px] font-black uppercase tracking-wide hover:bg-red-700 disabled:opacity-50 transition-colors shrink-0">
                                      {applyingInterestId === inst.id ? <Loader2 size={10} className="animate-spin" /> : "Aplicar juros"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {selectedDebtIds.size > 0 && (
              <div className="sticky bottom-0 bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-2 shadow-lg">
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}
                  className="h-9 px-2 rounded-lg border border-slate-200 text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="money">Dinheiro</option>
                  <option value="pix">PIX</option>
                  <option value="debit">Débito</option>
                  <option value="credit">Crédito</option>
                </select>
                <button onClick={handlePaySelectedDebts} disabled={payingDebts}
                  className="flex-1 h-9 bg-emerald-600 text-white rounded-lg text-[12px] font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all">
                  {payingDebts ? "Pagando…" : `Pagar ${selectedDebtIds.size} dívida(s)`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─ HISTORY ─ */}
        {detailTab === "history" && (
          <div className="space-y-2">
            {detail.orders.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">Nenhuma compra registrada</p>
            ) : (
              detail.orders.map((o) => {
                const isExpanded = expandedOrderId === o.id;
                const visibleItems = isExpanded ? o.items : o.items.slice(0, 4);
                const linkedDebt = debtByOrderId.get(o.id);
                return (
                  <div key={o.id} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">{fmtDate(o.created_at)}</span>
                      <div className="flex items-center gap-2">
                        {linkedDebt && (
                          <span className={cn(
                            "flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full",
                            linkedDebt.status === "open" ? "text-amber-700 bg-amber-100" : "text-emerald-700 bg-emerald-100"
                          )} title={linkedDebt.status === "open" ? `Falta pagar ${fmt(Number(linkedDebt.amount) - Number(linkedDebt.amount_paid))}` : "Crediário quitado"}>
                            <CreditCard size={9} /> Crediário {linkedDebt.status === "open" ? "aberto" : "pago"}
                          </span>
                        )}
                        {o.payment_method && (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            {formatPaymentMethod(o.payment_method)}
                          </span>
                        )}
                        <span className="font-black text-emerald-600 text-[13px]">{fmt(Number(o.total_amount))}</span>
                      </div>
                    </div>
                    {o.items.length > 0 && (
                      <div className="space-y-0.5">
                        {visibleItems.map((it) => (
                          <div key={it.id} className="flex items-center justify-between text-[11px] text-slate-600">
                            <span className="truncate">{it.name ?? `Item #${it.id}`} × {it.quantity}</span>
                            <span className="font-semibold ml-2 shrink-0">{fmt(Number(it.unit_price) * it.quantity)}</span>
                          </div>
                        ))}
                        {o.items.length > 4 && (
                          <button onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
                            className="flex items-center gap-1 text-[10px] font-bold text-blue-500 hover:text-blue-600 transition-colors pt-0.5">
                            <ChevronRight size={11} className={cn("transition-transform", isExpanded && "rotate-90")} />
                            {isExpanded ? "Ver menos" : `+${o.items.length - 4} itens`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ─ NOTES ─ */}
        {detailTab === "notes" && (
          <div className="space-y-3">
            <div className="space-y-2">
              <textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} rows={3}
                placeholder="Adicionar nota interna… Ex: cliente costuma atrasar pagamento, cuidado ao fazer fiado."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              <button onClick={handleAddNote} disabled={savingNote || !noteBody.trim()}
                className="h-8 px-4 bg-amber-500 text-white rounded-lg text-[12px] font-bold hover:bg-amber-600 disabled:opacity-50 transition-all flex items-center gap-1.5">
                <Save size={12} /> {savingNote ? "Salvando…" : "Salvar Nota"}
              </button>
            </div>
            {detail.customer_notes.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-6">Nenhuma nota ainda</p>
            ) : (
              <div className="space-y-2">
                {detail.customer_notes.map((n) => (
                  <div key={n.id} className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                    <StickyNote size={13} className="text-amber-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-amber-900">{n.body}</p>
                      <p className="text-[10px] text-amber-500 mt-1">{fmtDate(n.created_at)}</p>
                    </div>
                    <button onClick={() => handleDeleteNote(n.id)} className="p-1 hover:bg-amber-100 text-amber-300 hover:text-amber-500 rounded-lg transition-colors">
                      <XCircle size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─ LOYALTY ─ */}
        {detailTab === "loyalty" && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-amber-400 to-orange-400 rounded-2xl p-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold opacity-80 uppercase tracking-wider">Saldo de Pontos</p>
                  <p className="text-3xl font-black mt-1">{loyaltyBalance.toLocaleString("pt-BR")} pts</p>
                  {loyaltyProgram && (
                    <p className="text-[11px] opacity-70 mt-1">A cada {fmt(loyaltyProgram.spend_per_point)} gastos = 1 ponto</p>
                  )}
                </div>
                <Award size={40} className="opacity-30" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ajuste Manual de Pontos</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-slate-400 block mb-0.5">Delta (+ ou -)</label>
                  <input type="number" value={pointAdj} onChange={(e) => setPointAdj(e.target.value)} placeholder="Ex: 50 ou -20"
                    className="w-full h-8 px-2 rounded-lg border border-slate-200 text-[12px] focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="text-[9px] text-slate-400 block mb-0.5">Motivo</label>
                  <input value={pointDesc} onChange={(e) => setPointDesc(e.target.value)} placeholder="Ex: Correção"
                    className="w-full h-8 px-2 rounded-lg border border-slate-200 text-[12px] focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>
              <button
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
                className="h-8 px-4 bg-amber-500 text-white rounded-lg text-[12px] font-bold hover:bg-amber-600 disabled:opacity-50 transition-all"
              >
                {savingPoints ? "Salvando…" : "Aplicar Ajuste"}
              </button>
            </div>

            {loyaltyRewards.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Resgatar Recompensa</p>
                {loyaltyRewards.map((r) => {
                  const canRedeem = loyaltyBalance >= r.points_cost;
                  return (
                    <div key={r.id} className={cn("flex items-center gap-3 p-3 rounded-xl border transition-all", canRedeem ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-slate-50 opacity-60")}>
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-slate-100 shrink-0">
                        {r.type === "discount" ? <DollarSign size={14} className="text-blue-500" /> : <Gift size={14} className="text-purple-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-slate-900">{r.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Star size={10} className="text-amber-400" fill="currentColor" />
                          <span className="text-[10px] text-amber-600 font-bold">{r.points_cost} pts</span>
                        </div>
                      </div>
                      <button
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
                        className="h-7 px-3 bg-amber-500 text-white rounded-lg text-[11px] font-bold hover:bg-amber-600 disabled:opacity-40 transition-all"
                      >
                        {redeemingId === r.id ? "…" : "Resgatar"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Histórico de Pontos</p>
              {loyaltyEntries.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-6">Sem movimentações ainda</p>
              ) : (
                <div className="space-y-1.5">
                  {loyaltyEntries.map((e) => {
                    const orderMatch = e.description?.match(/#(\d+)/);
                    const linkedOrder = orderMatch ? detail.orders.find((o) => o.id === Number(orderMatch[1])) : undefined;
                    return (
                      <button
                        key={e.id}
                        onClick={() => linkedOrder && setPointOrderDetail(linkedOrder)}
                        disabled={!linkedOrder}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 text-left transition-colors",
                          linkedOrder && "hover:border-blue-200 hover:bg-blue-50/30 cursor-pointer"
                        )}
                      >
                        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0", e.delta > 0 ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600")}>
                          {e.delta > 0 ? "+" : ""}{e.delta}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-slate-700 truncate">{e.description ?? "—"}</p>
                          <p className="text-[10px] text-slate-400">{fmtDate(e.created_at)}</p>
                        </div>
                        <span className="text-[11px] font-bold text-slate-500 shrink-0">{e.balance_after} pts</span>
                        {linkedOrder && <ChevronRight size={13} className="text-slate-300 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Detalhe de compra a partir do histórico de pontos */}
      <Modal open={!!pointOrderDetail} onClose={() => setPointOrderDetail(null)} title={pointOrderDetail ? `Compra #${pointOrderDetail.id}` : ""} size="sm">
        {pointOrderDetail && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">{fmtDate(pointOrderDetail.created_at)}</span>
              <span className="font-black text-emerald-600">{fmt(Number(pointOrderDetail.total_amount))}</span>
            </div>
            <div className="text-[12px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              <span className="font-semibold">Forma de pagamento:</span> {formatPaymentMethod(pointOrderDetail.payment_method)}
            </div>
            <div className="space-y-1">
              {pointOrderDetail.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between text-[12px] text-slate-600 border-b border-slate-100 py-1.5 last:border-0">
                  <span>{it.name ?? `Item #${it.id}`} × {it.quantity}</span>
                  <span className="font-semibold">{fmt(Number(it.unit_price) * it.quantity)}</span>
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
          <>
            <Button variant="secondary" onClick={() => setReconfigureDebtId(null)}>Cancelar</Button>
            <Button loading={reconfiguring} disabled={!reconfigureFirstDue} onClick={handleReconfigureInstallments}>Salvar</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Nº de parcelas</label>
            <input type="number" min={1} max={24} step={1} value={reconfigureCount}
              onChange={(e) => setReconfigureCount(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Vencimento da 1ª parcela</label>
            <input type="date" value={reconfigureFirstDue} onChange={(e) => setReconfigureFirstDue(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <p className="text-[11px] text-slate-400">As parcelas atuais serão substituídas. Só é possível reconfigurar enquanto nenhum pagamento foi feito.</p>
        </div>
      </Modal>

      {/* Quick edit modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Editar Cliente"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button loading={saving} onClick={handleSave}>Salvar</Button>
          </>
        }
      >
        <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Nome *</label>
            <input value={fName} onChange={(e) => setFName(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Telefone</label>
              <input value={fPhone} onChange={(e) => setFPhone(maskPhone(e.target.value))} placeholder="(11) 99999-9999" inputMode="numeric"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">CPF/CNPJ</label>
              <input value={fDoc} onChange={(e) => setFDoc(maskDoc(e.target.value))} placeholder="000.000.000-00" inputMode="numeric"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Data de Aniversário</label>
            <input type="date" value={fBirth} onChange={(e) => setFBirth(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">E-mail</label>
            <input value={fEmail} onChange={(e) => setFEmail(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Endereço</label>
            <div className="flex gap-2">
              <input value={fZip} onChange={(e) => setFZip(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="CEP" inputMode="numeric"
                className="w-32 h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={handleLookupCEP} disabled={cepLoading || fZip.replace(/\D/g, "").length !== 8}
                className="h-9 px-3 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all flex items-center gap-1.5 shrink-0">
                {cepLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                Buscar CEP
              </button>
            </div>
            <input value={fStreet} onChange={(e) => setFStreet(e.target.value)} placeholder="Rua / Logradouro"
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="grid grid-cols-2 gap-2">
              <input value={fNumber} onChange={(e) => setFNumber(e.target.value)} placeholder="Número"
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input value={fComplement} onChange={(e) => setFComplement(e.target.value)} placeholder="Complemento"
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <input value={fDistrict} onChange={(e) => setFDistrict(e.target.value)} placeholder="Bairro"
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="grid grid-cols-3 gap-2">
              <input value={fCity} onChange={(e) => setFCity(e.target.value)} placeholder="Cidade"
                className="col-span-2 h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={fState} onChange={(e) => setFState(e.target.value)}
                className="h-9 px-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">UF</option>
                {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
            <input value={fCountry} onChange={(e) => setFCountry(e.target.value)} placeholder="País"
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Limite de Crédito (R$)</label>
            <input type="number" min={0} value={fCredit} onChange={(e) => setFCredit(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Observações</label>
            <textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className={cn("rounded-xl border p-3 space-y-2 transition-colors", fRisk ? "bg-rose-50 border-rose-200" : "bg-slate-50 border-slate-200")}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={fRisk} onChange={(e) => setFRisk(e.target.checked)} className="w-4 h-4 accent-rose-500" />
              <span className={cn("text-[12px] font-black", fRisk ? "text-rose-600" : "text-slate-600")}>
                <AlertTriangle size={12} className="inline mr-1" /> Marcar como Cliente de Risco
              </span>
            </label>
            {fRisk && (
              <textarea value={fRiskReason} onChange={(e) => setFRiskReason(e.target.value)} rows={2}
                placeholder="Motivo do risco (ex: atrasou 3x, cheque sem fundo…)"
                className="w-full px-3 py-2 rounded-lg border border-rose-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none bg-white" />
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={!!confirmDialog}
        onClose={() => { if (!confirming) setConfirmDialog(null); }}
        title={confirmDialog?.title ?? ""}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDialog(null)} disabled={confirming}>Cancelar</Button>
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
          </>
        }
      >
        <p className="text-sm text-slate-600">{confirmDialog?.message}</p>
      </Modal>
    </div>
  );
}
