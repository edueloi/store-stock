export function parsePaymentSegments(pm: string, totalAmount = 0, changeAmount = 0) {
  const parts = pm.split("|");
  return parts.map(part => {
    const [methodPart, amountStr] = part.split(":");
    const [method = "money", brand = "other", installments] = methodPart.split("-");
    // Formas antigas/editadas podem não trazer ":valor". Só uma forma única
    // permite inferir o valor, sem inventar a divisão de um pagamento misto.
    const fallback = parts.length === 1 ? totalAmount + (method === "money" ? changeAmount : 0) : 0;
    return { method, brand, installments: installments ? parseInt(installments.replace("x", ""), 10) : 1,
      amount: amountStr === undefined ? fallback : parseFloat(amountStr) || 0 };
  });
}
