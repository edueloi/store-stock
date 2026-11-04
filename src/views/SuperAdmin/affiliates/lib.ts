import { useCallback, useEffect, useState } from "react";

import { getStoredToken } from "../../../lib/session";

// Contrato: docs/AFILIADOS-API.md (seção "Gestão"). Prefixo único das rotas desta área.
const BASE = "/api/super-admin/affiliates-admin";

export type Notify = (type: "success" | "error", message: string) => void;

// ─── Tipos ─────────────────────────────────────────────────────────────────
export type RuleType = "percent" | "fixed";
export interface CommissionRule { from: number; to: number | null; type: RuleType; value: number }

export type AffiliateStatus = "pending" | "active" | "suspended" | "rejected";
export type WalletStatus = "pending" | "verified";
export type LeadStatus = "new" | "contacted" | "negotiating" | "won" | "lost";
export type ReferralStatus = "trial" | "active" | "overdue" | "cancelled";
export type CommissionStatus = "pending" | "confirmed" | "received" | "paid" | "refunded" | "cancelled" | "blocked";
export type GoalMetric = "leads" | "sales" | "commission";

export interface AffiliateStats {
  clicks: { total: number; last30: number };
  leads: { total: number; byStatus: Record<string, number> };
  sales: { total: number; activeClients: number; cancelled: number };
  commissions: { pending: number; available: number; paid: number; total: number };
  conversion: number;
  series?: { month: string; sales: number; commission: number }[];
}

export interface Affiliate {
  id: number;
  code: string;
  name: string;
  email: string;
  whatsapp: string;
  document: string | null;
  asaasWalletId: string | null;
  walletStatus: WalletStatus;
  status: AffiliateStatus;
  planId: number | null;
  planName: string | null;
  pitch: string | null;
  approvedAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  /** Campos extras da gestão (o backend deve incluí-los no detalhe). */
  adminNotes?: string | null;
  rulesOverride?: CommissionRule[] | null;
}

export interface AffiliateRow extends Affiliate { stats?: AffiliateStats }

export interface AffiliatePlan {
  id: number;
  name: string;
  description: string | null;
  rules: CommissionRule[];
  isDefault: boolean;
  isActive: boolean;
}

export interface AffiliateLead {
  id: number;
  affiliateId: number;
  affiliateName?: string;
  affiliateCode?: string;
  name: string;
  whatsapp: string;
  email: string | null;
  business: string | null;
  system: string;
  message: string | null;
  status: LeadStatus;
  adminNotes?: string | null;
  createdAt: string;
}

export interface AffiliateReferral {
  id: number;
  affiliateId: number;
  affiliateName?: string;
  affiliateCode?: string;
  customerName: string;
  planValue: number;
  status: ReferralStatus;
  startedAt: string;
  develoiClientId?: string | null;
  tenantId?: number | null;
  totalMonths?: number | null;
  countedMonths?: number;
}

export interface AffiliateCommission {
  id: number;
  referralId: number;
  affiliateId: number;
  affiliateName?: string;
  affiliateCode?: string;
  customerName: string;
  sequence: number;
  status: CommissionStatus;
  grossValue: number;
  netValue: number | null;
  commissionValue: number;
  ruleType: RuleType;
  ruleValue: number;
  dueDate: string | null;
  paidAt: string | null;
}

export interface CommissionTotals { pending: number; available: number; paid: number }

export interface AffiliateGoal {
  id: number;
  affiliateId: number | null;
  affiliateName?: string | null;
  title: string;
  metric: GoalMetric;
  target: number;
  reward: string | null;
  periodStart: string;
  periodEnd: string;
  createdBy: string;
}

export interface AffiliateEvent {
  id: number;
  type: string;
  attempts: number;
  deliveredAt: string | null;
  nextTryAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface Overview {
  affiliates: { total: number; pending: number; active: number; suspended: number };
  leads: { total: number; new: number };
  sales: { total: number; activeClients: number };
  commissions: { pending: number; available: number; paid: number };
  clicks30: number;
  webhook: { pending: number; failed: number };
}

// ─── Chamadas ──────────────────────────────────────────────────────────────
export async function adminApi<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getStoredToken()}` },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data?.error || `Erro ${response.status}`);
  return data;
}

export function errorMessage(error: unknown, fallback = "Algo deu errado. Tente novamente.") {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Carrega um recurso da API e permite recarregar. */
export function useAdminData<T>(path: string, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    adminApi<T>(path)
      .then(setData)
      .catch((e) => setError(errorMessage(e, "Não foi possível carregar os dados.")))
      .finally(() => setLoading(false));
  }, [path, enabled]);

  useEffect(reload, [reload]);
  return { data, loading, error, reload, setData };
}

// ─── Formatação ────────────────────────────────────────────────────────────
export const brl = (value: number | string | null | undefined) =>
  Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function dateBR(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function dateTimeBR(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function maskPhone(value: string) {
  const d = value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const waLink = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  return `https://wa.me/${d.startsWith("55") ? d : `55${d}`}`;
};

// ─── Rótulos e cores de status ─────────────────────────────────────────────
type BadgeColor = "default" | "primary" | "success" | "warning" | "danger" | "info" | "purple" | "orange" | "teal";
export interface StatusMeta { label: string; color: BadgeColor }

