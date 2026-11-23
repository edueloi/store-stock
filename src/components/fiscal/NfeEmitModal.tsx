import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";

import { Alert, Button, Input, Select } from "../ui";
import Modal from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { useCnpjLookup, type CnpjInfo } from "../../lib/cnpjLookup";
import CnpjStatusNotice from "../CnpjStatusNotice";

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
const jsonHeader = () => ({ ...authHeader(), "Content-Type": "application/json" });
const digits = (v: string) => v.replace(/\D/g, "");

interface Preview {
  order: { id: number; total_amount: number; customer_name: string | null; items_count: number; order_label?: string | null };
  recipient: {
    document: string; name: string; ie_indicator: "1" | "2" | "9"; ie?: string | null; email?: string | null; phone?: string | null;
    address: { street: string; number: string; complement?: string | null; district: string; city: string; state: string; zip: string; city_code: string };
  } | null;
  recipient_problems: string[];
  environment: "homologacao" | "producao";
  series: number;
  next_number: number;
  defaults: {
    nature: string;
    freight: { mode: string; value: number; carrier?: { document?: string | null; name?: string | null } | null };
    ind_pres: string;
    additional_info: string;
    final_consumer: boolean | null;
  };
  invoice: { status: string; rejection_reason?: string | null; number: number } | null;
  warnings: string[];
}

interface Form {
  document: string; name: string; ie_indicator: "1" | "2" | "9"; ie: string; email: string; phone: string;
  street: string; number: string; complement: string; district: string; city: string; state: string; zip: string; city_code: string;
  freightMode: string; freightValue: string; carrierName: string; carrierDocument: string;
  nature: string; additionalInfo: string; indPres: string; finalConsumer: boolean;
}

const EMPTY: Form = {
  document: "", name: "", ie_indicator: "9", ie: "", email: "", phone: "", street: "", number: "", complement: "", district: "", city: "", state: "", zip: "", city_code: "",
  freightMode: "9", freightValue: "", carrierName: "", carrierDocument: "", nature: "Venda de mercadoria", additionalInfo: "", indPres: "1", finalConsumer: true,
};

const FREIGHT_OPTIONS = [
  { value: "9", label: "9 · Sem frete / sem transporte" },
  { value: "0", label: "0 · Por conta do remetente (CIF)" },
  { value: "1", label: "1 · Por conta do destinatário (FOB)" },
  { value: "2", label: "2 · Por conta de terceiros" },
  { value: "3", label: "3 · Transporte próprio do remetente" },
  { value: "4", label: "4 · Transporte próprio do destinatário" },
];

const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Emitir NF-e (modelo 55) de um pedido. Abre já preenchido com o cliente do pedido; o operador confere destinatário,
 * frete e natureza da operação antes de enviar à SEFAZ. A emissão roda em segundo plano e a tela atualiza sozinha.
 */
