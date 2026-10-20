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
const EMPTY = {
  name: "", cpfCnpj: "", email: "", mobilePhone: "", birthDate: "", companyType: "MEI", incomeValue: "",
  postalCode: "", address: "", addressNumber: "", province: "",
};

export default function AsaasAccountSetup({ gateway, headers, onChanged, onMessage }: Props) {
  const [open, setOpen] = useState(!gateway?.connected);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState({
    discountValue: String(gateway?.rules?.discount?.value ?? ""),
    discountType: gateway?.rules?.discount?.type ?? "PERCENTAGE",
    discountDays: String(gateway?.rules?.discount?.days ?? 0),
    interest: String(gateway?.rules?.interest?.percent ?? ""),
    fine: String(gateway?.rules?.fine?.percent ?? ""),
  });

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const isCpf = digits(form.cpfCnpj).length <= 11;

  const lookupCep = async () => {
    const cep = digits(form.postalCode);
    if (cep.length !== 8) return;
    try {
      const d = await (await fetch(`https://viacep.com.br/ws/${cep}/json/`)).json();
      if (!d.erro) setForm((f) => ({ ...f, address: d.logradouro || f.address, province: d.bairro || f.province }));
    } catch { /* preenchimento manual */ }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/tenant/payment-gateways/asaas/onboard", {
        method: "POST", headers: headers(),
        body: JSON.stringify({
          ...form,
          incomeValue: Number(form.incomeValue.replace(",", ".")),
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

  const required = ["name", "cpfCnpj", "email", "mobilePhone", "incomeValue", "postalCode", "address", "addressNumber", "province"] as const;
  const canSubmit = required.every((k) => form[k].trim()) && (!isCpf || Boolean(form.birthDate));

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
            <Input label="Nome / Razão social" value={form.name} onChange={set("name")} />
            <Input label="CPF ou CNPJ" inputMode="numeric" value={form.cpfCnpj} onChange={set("cpfCnpj")} />
            {isCpf
              ? <Input label="Data de nascimento" type="date" value={form.birthDate} onChange={set("birthDate")} />
              : (
                <Select label="Tipo da empresa" value={form.companyType} onChange={set("companyType")}>
                  <option value="MEI">MEI</option>
                  <option value="INDIVIDUAL">Empresário individual</option>
                  <option value="LIMITED">Empresa limitada (LTDA)</option>
                  <option value="ASSOCIATION">Associação</option>
                </Select>
              )}
            <Input label="E-mail" type="email" value={form.email} onChange={set("email")} />
            <Input label="Celular" inputMode="tel" value={form.mobilePhone} onChange={set("mobilePhone")} />
            <Input label="Faturamento/renda mensal (R$)" inputMode="decimal" value={form.incomeValue} onChange={set("incomeValue")} />
            <Input label="CEP" inputMode="numeric" value={form.postalCode} onChange={set("postalCode")} onBlur={lookupCep} />
            <Input label="Endereço" value={form.address} onChange={set("address")} />
            <Input label="Número" value={form.addressNumber} onChange={set("addressNumber")} />
            <Input label="Bairro" value={form.province} onChange={set("province")} />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="md" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" variant="primary" size="md" loading={busy} disabled={!canSubmit || busy} onClick={submit}>Criar conta</Button>
          </div>
        </div>
      )}
    </div>
  );
}