export const AFFILIATE_STATUS: Record<AffiliateStatus, StatusMeta> = {
  pending: { label: "Aguardando aprovação", color: "warning" },
  active: { label: "Ativo", color: "success" },
  suspended: { label: "Suspenso", color: "danger" },
  rejected: { label: "Recusado", color: "default" },
};
export const WALLET_STATUS: Record<WalletStatus, StatusMeta> = {
  pending: { label: "Carteira a validar", color: "warning" },
  verified: { label: "Carteira validada", color: "success" },
};
export const LEAD_STATUS: Record<LeadStatus, StatusMeta> = {
  new: { label: "Novo", color: "info" },
  contacted: { label: "Contatado", color: "purple" },
  negotiating: { label: "Negociando", color: "warning" },
  won: { label: "Fechou", color: "success" },
  lost: { label: "Perdido", color: "default" },
};
export const REFERRAL_STATUS: Record<ReferralStatus, StatusMeta> = {
  trial: { label: "Em teste", color: "info" },
  active: { label: "Ativo", color: "success" },
  overdue: { label: "Em atraso", color: "warning" },
  cancelled: { label: "Cancelado", color: "default" },
};
export const COMMISSION_STATUS: Record<CommissionStatus, StatusMeta> = {
  pending: { label: "Pendente", color: "warning" },
  confirmed: { label: "Confirmada", color: "info" },
  received: { label: "Recebida", color: "teal" },
  paid: { label: "Paga", color: "success" },
  refunded: { label: "Estornada", color: "danger" },
  cancelled: { label: "Cancelada", color: "default" },
  blocked: { label: "Bloqueada", color: "danger" },
};
export const METRIC_LABEL: Record<GoalMetric, string> = { leads: "Contatos (leads)", sales: "Vendas", commission: "Comissão (R$)" };
export const SYSTEM_LABEL: Record<string, string> = { store: "Store BoxSys", menu: "Menu BoxSys", ambos: "Os dois" };

// ─── Faixas de comissão (espelha as regras do contrato) ────────────────────
export const MAX_PERCENT = 100;
export const MAX_FIXED = 100_000;
export const MAX_RULES = 12;

/** Linha do editor: o mês inicial é sempre automático (anterior + 1), então as faixas nascem seguidas. */
export interface RuleDraft { to: string; type: RuleType; value: string }

export function rulesToDraft(rules: CommissionRule[] | null | undefined): RuleDraft[] {
  if (!rules || rules.length === 0) return [{ to: "1", type: "percent", value: "" }];
  return rules.map((r) => ({ to: r.to === null ? "" : String(r.to), type: r.type, value: String(r.value) }));
}

/** Converte as linhas em faixas (com `from` calculado). Linhas inválidas viram NaN e são pegas na validação. */
export function draftToRules(draft: RuleDraft[]): CommissionRule[] {
  let next = 1;
  return draft.map((row) => {
    const from = next;
    const to = row.to.trim() === "" ? null : Number(row.to);
    next = to === null || !Number.isFinite(to) ? from + 1 : to + 1;
    return { from, to, type: row.type, value: Number(String(row.value).replace(",", ".")) };
  });
}

/** Erros por linha (índice -> mensagem) e erros gerais. */
export function validateDraft(draft: RuleDraft[]): { rows: Record<number, string>; general: string | null } {
  const rows: Record<number, string> = {};
  let general: string | null = null;
  if (draft.length === 0) return { rows, general: "Informe ao menos uma faixa de comissão." };
  if (draft.length > MAX_RULES) general = `No máximo ${MAX_RULES} faixas por plano.`;

  const rules = draftToRules(draft);
  rules.forEach((rule, i) => {
    const isLast = i === rules.length - 1;
    if (rule.to === null && !isLast) rows[i] = "Só a última faixa pode ficar sem mês final.";
    else if (rule.to !== null && (!Number.isInteger(rule.to) || rule.to < rule.from)) rows[i] = `O mês final precisa ser inteiro e a partir do mês ${rule.from}.`;
    else if (!Number.isFinite(rule.value) || rule.value <= 0) rows[i] = "Informe um valor maior que zero.";
    else if (rule.type === "percent" && rule.value > MAX_PERCENT) rows[i] = `O percentual máximo é ${MAX_PERCENT}%.`;
    else if (rule.type === "fixed" && rule.value > MAX_FIXED) rows[i] = "Valor fixo alto demais.";
  });
  return { rows, general };
}

export function describeRule(rule: CommissionRule) {
  const months = rule.to === null ? `do mês ${rule.from} em diante` : rule.from === rule.to ? `mês ${rule.from}` : `meses ${rule.from} a ${rule.to}`;
  const amount = rule.type === "percent" ? `${String(rule.value).replace(".", ",")}%` : brl(rule.value);
  return `${months}: ${amount}`;
}

export function describeRules(rules: CommissionRule[] | null | undefined) {
  if (!rules || rules.length === 0) return "Sem regras definidas";
  return rules.map(describeRule).join(" · ");
}

/** Quantos meses o afiliado recebe (null = enquanto o cliente pagar). */
export function windowOf(rules: CommissionRule[] | null | undefined): number | null {
  if (!rules || rules.length === 0) return 0;
  return rules[rules.length - 1].to;
}
