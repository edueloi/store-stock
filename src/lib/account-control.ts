export interface ControlAccount { id: number; description: string; amount: number; due_date: string; status: string; category?: string | null; supplier_name?: string | null; customer_name?: string | null; notes?: string | null; document_number?: string | null; cost_center?: string | null; series_id?: number | null; is_recurring?: boolean; cost_type?: string | null; }
export const accountDay = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const norm = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export const accountKind = (item: ControlAccount) => item.series_id ? "installments" : item.is_recurring ? "recurring" : "single";
export const accountKindLabel = (item: ControlAccount) => ({ installments: "Parcelada", recurring: "Recorrente", single: "Única" })[accountKind(item)];
export function controlAccounts<T extends ControlAccount>(items: T[], options: { search: string; category: string; kind: string; due: string; from?: string; to?: string; costType?: string; sort: string }) {
  const today = accountDay(), end = new Date(); end.setDate(end.getDate() + 7); const week = accountDay(end);
  return items.map(item => ({ ...item, status: item.status === "pending" && item.due_date.slice(0, 10) < today ? "overdue" : item.status })).filter(item => {
    const due = item.due_date.slice(0, 10), open = item.status === "pending" || item.status === "overdue";
    if (options.from && due < options.from || options.to && due > options.to) return false;
    if (options.category && item.category !== options.category || options.kind !== "all" && accountKind(item) !== options.kind) return false;
    if (options.costType && options.costType !== "all" && item.cost_type !== options.costType) return false;
    if (options.due !== "all" && (!open || (options.due === "today" ? due !== today : options.due === "overdue" ? due >= today : due < today || due > week))) return false;
    return !options.search || norm([item.description, item.supplier_name, item.customer_name, item.category, item.document_number, item.cost_center, item.notes].filter(Boolean).join(" ")).includes(norm(options.search));
  }).sort((a, b) => options.sort === "amount_desc" ? Number(b.amount) - Number(a.amount) : options.sort === "amount_asc" ? Number(a.amount) - Number(b.amount) : options.sort === "due_desc" ? b.due_date.localeCompare(a.due_date) : a.due_date.localeCompare(b.due_date));
}