export default function NfeEmitModal({ orderId, onClose, onDone }: { orderId: number | null; onClose: () => void; onDone?: () => void }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [cityLookup, setCityLookup] = useState(false);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  // Consulta o CNPJ na Receita ao completar os 14 dígitos: completa só o que estiver vazio
  const cnpj = useCnpjLookup((d: CnpjInfo) => {
    setForm((f) => ({
      ...f,
      name: f.name.trim() ? f.name : (d.legal_name || d.trade_name),
      email: f.email.trim() ? f.email : d.email,
      phone: f.phone.trim() ? f.phone : d.phone,
      street: f.street.trim() ? f.street : d.address.street,
      number: f.number.trim() ? f.number : d.address.number,
      complement: f.complement.trim() ? f.complement : d.address.complement,
      district: f.district.trim() ? f.district : d.address.district,
      city: f.city.trim() ? f.city : d.address.city,
      state: f.state.trim() ? f.state : d.address.state,
      zip: f.zip.trim() ? f.zip : d.address.zip,
    }));
  });

  useEffect(() => {
    if (orderId == null) return;
    let alive = true;
    setLoading(true); setLoadError(""); setError(""); setPreview(null); cnpj.clear();
    fetch(`/api/nfe/${orderId}/preview`, { headers: authHeader() })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.error || "Não foi possível preparar a NF-e.");
        return d as Preview;
      })
      .then((p) => {
        if (!alive) return;
        setPreview(p);
        const r = p.recipient;
        const a = r?.address;
        const ie = (r?.ie_indicator ?? "9") as "1" | "2" | "9";
        setForm({
          document: r?.document ?? "", name: r?.name ?? "", ie_indicator: ie, ie: r?.ie ?? "", email: r?.email ?? "", phone: r?.phone ?? "",
          street: a?.street ?? "", number: a?.number ?? "", complement: a?.complement ?? "", district: a?.district ?? "", city: a?.city ?? "",
          state: a?.state ?? "", zip: a?.zip ?? "", city_code: a?.city_code ?? "",
          freightMode: p.defaults.freight?.mode ?? "9", freightValue: p.defaults.freight?.value ? String(p.defaults.freight.value) : "",
          carrierName: p.defaults.freight?.carrier?.name ?? "", carrierDocument: p.defaults.freight?.carrier?.document ?? "",
          nature: p.defaults.nature, additionalInfo: p.defaults.additional_info ?? "", indPres: p.defaults.ind_pres === "9" ? "9" : "1",
          finalConsumer: p.defaults.final_consumer ?? ie === "9",
        });
      })
      .catch((e) => { if (alive) setLoadError(e instanceof Error ? e.message : "Erro ao carregar."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // código IBGE do município (obrigatório): busca pelo CEP e, se faltar, pela cidade + UF
  const lookupCity = async () => {
    const zip = digits(form.zip);
    if (zip.length !== 8 && !(form.city.trim() && form.state.trim().length === 2)) return;
    setCityLookup(true);
    try {
      const qs = new URLSearchParams({ zip, city: form.city, uf: form.state });
      const r = await fetch(`/api/nfe/ibge?${qs.toString()}`, { headers: authHeader() });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.code) setForm((f) => ({ ...f, city_code: String(d.code), city: f.city.trim() || d.city || f.city, state: f.state.trim() || d.state || f.state }));
      else setError(d?.error || "Não achei o código do município.");
    } finally { setCityLookup(false); }
  };

  const problems = useMemo(() => {
    const p: string[] = [];
    if (![11, 14].includes(digits(form.document).length)) p.push("CPF/CNPJ");
    if (form.name.trim().length < 2) p.push("nome / razão social");
    if (form.ie_indicator === "1" && digits(form.ie).length < 2) p.push("inscrição estadual");
    if (!form.street.trim()) p.push("rua");
    if (!form.district.trim()) p.push("bairro");
    if (!form.city.trim()) p.push("cidade");
    if (form.state.trim().length !== 2) p.push("UF");
    if (digits(form.zip).length !== 8) p.push("CEP");
    if (digits(form.city_code).length !== 7) p.push("código do município (clique em Buscar)");
    return p;
  }, [form]);

  const submit = async () => {
    if (!preview || orderId == null) return;
    setSubmitting(true); setError("");
    try {
      const body = {
        recipient: {
          document: digits(form.document), name: form.name.trim(), ie_indicator: form.ie_indicator, ie: form.ie_indicator === "1" ? digits(form.ie) : null,
          email: form.email.trim() || null, phone: digits(form.phone) || null,
          address: {
            street: form.street.trim(), number: form.number.trim() || "S/N", complement: form.complement.trim() || null, district: form.district.trim(),
            city: form.city.trim(), state: form.state.trim().toUpperCase(), zip: digits(form.zip), city_code: digits(form.city_code),
          },
        },
        freight: {
          mode: form.freightMode, value: form.freightMode === "9" ? 0 : Number(String(form.freightValue).replace(",", ".")) || 0,
          carrier: form.freightMode !== "9" && form.carrierName.trim() ? { name: form.carrierName.trim(), document: digits(form.carrierDocument) || null } : null,
        },
        nature: form.nature.trim() || "Venda de mercadoria",
        additional_info: form.additionalInfo.trim(),
        ind_pres: form.indPres,
        final_consumer: form.finalConsumer,
      };
      const res = await fetch(`/api/nfe/${orderId}/${preview.invoice ? "retry" : "emit"}`, { method: "POST", headers: jsonHeader(), body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error || "Não foi possível emitir a NF-e."); return; }
      toast.success("NF-e enviada à SEFAZ. O resultado aparece aqui em instantes.");
      onDone?.();
      onClose();
    } catch {
      setError("Erro de conexão ao emitir a NF-e.");
    } finally { setSubmitting(false); }
  };

  const isProd = preview?.environment === "producao";

  return (
    <Modal
      open={orderId != null}
      onClose={() => { if (!submitting) onClose(); }}
      size="xl"
      title={preview ? `Emitir NF-e · Pedido #${String(preview.order.id).padStart(6, "0")}` : "Emitir NF-e"}
      subtitle={preview ? `${preview.order.items_count} item(ns) · ${fmtMoney(preview.order.total_amount)} · série ${preview.series}, próximo nº ${preview.invoice?.number ?? preview.next_number}` : undefined}
      footer={
        <>
          <Button variant="outline" size="md" onClick={onClose} disabled={submitting} className="flex-1">Cancelar</Button>
          <Button variant="success" size="md" onClick={submit} loading={submitting} disabled={!preview || problems.length > 0 || submitting} className="flex-1 justify-center">
            {preview?.invoice ? "Reemitir NF-e" : "Emitir NF-e"}
          </Button>
        </>
      }
    >
      {loading && <p className="flex items-center gap-2 py-6 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Preparando a NF-e…</p>}
      {loadError && <Alert variant="error">{loadError}</Alert>}
      {preview && (
        <div className="space-y-4">
          {isProd
            ? <Alert variant="warning" title="Ambiente de PRODUÇÃO">A nota terá valor fiscal e será enviada de verdade à SEFAZ.</Alert>
            : <Alert variant="info">Ambiente de <b>homologação</b> (teste): a nota não tem valor fiscal.</Alert>}
          {preview.invoice?.rejection_reason && <Alert variant="error" title={`Nota nº ${preview.invoice.number} recusada`}>{preview.invoice.rejection_reason}</Alert>}
          {preview.warnings.map((w) => <Alert key={w} variant="warning">{w}</Alert>)}

          <section className="space-y-3 rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">Destinatário</p>
            <div className="grid gap-3 sm:grid-cols-6">
              <div className="sm:col-span-2">
                <Input label="CPF / CNPJ" value={form.document} inputMode="numeric"
                  onChange={(e) => { const v = e.target.value.replace(/[^\d./-]/g, ""); set("document", v); void cnpj.run(v); }} />
              </div>
              <div className="sm:col-span-4"><Input label="Nome / razão social" value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
              <div className="sm:col-span-6"><CnpjStatusNotice loading={cnpj.loading} info={cnpj.info} error={cnpj.error} /></div>
              <div className="sm:col-span-3">
                <Select label="Inscrição estadual do destinatário" value={form.ie_indicator} onChange={(e) => { const v = e.target.value as "1" | "2" | "9"; set("ie_indicator", v); set("finalConsumer", v === "9"); }}>
                  <option value="9">9 · Não contribuinte do ICMS</option>
                  <option value="1">1 · Contribuinte do ICMS (informar a IE)</option>
                  <option value="2">2 · Contribuinte isento de IE</option>
                </Select>
              </div>
              <div className="sm:col-span-3"><Input label="Inscrição estadual (IE)" value={form.ie} disabled={form.ie_indicator !== "1"} inputMode="numeric" onChange={(e) => set("ie", e.target.value)} /></div>
              <div className="sm:col-span-3"><Input label="E-mail (opcional)" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
              <div className="sm:col-span-3"><Input label="Telefone (opcional)" value={form.phone} inputMode="tel" onChange={(e) => set("phone", e.target.value)} /></div>
            </div>
            <div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-6">
              <div className="sm:col-span-2">
                <Input label="CEP" value={form.zip} inputMode="numeric" onChange={(e) => set("zip", e.target.value)} onBlur={() => { if (digits(form.zip).length === 8 && digits(form.city_code).length !== 7) void lookupCity(); }} />
              </div>
              <div className="sm:col-span-4"><Input label="Rua" value={form.street} onChange={(e) => set("street", e.target.value)} /></div>
              <div className="sm:col-span-2"><Input label="Número" value={form.number} onChange={(e) => set("number", e.target.value)} placeholder="S/N" /></div>
              <div className="sm:col-span-2"><Input label="Complemento" value={form.complement} onChange={(e) => set("complement", e.target.value)} /></div>
              <div className="sm:col-span-2"><Input label="Bairro" value={form.district} onChange={(e) => set("district", e.target.value)} /></div>
              <div className="sm:col-span-3"><Input label="Cidade" value={form.city} onChange={(e) => { set("city", e.target.value); set("city_code", ""); }} /></div>
              <div className="sm:col-span-1"><Input label="UF" value={form.state} maxLength={2} onChange={(e) => { set("state", e.target.value.toUpperCase()); set("city_code", ""); }} /></div>
              <div className="flex items-end gap-2 sm:col-span-2">
                <div className="min-w-0 flex-1"><Input label="Cód. IBGE do município" value={form.city_code} inputMode="numeric" onChange={(e) => set("city_code", e.target.value)} placeholder="7 dígitos" /></div>
                <Button variant="outline" size="md" onClick={lookupCity} loading={cityLookup} type="button">Buscar</Button>
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">Operação e frete</p>
            <div className="grid gap-3 sm:grid-cols-6">
              <div className="sm:col-span-3"><Input label="Natureza da operação" value={form.nature} maxLength={60} onChange={(e) => set("nature", e.target.value)} /></div>
              <div className="sm:col-span-3">
                <Select label="Presença do comprador" value={form.indPres} onChange={(e) => set("indPres", e.target.value)}>
                  <option value="1">1 · Operação presencial</option>
                  <option value="9">9 · Não presencial (internet, telefone, entrega)</option>
                </Select>
              </div>
              <div className="sm:col-span-3"><Select label="Frete" value={form.freightMode} onChange={(e) => set("freightMode", e.target.value)} options={FREIGHT_OPTIONS} /></div>
              <div className="sm:col-span-3"><Input label="Valor do frete (R$)" value={form.freightValue} inputMode="decimal" disabled={form.freightMode === "9"} onChange={(e) => set("freightValue", e.target.value)} placeholder="0,00" /></div>
              {form.freightMode !== "9" && (
                <>
                  <div className="sm:col-span-3"><Input label="Transportadora (opcional)" value={form.carrierName} onChange={(e) => set("carrierName", e.target.value)} /></div>
                  <div className="sm:col-span-3"><Input label="CNPJ da transportadora" value={form.carrierDocument} inputMode="numeric" onChange={(e) => set("carrierDocument", e.target.value)} /></div>
                </>
              )}
              <div className="sm:col-span-6">
                <label className="flex items-start gap-2 text-xs text-slate-700">
                  <input type="checkbox" className="mt-0.5" checked={form.finalConsumer} onChange={(e) => set("finalConsumer", e.target.checked)} />
                  <span>Consumidor final (compra para uso próprio, não para revenda). Obrigatório quando o destinatário não é contribuinte do ICMS.</span>
                </label>
              </div>
              <div className="sm:col-span-6">
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Informações adicionais (saem no DANFE)</label>
                <textarea value={form.additionalInfo} onChange={(e) => set("additionalInfo", e.target.value)} rows={2}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
            </div>
          </section>

          {problems.length > 0 && (
            <p className="flex items-start gap-1.5 text-xs text-amber-700"><AlertTriangle size={14} className="mt-px shrink-0" /> Falta preencher: {problems.join(", ")}.</p>
          )}
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
