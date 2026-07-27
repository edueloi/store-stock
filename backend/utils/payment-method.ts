export interface PaymentMethodSegment {
  method: string;
  brand: string;
  installments: number;
  amount: number;
}

// Parses "credit-visa-2x:120.00|money:30.00" into structured segments
export function parsePaymentMethod(pm: string): PaymentMethodSegment[] {
  return pm.split("|").map((seg) => {
    const [methodPart, amountStr] = seg.split(":");
    const tokens = methodPart.split("-");
    return {
      method:       tokens[0] ?? "money",
      brand:        tokens[1] ?? "other",
      installments: tokens[2] ? parseInt(tokens[2].replace("x", ""), 10) : 1,
      amount:       parseFloat(amountStr ?? "0") || 0,
    };
  });
}

const METHOD_LABELS: Record<string, string> = {
  money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito", crediario: "Crediário",
};

export function buildMethodSummary(pm: string): string {
  return parsePaymentMethod(pm).map(({ method, brand, installments }) => {
    const b = brand && brand !== "other" ? `/${brand.toUpperCase()}` : "";
    const i = method === "credit" && installments > 1 ? ` ${installments}X` : "";
    return `${METHOD_LABELS[method] ?? method}${b}${i}`;
  }).join(" + ");
}
