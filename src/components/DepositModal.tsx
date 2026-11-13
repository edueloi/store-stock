import { useEffect, useState } from "react";
import { Banknote, CreditCard, QrCode, Wallet } from "lucide-react";
import { Button, Input, Modal, ModalFooter } from "./ui";
import { cn } from "../lib/utils";

type Method = "money" | "debit" | "credit" | "pix";
type Brand = "visa" | "master" | "elo" | "amex" | "hiper" | "other";

const METHODS: { key: Method; label: string; icon: typeof Banknote }[] = [
  { key: "money", label: "Dinheiro", icon: Banknote },
  { key: "pix", label: "PIX", icon: QrCode },
  { key: "debit", label: "Débito", icon: CreditCard },
  { key: "credit", label: "Crédito", icon: CreditCard },
];
const BRANDS: { key: Brand; label: string; color: string }[] = [
  { key: "visa", label: "Visa", color: "#1A1F71" },
  { key: "master", label: "Mastercard", color: "#EB001B" },
  { key: "elo", label: "Elo", color: "#00A4E0" },
  { key: "amex", label: "Amex", color: "#2E77BC" },
  { key: "hiper", label: "Hipercard", color: "#B22222" },
  { key: "other", label: "Outra", color: "#64748b" },
];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const mask = (raw: string) => {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return (parseInt(digits, 10) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const parse = (masked: string) => parseFloat(masked.replace(/\./g, "").replace(",", ".")) || 0;
const toMasked = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Entrada (sinal) recebida antes de faturar: valor + forma de pagamento (dinheiro, PIX, débito ou crédito com bandeira e parcelas). */
export default function DepositModal({ open, onClose, saving, total, title = "Registrar Entrada", onConfirm }: {
  open: boolean;
  onClose: () => void;
  saving: boolean;
  /** total do documento: a entrada precisa ser menor que ele */
  total: number;
  title?: string;
  onConfirm: (amount: number, paymentMethod: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("money");
  const [brand, setBrand] = useState<Brand>("visa");
  const [installments, setInstallments] = useState(1);

  useEffect(() => {
    if (open) { setAmount(""); setMethod("money"); setBrand("visa"); setInstallments(1); }
  }, [open]);

  const value = parse(amount);
  const tooBig = value >= total && value > 0;
  const valid = value > 0 && value < total;
  const remaining = Math.max(0, total - value);

  const submit = () => {
    const b = method === "credit" || method === "debit" ? `-${brand}` : "";
    const inst = method === "credit" && installments > 1 ? `-${installments}x` : "";
    onConfirm(Math.round(value * 100) / 100, `${method}${b}${inst}`);
  };

  return (
    <Modal
      open={open}
      onClose={() => { if (!saving) onClose(); }}
      size="sm"
      title={title}
      subtitle={`Total: ${fmt(total)}`}
      footer={
        <ModalFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} loading={saving} disabled={!valid} iconLeft={<Wallet size={14} />}>Confirmar Entrada</Button>
        </ModalFooter>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Input label="Valor da entrada" iconLeft={<Banknote size={14} />} inputMode="numeric" value={amount}
            onChange={(e) => setAmount(mask(e.target.value))} placeholder="0,00" className="font-mono" />
          <div className="flex flex-wrap items-center gap-2">
            {[30, 50].map((p) => (
              <button key={p} type="button" onClick={() => setAmount(toMasked(Math.round(total * p) / 100))}
                className="h-7 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 transition hover:border-blue-400 hover:text-blue-700">
                {p}% · {fmt(Math.round(total * p) / 100)}
              </button>
            ))}
          </div>
          {tooBig && <p role="alert" className="text-xs text-red-600">A entrada precisa ser menor que o total. Para receber tudo, use Faturar.</p>}
          {valid && <p className="text-xs text-slate-500">Saldo a receber depois: <b className="text-slate-700">{fmt(remaining)}</b></p>}
        </div>

        <div>
          <span className="ds-label mb-2 block">Forma de pagamento</span>
          <div className="grid grid-cols-4 gap-2">
            {METHODS.map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" onClick={() => setMethod(key)}
                className={cn("flex h-12 flex-col items-center justify-center gap-1 rounded-lg border text-[11px] font-medium transition-all",
                  method === key ? "border-blue-500 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-slate-400")}>
                <Icon size={14} />{label}
              </button>
            ))}
          </div>
        </div>

        {(method === "debit" || method === "credit") && (
          <div>
            <span className="ds-label mb-2 block">Bandeira</span>
            <div className="grid grid-cols-3 gap-2">
              {BRANDS.map(({ key, label, color }) => (
                <button key={key} type="button" onClick={() => setBrand(key)}
                  className={cn("h-8 rounded-lg border text-[11px] font-medium transition-all", brand === key ? "border-transparent text-white" : "border-slate-200 bg-white text-slate-500 hover:border-slate-400")}
                  style={brand === key ? { backgroundColor: color } : {}}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {method === "credit" && (
          <div>
            <span className="ds-label mb-2 block">Parcelas</span>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                <button key={n} type="button" onClick={() => setInstallments(n)}
                  className={cn("h-9 rounded-lg border text-[11px] font-medium transition-all", installments === n ? "border-blue-500 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-slate-400")}>
                  {n === 1 ? "À vista" : `${n}×`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
