import React, { useState } from "react";
import { Button } from "../ui/Button";
import { Input, Select } from "../ui/Input";
import { Alert } from "../ui/Alert";
import AsaasReceivingPanel from "./AsaasReceivingPanel";

export interface AsaasGatewayInfo {
  connected: boolean;
  managed?: boolean;
  fee_percent?: number | null;
  rules?: {
    discount?: { value: number; type: "FIXED" | "PERCENTAGE"; days: number };
    interest?: { percent: number };
    fine?: { percent: number };
  } | null;
}

interface Props {
  gateway?: AsaasGatewayInfo;
  headers: () => Record<string, string>;
  onChanged: () => void;
  onMessage: (type: "success" | "error", text: string) => void;
}

const digits = (v: string) => v.replace(/\D/g, "");

const maskCpfCnpj = (v: string) => {
  const d = digits(v).slice(0, 14);
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
};
const maskPhone = (v: string) => {
  const d = digits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
const maskCep = (v: string) => {
  const d = digits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};
const maskMoney = (v: string) => {
  const d = digits(v).slice(0, 11);
  if (!d) return "";
  return (Number(d) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const moneyToNumber = (v: string) => Number(v.replace(/\./g, "").replace(",", ".")) || 0;
const validCpfCnpj = (v: string) => [11, 14].includes(digits(v).length);
const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const EMPTY = {
  name: "", cpfCnpj: "", email: "", mobilePhone: "", birthDate: "", companyType: "MEI", incomeValue: "",
  postalCode: "", address: "", addressNumber: "", province: "",
};

export default function AsaasAccountSetup({ gateway, headers, onChanged, onMessage }: Props) {
  const [open, setOpen] = useState(!gateway?.connected);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [cepState, setCepState] = useState<"idle" | "loading" | "notfound">("idle");
  const [rules, setRules] = useState({
    discountValue: String(gateway?.rules?.discount?.value ?? ""),
    discountType: gateway?.rules?.discount?.type ?? "PERCENTAGE",
    discountDays: String(gateway?.rules?.discount?.days ?? 0),
    interest: String(gateway?.rules?.interest?.percent ?? ""),
    fine: String(gateway?.rules?.fine?.percent ?? ""),
  });

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const setMasked = (k: keyof typeof EMPTY, mask: (v: string) => string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: mask(e.target.value) }));
  const isCpf = digits(form.cpfCnpj).length <= 11;
  const errors: Partial<Record<keyof typeof EMPTY, string>> = {};
  if (form.name.trim().length < 3) errors.name = "Informe o nome";
  if (!validCpfCnpj(form.cpfCnpj)) errors.cpfCnpj = "CPF ou CNPJ incompleto";
  if (isCpf && !form.birthDate) errors.birthDate = "Informe a data";
  if (!validEmail(form.email)) errors.email = "E-mail inválido";
  if (digits(form.mobilePhone).length < 10) errors.mobilePhone = "Celular incompleto";
  if (!(moneyToNumber(form.incomeValue) > 0)) errors.incomeValue = "Informe o valor";
  if (digits(form.postalCode).length !== 8) errors.postalCode = "CEP incompleto";
  if (!form.address.trim()) errors.address = "Informe o endereço";
  if (!form.addressNumber.trim()) errors.addressNumber = "Informe o número";
  if (!form.province.trim()) errors.province = "Informe o bairro";
  const err = (k: keyof typeof EMPTY) => (tried ? errors[k] : undefined);

  const lookupCep = async (raw = form.postalCode) => {
    const cep = digits(raw);
    if (cep.length !== 8) return;
    setCepState("loading");
    try {
      const d = await (await fetch(`https://viacep.com.br/ws/${cep}/json/`)).json();
      if (d.erro) { setCepState("notfound"); return; }
      setCepState("idle");
      setForm((f) => ({ ...f, address: d.logradouro || f.address, province: d.bairro || f.province }));
    } catch {
      setCepState("notfound");
    }
  };

  const onCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCep(e.target.value);
    setForm((f) => ({ ...f, postalCode: masked }));
    if (digits(masked).length === 8) lookupCep(masked);
    else setCepState("idle");
  };

  const submit = async () => {
    setTried(true);
    if (Object.keys(errors).length) {
      onMessage("error", "Preencha os campos destacados em vermelho.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/tenant/payment-gateways/asaas/onboard", {
        method: "POST", headers: headers(),
        body: JSON.stringify({
          ...form,
          incomeValue: moneyToNumber(form.incomeValue),
          birthDate: isCpf ? form.birthDate : undefined,
          companyType: isCpf ? undefined : form.companyType,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível abrir a conta.");
      onMessage("success", "Conta de recebimento criada. O Asaas pode pedir documentos por e-mail.");
      setOpen(false);
      onChanged();
    } catch (e) {
      onMessage("error", e instanceof Error ? e.message : "Não foi possível abrir a conta.");
    } finally {
      setBusy(false);
    }
  };

  const saveRules = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/tenant/payment-gateways/asaas/rules", {
        method: "PUT", headers: headers(),
        body: JSON.stringify({
          discount: { value: Number(rules.discountValue.replace(",", ".")) || 0, type: rules.discountType, days: Number(rules.discountDays) || 0 },
          interest: { percent: Number(rules.interest.replace(",", ".")) || 0 },
          fine: { percent: Number(rules.fine.replace(",", ".")) || 0 },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar as regras.");
      onMessage("success", "Regras de cobrança salvas.");
      onChanged();
    } catch (e) {
      onMessage("error", e instanceof Error ? e.message : "Não foi possível salvar as regras.");
    } finally {
      setBusy(false);
    }
  };

  if (gateway?.managed) {
    return (
      <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
        <Alert variant="success">
          Conta de recebimento ativa. Você recebe direto na sua conta Asaas; a plataforma retém {gateway.fee_percent ?? 2}% de cada venda online.
        </Alert>
        <AsaasReceivingPanel headers={headers} onMessage={onMessage} />
        <p className="text-[11px] font-semibold text-slate-700">Regras das cobranças (valem para links e checkout)</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Input label="Desconto" inputMode="decimal" value={rules.discountValue} onChange={(e) => setRules({ ...rules, discountValue: e.target.value })} />
          <Select label="Tipo" value={rules.discountType} onChange={(e) => setRules({ ...rules, discountType: e.target.value as "FIXED" | "PERCENTAGE" })}>
            <option value="PERCENTAGE">% do valor</option>
            <option value="FIXED">R$ fixo</option>
          </Select>
          <Input label="Dias antes do vencimento" inputMode="numeric" value={rules.discountDays} onChange={(e) => setRules({ ...rules, discountDays: e.target.value })} />
          <Input label="Juros ao mês (%)" inputMode="decimal" value={rules.interest} onChange={(e) => setRules({ ...rules, interest: e.target.value })} />
          <Input label="Multa por atraso (%)" inputMode="decimal" value={rules.fine} onChange={(e) => setRules({ ...rules, fine: e.target.value })} />
        </div>
        <Button type="button" variant="primary" size="md" loading={busy} onClick={saveRules}>Salvar regras</Button>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-slate-200 pt-3">
      {!open ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-slate-500">
            Não tem conta Asaas? Abra uma aqui. Você recebe direto na sua conta e a plataforma retém 2% de cada venda online.
          </p>
          <Button type="button" variant="outline" size="md" onClick={() => setOpen(true)}>Abrir conta de recebimento</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {gateway?.connected && (
            <Alert variant="warning">Esta loja já tem um token Asaas próprio. Abrir a conta de recebimento substitui esse token.</Alert>
          )}
          <p className="text-[11px] text-slate-500">Use os dados de quem vai receber (CPF ou CNPJ). O Asaas valida o cadastro e pode pedir documentos.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input label="Nome / Razão social" value={form.name} onChange={set("name")} error={err("name")} />
            <Input label="CPF ou CNPJ" inputMode="numeric" placeholder="000.000.000-00" value={form.cpfCnpj} onChange={setMasked("cpfCnpj", maskCpfCnpj)} error={err("cpfCnpj")} />
            {isCpf
              ? <Input label="Data de nascimento" type="date" value={form.birthDate} onChange={set("birthDate")} error={err("birthDate")} />
              : (
                <Select label="Tipo da empresa" value={form.companyType} onChange={set("companyType")}>
                  <option value="MEI">MEI</option>
                  <option value="INDIVIDUAL">Empresário individual</option>
                  <option value="LIMITED">Empresa limitada (LTDA)</option>
                  <option value="ASSOCIATION">Associação</option>
                </Select>
              )}
            <Input label="E-mail" type="email" value={form.email} onChange={set("email")} error={err("email")} />
            <Input label="Celular" inputMode="tel" placeholder="(00) 00000-0000" value={form.mobilePhone} onChange={setMasked("mobilePhone", maskPhone)} error={err("mobilePhone")} />
            <Input label="Faturamento/renda mensal (R$)" inputMode="numeric" placeholder="0,00" value={form.incomeValue} onChange={setMasked("incomeValue", maskMoney)} error={err("incomeValue")} />
            <Input
              label="CEP"
              inputMode="numeric"
              placeholder="00000-000"
              value={form.postalCode}
              onChange={onCepChange}
              error={err("postalCode") || (cepState === "notfound" ? "CEP não encontrado — preencha o endereço" : undefined)}
              hint={cepState === "loading" ? "Buscando endereço..." : undefined}
            />
            <Input label="Endereço" value={form.address} onChange={set("address")} error={err("address")} />
            <Input label="Número" value={form.addressNumber} onChange={set("addressNumber")} error={err("addressNumber")} />
            <Input label="Bairro" value={form.province} onChange={set("province")} error={err("province")} />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="md" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" variant="primary" size="md" loading={busy} disabled={busy} onClick={submit}>Criar conta</Button>
          </div>
        </div>
      )}
    </div>
  );
}
