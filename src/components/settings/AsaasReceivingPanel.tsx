import React, { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "../ui/Button";
import { Input, Select } from "../ui/Input";
import { Alert } from "../ui/Alert";

interface Props {
  headers: () => Record<string, string>;
  onMessage: (type: "success" | "error", text: string) => void;
}

interface Overview {
  status: { general?: string; commercialInfo?: string; bankAccountInfo?: string; documentation?: string } | null;
  balance: number | null;
  documentsUrl: string | null;
}

const STATUS_LABEL: Record<string, { text: string; tone: string }> = {
  APPROVED: { text: "Aprovado", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PENDING: { text: "Pendente", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  AWAITING_APPROVAL: { text: "Em análise", tone: "bg-sky-50 text-sky-700 border-sky-200" },
  REJECTED: { text: "Recusado", tone: "bg-red-50 text-red-700 border-red-200" },
};
const label = (s?: string) => STATUS_LABEL[s || ""] ?? { text: s || "—", tone: "bg-slate-50 text-slate-600 border-slate-200" };
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AsaasReceivingPanel({ headers, onMessage }: Props) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState("");
  const [pixKeyType, setPixKeyType] = useState("CPF");
  const [pixKey, setPixKey] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tenant/payment-gateways/asaas/account", { headers: headers() });
      if (res.ok) setData(await res.json());
    } catch { /* painel informativo */ } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const withdraw = async () => {
    const amount = Number(value.replace(",", "."));
    if (!(amount > 0)) return onMessage("error", "Informe o valor do saque.");
    if (!pixKey.trim()) return onMessage("error", "Informe a chave Pix.");
    setBusy(true);
    try {
      const res = await fetch("/api/tenant/payment-gateways/asaas/withdraw", {
        method: "POST", headers: headers(),
        body: JSON.stringify({ value: amount, pixKeyType, pixKey: pixKey.trim() }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Não foi possível sacar.");
      onMessage("success", "Saque solicitado. O Pix costuma cair em instantes.");
      setValue("");
      load();
    } catch (e) {
      onMessage("error", e instanceof Error ? e.message : "Não foi possível sacar.");
    } finally {
      setBusy(false);
    }
  };

  const general = data?.status?.general;
  const approved = general === "APPROVED";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-slate-700">Seus recebimentos</p>
        <Button type="button" variant="outline" size="sm" onClick={load} loading={loading} iconLeft={<RefreshCw size={12} />}>Atualizar</Button>
      </div>

      {data?.status && (
        <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold">
          {([["Cadastro", general], ["Dados comerciais", data.status.commercialInfo], ["Conta bancária", data.status.bankAccountInfo], ["Documentos", data.status.documentation]] as const).map(([name, st]) => (
            <span key={name} className={`rounded-md border px-2 py-1 ${label(st).tone}`}>{name}: {label(st).text}</span>
          ))}
        </div>
      )}

      {!approved && (
        <Alert variant="warning">
          Seu cadastro no Asaas ainda não foi aprovado. Enquanto isso você não consegue receber nem sacar.
          {data?.documentsUrl && (
            <> <a className="inline-flex items-center gap-1 font-semibold underline" href={data.documentsUrl} target="_blank" rel="noreferrer">Enviar documentos <ExternalLink size={11} /></a></>
          )}
        </Alert>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Saldo disponível no Asaas</p>
        <p className="text-xl font-semibold text-slate-800">{data?.balance != null ? brl(data.balance) : "—"}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[110px_130px_1fr_auto]">
        <Input label="Valor (R$)" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
        <Select label="Tipo da chave" value={pixKeyType} onChange={(e) => setPixKeyType(e.target.value)}>
          <option value="CPF">CPF</option>
          <option value="CNPJ">CNPJ</option>
          <option value="EMAIL">E-mail</option>
          <option value="PHONE">Celular</option>
          <option value="EVP">Chave aleatória</option>
        </Select>
        <Input label="Chave Pix da sua conta bancária" value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
        <div className="flex items-end">
          <Button type="button" variant="primary" size="md" loading={busy} disabled={busy || !approved} onClick={withdraw}>Sacar por Pix</Button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
        <p className="mb-1 font-semibold text-slate-700">Quando o dinheiro cai no saldo (prazos padrão do Asaas)</p>
        <ul className="list-disc space-y-0.5 pl-4">
          <li><b>Pix:</b> cai no saldo em instantes.</li>
          <li><b>Boleto:</b> cerca de 1 dia útil após o pagamento ser compensado.</li>
          <li><b>Cartão de crédito:</b> em geral cerca de 30 dias; dá para antecipar pelo painel do Asaas, com taxa.</li>
        </ul>
        <p className="mt-1.5">O saque por Pix da sua conta Asaas para o seu banco costuma ser imediato. Os prazos e taxas dependem do seu plano no Asaas e podem mudar.</p>
      </div>
    </div>
  );
}
