import { useEffect, useSyncExternalStore } from "react";

// Formas de pagamento aceitas no PDV. Por padrão TODAS ficam ligadas; a loja desliga o que não usa
// (ex.: Crediário) em Configurações > Pagamentos. A lista de desligadas fica em payment_methods.pdv_disabled.
export type PdvMethod = "money" | "pix" | "debit" | "credit" | "crediario";
export const PDV_METHODS: { key: PdvMethod; label: string }[] = [
  { key: "money", label: "Dinheiro" },
  { key: "pix", label: "PIX" },
  { key: "debit", label: "Débito" },
  { key: "credit", label: "Crédito" },
  { key: "crediario", label: "Crediário" },
];

let disabled: string[] = [];
let loaded = false;
const subs = new Set<() => void>();
const subscribe = (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; };
const snapshot = () => disabled;

export function setPdvDisabled(list: unknown) {
  const next = Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  if (next.join("|") === disabled.join("|")) return;
  disabled = next;
  subs.forEach((fn) => fn());
}

/** Primeira forma ligada, na ordem de uso mais comum — padrão de cada pagamento novo. */
export function defaultPdvMethod(): PdvMethod {
  return (["money", "pix", "debit", "credit", "crediario"] as PdvMethod[]).find((m) => !disabled.includes(m)) ?? "money";
}

async function load() {
  try {
    const token = localStorage.getItem("token");
    if (!token) { loaded = false; return; }
    const res = await fetch("/api/tenant", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { loaded = false; return; }
    const d = await res.json();
    setPdvDisabled(d?.payment_methods?.pdv_disabled);
  } catch { loaded = false; }
}

/** Formas ligadas/desligadas no PDV (carrega uma vez e atualiza todas as telas quando a configuração muda). */
export function usePdvPayments() {
  useEffect(() => { if (!loaded) { loaded = true; void load(); } }, []);
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);
  return {
    disabled: list,
    isEnabled: (m: string) => !list.includes(m),
    cardEnabled: !list.includes("debit") || !list.includes("credit"),
  };
}
