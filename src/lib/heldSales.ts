// Vendas em espera (comanda) — "segurar" o carrinho atual do PDV pra atender outro
// cliente e retomar depois. Estoque é reservado ao segurar e só volta a ficar
// disponível se a venda em espera for cancelada (nunca ao retomar).

export interface HeldSaleItem {
  id: number;
  held_sale_id: number;
  product_id: number;
  name: string;
  quantity: number;
  unit_price: number | string;
  selected_options: Record<string, string> | null;
  dimensions_label: string | null;
  resolution: "pending" | "kept" | "returned";
}

// Estado do carrinho que não tem relevância relacional (não precisa de FK pra Product) —
// tudo que uma venda em espera precisa restaurar além dos itens em si. Não inclui
// pagamento/etapa de checkout: "Segurar Venda" só é permitido antes de ir pra tela de
// pagamento (ver plano da feature).
export interface HeldSaleSnapshot {
  discount?: string;
  discountMode?: "R$" | "%";
  surcharge?: string;
  surchargeMode?: "R$" | "%";
  appliedReward?: unknown;
  customerDocument?: string;
  customerPoints?: number;
  // serviços não têm estoque (nada a reservar), então ficam só no snapshot —
  // ao contrário dos produtos, não viram HeldSaleItem.
  cartServices?: unknown[];
}

export interface HeldSale {
  id: number;
  tenant_id: number;
  number: number;
  customer_id: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  seller_id: number | null;
  seller_name: string | null;
  status: "held" | "resumed" | "cancelled" | "completed";
  notes: string | null;
  snapshot: HeldSaleSnapshot | null;
  resumed_by: string | null;
  resumed_at: string | null;
  invoiced_order_id: number | null;
  invoiced_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  items: HeldSaleItem[];
}

export interface CreateHeldSaleItemInput {
  product_id: number;
  quantity: number;
  selectedOptions?: Record<string, string> | null;
  dimensionsLabel?: string | null;
}

export interface CreateHeldSaleInput {
  customer_id?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  seller_id?: number | null;
  notes?: string;
  snapshot?: HeldSaleSnapshot;
  items: CreateHeldSaleItemInput[];
}

async function parseErrorOrThrow(res: Response, fallback: string): Promise<never> {
  const d = await res.json().catch(() => ({}));
  throw new Error(d.error ?? fallback);
}

export async function listHeldSales(token: string, status?: string): Promise<HeldSale[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await fetch(`/api/held-sales${qs}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return parseErrorOrThrow(res, "Falha ao listar vendas em espera");
  return res.json();
}

export async function getOpenHeldSalesCount(token: string): Promise<number> {
  const res = await fetch("/api/held-sales/open-count", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return 0;
  const data = await res.json();
  return Number(data?.count) || 0;
}

export async function getHeldSaleById(token: string, id: number): Promise<HeldSale> {
  const res = await fetch(`/api/held-sales/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return parseErrorOrThrow(res, "Venda em espera não encontrada");
  return res.json();
}

export async function createHeldSale(token: string, input: CreateHeldSaleInput): Promise<HeldSale> {
  const res = await fetch("/api/held-sales", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  if (!res.ok) return parseErrorOrThrow(res, "Erro ao segurar a venda");
  return res.json();
}

export async function resumeHeldSale(token: string, id: number): Promise<HeldSale> {
  const res = await fetch(`/api/held-sales/${id}/resume`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return parseErrorOrThrow(res, "Erro ao retomar a venda em espera");
  return res.json();
}

export async function cancelHeldSale(token: string, id: number, cancelReason?: string): Promise<HeldSale> {
  const res = await fetch(`/api/held-sales/${id}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ cancel_reason: cancelReason }),
  });
  if (!res.ok) return parseErrorOrThrow(res, "Erro ao cancelar a venda em espera");
  return res.json();
}
