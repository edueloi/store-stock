import { useEffect, useRef, type ComponentProps } from "react";
import { Input } from "../ui/Input";

type Props = Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type" | "step" | "min" | "max" | "ref"> & {
  value: string;
  onValueChange: (value: string) => void;
  allowZero?: boolean;
};
const formatter = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatCurrencyInput = (value: string) => value === "" ? "" : formatter.format(Number(value) || 0);
export function parseCurrencyPaste(text: string): string | null {
  const clean = text.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!/^\d[\d.,]*$/.test(clean)) return null;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(clean) ? clean.replace(/\./g, "") : clean;
  const value = Number(normalized);
  return Number.isFinite(value) && value <= 99999999.99 ? value.toFixed(2) : null;
}

/** Exibe reais e mantém o estado como decimal canônico para cálculos e API. */
export default function CurrencyInput({ value, onValueChange, allowZero = false, ...props }: Props) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.setCustomValidity(value !== "" && ((!allowZero && Number(value) <= 0) || Number(value) > 99999999.99) ? "Informe um valor válido entre R$ 0,01 e R$ 99.999.999,99." : "");
  }, [value, allowZero]);
  return <Input {...props} ref={input} type="text" inputMode="decimal" addonLeft="R$" value={formatCurrencyInput(value)}
    onChange={event => {
      const digits = event.target.value.replace(/\D/g, "");
      if (digits.length > 10) return;
      onValueChange(digits ? (Number(digits) / 100).toFixed(2) : "");
    }}
    onPaste={event => {
      const parsed = parseCurrencyPaste(event.clipboardData.getData("text"));
      event.preventDefault();
      if (parsed !== null) onValueChange(parsed);
    }}/>;
}
