export interface CashSessionInfo {
  id: number;
  opened_at: string;
  opening_amount: number | string;
  opened_by_name: string;
}

export interface CashSessionPaymentBreakdownEntry {
  expected: number;
  counted?: number;
  difference?: number;
}

export interface ClosedCashSession {
  id: number;
  opening_amount: number | string;
  counted_amount: number | string;
  expected_amount: number | string;
  difference_amount: number | string;
  payment_breakdown: Record<string, CashSessionPaymentBreakdownEntry> | null;
  opened_at: string;
  closed_at: string;
}

export async function fetchCurrentCashSession(
  token: string
): Promise<{ requireCashSession: boolean; session: CashSessionInfo | null }> {
  const res = await fetch("/api/cash-sessions/current", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Falha ao consultar sessão de caixa");
  return res.json();
}

export async function openCashSession(
  token: string,
  openingAmount: number,
  openingNote?: string
): Promise<CashSessionInfo> {
  const res = await fetch("/api/cash-sessions/open", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ openingAmount, openingNote }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error ?? "Erro ao abrir caixa");
  }
  const data = await res.json();
  return data.session;
}

export async function closeCashSession(
  token: string,
  sessionId: number,
  countedAmount: number,
  countedBreakdown?: Record<string, number>,
  closingNote?: string
): Promise<ClosedCashSession> {
  const res = await fetch(`/api/cash-sessions/${sessionId}/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ countedAmount, countedBreakdown, closingNote }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error ?? "Erro ao fechar caixa");
  }
  const data = await res.json();
  return data.session;
}
