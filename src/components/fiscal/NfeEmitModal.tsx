import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, AlertTriangle, CheckCircle2, ArrowLeft, ArrowRight, Check } from "lucide-react";

import { Alert, Button, Input, Select } from "../ui";
import Combobox from "../ui/Combobox";
import Modal from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { useCnpjLookup, type CnpjInfo } from "../../lib/cnpjLookup";
import CnpjStatusNotice from "../CnpjStatusNotice";

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
const jsonHeader = () => ({ ...authHeader(), "Content-Type": "application/json" });
const digits = (v: string) => v.replace(/\D/g, "");

// Máscaras: o operador digita só números e o campo formata sozinho
const maskDoc = (v: string) => {
  const d = digits(v).slice(0, 14);
  if (d.length <= 11) return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
};
const maskZip = (v: string) => { const d = digits(v).slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };
const maskPhone = (v: string) => {
  const d = digits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
// guarda a lista de clientes por 60 s: abrir o modal de novo não baixa tudo outra vez
let customersCache: { at: number; list: unknown[] } | null = null;

interface RecipientDto {
  document: string; name: string; ie_indicator: "1" | "2" | "9"; ie?: string | null; email?: string | null; phone?: string | null;
  address: { street: string; number: string; complement?: string | null; district: string; city: string; state: string; zip: string; city_code: string };
}

interface Preview {
  order: { id: number; total_amount: number; customer_name: string | null; items_count: number; order_label?: string | null };
  recipient: RecipientDto | null;
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

interface CustomerRow { id: number; name: string; legal_name?: string | null; document?: string | null; address_city?: string | null; address_state?: string | null }

/**
 * Emitir NF-e (modelo 55) de um pedido. A NF-e exige destinatário identificado; aqui dá para escolher um cliente já cadastrado
 * (preenche tudo, inclusive o código do município) ou digitar o CNPJ (a Receita completa o resto). Frete, e-mail, telefone e
 * informações adicionais são opcionais e ficam em "Mais opções".
 */
export default function NfeEmitModal({ orderId, onClose, onDone }: { orderId: number | null; onClose: () => void; onDone?: () => void }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [cityState, setCityState] = useState<"idle" | "loading" | "ok" | "fail">("idle");
  const [showMore, setShowMore] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const jumpAfterPick = useRef(false);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [pickedCustomer, setPickedCustomer] = useState("");
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const cityKey = useRef("");

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const fillFromRecipient = (r: RecipientDto) => {
    const a = r.address;
    setForm((f) => ({
      ...f,
      document: maskDoc(r.document ?? ""), name: r.name ?? "", ie_indicator: r.ie_indicator ?? "9", ie: r.ie ?? "", email: r.email ?? "", phone: maskPhone(r.phone ?? ""),
      street: a?.street ?? "", number: a?.number ?? "", complement: a?.complement ?? "", district: a?.district ?? "", city: a?.city ?? "",
      state: a?.state ?? "", zip: maskZip(a?.zip ?? ""), city_code: a?.city_code ?? "", finalConsumer: (r.ie_indicator ?? "9") === "9",
    }));
    cityKey.current = a?.city_code ? `${digits(a.zip ?? "")}|${a.city}|${a.state}` : "";
    setCityState(a?.city_code ? "ok" : "idle");
  };

  // Consulta o CNPJ na Receita ao completar os 14 dígitos: completa só o que estiver vazio
  const cnpj = useCnpjLookup((d: CnpjInfo) => {
    setForm((f) => ({
      ...f,
      name: f.name.trim() ? f.name : (d.legal_name || d.trade_name),
      email: f.email.trim() ? f.email : d.email,
      phone: f.phone.trim() ? f.phone : maskPhone(d.phone),
      street: f.street.trim() ? f.street : d.address.street,
      number: f.number.trim() ? f.number : d.address.number,
      complement: f.complement.trim() ? f.complement : d.address.complement,
      district: f.district.trim() ? f.district : d.address.district,
      city: f.city.trim() ? f.city : d.address.city,
      state: f.state.trim() ? f.state : d.address.state,
      zip: f.zip.trim() ? f.zip : maskZip(d.address.zip),
    }));
  });

  useEffect(() => {
    if (orderId == null) return;
    let alive = true;
    setLoading(true); setLoadError(""); setError(""); setPreview(null); setPickedCustomer(""); setShowMore(false); setStep(1); jumpAfterPick.current = false; setCityState("idle"); cnpj.clear();
    fetch(`/api/nfe/${orderId}/preview`, { headers: authHeader() })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.error || "Não foi possível preparar a NF-e.");
        return d as Preview;
      })
      .then((p) => {
        if (!alive) return;
        setPreview(p);
        if (p.recipient) fillFromRecipient(p.recipient); else setForm(EMPTY);
        setForm((f) => ({
          ...f,
          freightMode: p.defaults.freight?.mode ?? "9", freightValue: p.defaults.freight?.value ? String(p.defaults.freight.value) : "",
          carrierName: p.defaults.freight?.carrier?.name ?? "", carrierDocument: p.defaults.freight?.carrier?.document ?? "",
          nature: p.defaults.nature, additionalInfo: p.defaults.additional_info ?? "", indPres: p.defaults.ind_pres === "9" ? "9" : "1",
          finalConsumer: p.defaults.final_consumer ?? (p.recipient?.ie_indicator ?? "9") === "9",
        }));
        if ((p.defaults.freight?.mode ?? "9") !== "9" || p.defaults.additional_info) setShowMore(true);
      })
      .catch((e) => { if (alive) setLoadError(e instanceof Error ? e.message : "Erro ao carregar."); })
      .finally(() => { if (alive) setLoading(false); });
    // lista de clientes cadastrados (para escolher o destinatário)
    if (customersCache && Date.now() - customersCache.at < 60_000) setCustomers(customersCache.list as CustomerRow[]);
    else fetch("/api/customers", { headers: authHeader() })
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => { if (Array.isArray(list)) { customersCache = { at: Date.now(), list }; if (alive) setCustomers(list as CustomerRow[]); } })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const pickCustomer = async (id: string) => {
    setPickedCustomer(id);
    if (!id) return;
    setLoadingCustomer(true); setError("");
    try {
      const r = await fetch(`/api/nfe/recipient/${id}`, { headers: authHeader() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d?.recipient) { setError(d?.error || "Não foi possível carregar o cliente."); return; }
      fillFromRecipient(d.recipient as RecipientDto);
      cnpj.clear();
      jumpAfterPick.current = true; // cliente completo: vai direto para a confirmação
    } finally { setLoadingCustomer(false); }
  };

  // Código IBGE do município (obrigatório): buscado sozinho pelo CEP ou por cidade + UF, sem o operador precisar digitar
  useEffect(() => {
    const zip = digits(form.zip);
    const city = form.city.trim();
    const uf = form.state.trim().toUpperCase();
    const ready = zip.length === 8 || (city.length >= 3 && uf.length === 2);
    // com o CEP completo busca também rua e bairro quando faltam; senão só o código do município
    const needsAddress = zip.length === 8 && (!form.street.trim() || !form.district.trim());
    if (!ready || (digits(form.city_code).length === 7 && !needsAddress)) return;
    const key = `${zip}|${city}|${uf}`;
    if (cityKey.current === key) return;
    const t = setTimeout(async () => {
      cityKey.current = key;
      setCityState("loading");
      try {
        const qs = new URLSearchParams({ zip, city, uf });
        const r = await fetch(`/api/nfe/ibge?${qs.toString()}`, { headers: authHeader() });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d?.code) {
          setForm((f) => ({
            ...f, city_code: String(d.code),
            street: f.street.trim() || d.street || f.street, district: f.district.trim() || d.district || f.district,
            city: f.city.trim() || d.city || f.city, state: f.state.trim() || d.state || f.state,
          }));
          setCityState("ok");
        } else setCityState("fail");
      } catch { setCityState("fail"); }
    }, 500);
    return () => clearTimeout(t);
  }, [form.zip, form.city, form.state, form.city_code, form.street, form.district]);

  const step1Problems = useMemo(() => {
    const p: string[] = [];
    if (![11, 14].includes(digits(form.document).length)) p.push("CPF/CNPJ");
    if (form.name.trim().length < 2) p.push("nome / razão social");
    if (form.ie_indicator === "1" && digits(form.ie).length < 2) p.push("inscrição estadual");
    return p;
  }, [form.document, form.name, form.ie_indicator, form.ie]);
  const step2Problems = useMemo(() => {
    const p: string[] = [];
    if (digits(form.zip).length !== 8) p.push("CEP");
    if (!form.street.trim()) p.push("rua");
    if (!form.district.trim()) p.push("bairro");
    if (!form.city.trim()) p.push("cidade");
    if (form.state.trim().length !== 2) p.push("UF");
    if (digits(form.city_code).length !== 7) p.push("código do município");
    return p;
  }, [form.zip, form.street, form.district, form.city, form.state, form.city_code]);
  const problems = useMemo(() => [...step1Problems, ...step2Problems], [step1Problems, step2Problems]);

  // cliente cadastrado com tudo preenchido: pula para a confirmação (se faltar algo, fica na etapa certa)
  useEffect(() => {
    if (!jumpAfterPick.current) return;
    if (step1Problems.length === 0 && step2Problems.length === 0) { jumpAfterPick.current = false; setStep(3); }
    else if (step1Problems.length === 0 && cityState !== "loading") { jumpAfterPick.current = false; setStep(2); }
  }, [step1Problems, step2Problems, cityState]);

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
      toast.success("NF-e enviada à SEFAZ. O resultado aparece na lista em instantes.");
      onDone?.();
      onClose();
    } catch {
      setError("Erro de conexão ao emitir a NF-e.");
    } finally { setSubmitting(false); }
  };

  const isProd = preview?.environment === "producao";
  const docLen = digits(form.document).length;
  const docKind: "cpf" | "cnpj" | "none" = docLen === 11 ? "cpf" : docLen === 14 ? "cnpj" : "none";
  // pessoa física nunca tem inscrição estadual de contribuinte: já fica "não contribuinte" e consumidor final
  useEffect(() => {
    if (docKind === "cpf") setForm((f) => (f.ie_indicator === "9" && f.finalConsumer ? f : { ...f, ie_indicator: "9", ie: "", finalConsumer: true }));
  }, [docKind]);
  const customerOptions = useMemo(
    () => customers.map((c) => ({ value: String(c.id), label: c.legal_name || c.name, description: [c.document, [c.address_city, c.address_state].filter(Boolean).join("/")].filter(Boolean).join(" · ") })),
    [customers],
  );

  const STEPS: { n: 1 | 2 | 3; label: string }[] = [{ n: 1, label: "Destinatário" }, { n: 2, label: "Endereço" }, { n: 3, label: "Confirmar" }];
  const currentProblems = step === 1 ? step1Problems : step === 2 ? step2Problems : [];
  const canGo = (n: number) => n <= step || (n === 2 && step1Problems.length === 0) || (n === 3 && problems.length === 0);
  const next = () => { if (currentProblems.length === 0) setStep((step + 1) as 1 | 2 | 3); };
  const addressLine = [form.street, form.number || "S/N", form.complement, form.district, form.city && form.state ? `${form.city}/${form.state.toUpperCase()}` : "", form.zip ? `CEP ${form.zip}` : ""].filter(Boolean).join(" · ");

  return (
    <Modal
      open={orderId != null}
      onClose={() => { if (!submitting) onClose(); }}
      size="lg"
      title={preview ? `Emitir NF-e · Pedido #${String(preview.order.id).padStart(6, "0")}` : "Emitir NF-e"}
      subtitle={preview ? `${preview.order.items_count} item(ns) · ${fmtMoney(preview.order.total_amount)} · série ${preview.series}, próximo nº ${preview.invoice?.number ?? preview.next_number}` : undefined}
      footer={
        <>
          {step === 1
            ? <Button variant="outline" size="md" onClick={onClose} disabled={submitting} className="flex-1">Cancelar</Button>
            : <Button variant="outline" size="md" onClick={() => setStep((step - 1) as 1 | 2 | 3)} disabled={submitting} className="flex-1 justify-center" iconLeft={<ArrowLeft size={14} />}>Voltar</Button>}
          {step < 3
            ? <Button variant="primary" size="md" onClick={next} disabled={!preview || currentProblems.length > 0} className="flex-1 justify-center" iconRight={<ArrowRight size={14} />}>Continuar</Button>
            : <Button variant="success" size="md" onClick={submit} loading={submitting} disabled={!preview || problems.length > 0 || submitting} className="flex-1 justify-center">
                {preview?.invoice ? "Reemitir NF-e" : "Emitir NF-e"}
              </Button>}
        </>
      }
    >
      {loading && <p className="flex items-center gap-2 py-6 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Preparando a NF-e…</p>}
      {loadError && <Alert variant="error">{loadError}</Alert>}
      {preview && (
        <div className="space-y-4">
          {/* etapas */}
          <ol className="flex items-center gap-2">
            {STEPS.map((st, i) => {
              const done = st.n < step || (st.n !== step && canGo(st.n) && step === 3);
              const active = st.n === step;
              return (
                <li key={st.n} className="flex flex-1 items-center gap-2">
                  <button type="button" disabled={!canGo(st.n)} onClick={() => setStep(st.n)}
                    className={`flex items-center gap-2 rounded-full px-1 py-0.5 text-xs font-semibold transition ${active ? "text-slate-900" : done ? "text-emerald-600" : "text-slate-400"} disabled:cursor-default`}>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${active ? "bg-slate-900 text-white" : done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {done && !active ? <Check size={12} /> : st.n}
                    </span>
                    {st.label}
                  </button>
                  {i < STEPS.length - 1 && <span className={`h-px flex-1 ${st.n < step ? "bg-emerald-300" : "bg-slate-200"}`} />}
                </li>
              );
            })}
          </ol>

          {isProd
            ? <Alert variant="warning" title="Ambiente de PRODUÇÃO">A nota terá valor fiscal e será enviada de verdade à SEFAZ.</Alert>
            : <Alert variant="info">Ambiente de <b>homologação</b> (teste): a nota não tem valor fiscal.</Alert>}
          {preview.invoice?.rejection_reason && <Alert variant="error" title={`Nota nº ${preview.invoice.number} recusada`}>{preview.invoice.rejection_reason}</Alert>}
          {preview.warnings.map((w) => <Alert key={w} variant="warning">{w}</Alert>)}

          {step === 1 && (
            <section className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Para quem é a nota?</p>
                <p className="mt-0.5 text-[11px] text-slate-500">A NF-e sempre precisa de destinatário. Escolha um cliente cadastrado (pula direto para a confirmação) ou digite o CNPJ/CPF.</p>
              </div>
              <div className="relative">
                <Combobox label="Cliente cadastrado" options={customerOptions} value={pickedCustomer} onChange={(v) => void pickCustomer(v)} placeholder="Buscar cliente por nome ou CNPJ…" searchPlaceholder="Digite o nome ou o documento" clearable />
                {loadingCustomer && <Loader2 size={14} className="absolute right-9 top-9 animate-spin text-slate-400" />}
              </div>
              <div className="grid gap-3 sm:grid-cols-6">
                <div className="sm:col-span-2">
                  <Input label="CPF / CNPJ *" value={form.document} inputMode="numeric" autoComplete="off" placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    onChange={(e) => { const v = maskDoc(e.target.value); set("document", v); void cnpj.run(v); }} />
                </div>
                <div className="sm:col-span-4"><Input label={docKind === "cpf" ? "Nome completo *" : "Nome / razão social *"} value={form.name} autoComplete="off" onChange={(e) => set("name", e.target.value)} /></div>
                <div className="sm:col-span-6"><CnpjStatusNotice loading={cnpj.loading} info={cnpj.info} error={cnpj.error} /></div>
                {docKind === "none" && <p className="sm:col-span-6 text-[11px] text-slate-400">Com CNPJ, o nome e o endereço vêm sozinhos da Receita.</p>}
                {docKind === "cpf" && <p className="sm:col-span-6 text-[11px] text-slate-500">Pessoa física: não precisa de inscrição estadual. A Receita não permite consultar CPF, então digite o nome ou escolha o cliente cadastrado.</p>}
                {docKind === "cnpj" && <div className={form.ie_indicator === "1" ? "sm:col-span-3" : "sm:col-span-6"}>
                  <Select label="O comprador é contribuinte do ICMS?" value={form.ie_indicator} onChange={(e) => { const v = e.target.value as "1" | "2" | "9"; set("ie_indicator", v); set("finalConsumer", v === "9"); }}>
                    <option value="9">Não (pessoa física ou empresa sem inscrição estadual)</option>
                    <option value="1">Sim, tem inscrição estadual (informar a IE)</option>
                    <option value="2">Contribuinte isento de IE</option>
                  </Select>
                </div>}
                {docKind === "cnpj" && form.ie_indicator === "1" && <div className="sm:col-span-3"><Input label="Inscrição estadual (IE) *" value={form.ie} inputMode="numeric" autoComplete="off" onChange={(e) => set("ie", digits(e.target.value))} /></div>}
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Endereço do destinatário</p>
                <p className="mt-0.5 text-[11px] text-slate-500">Digite o CEP: rua, bairro, cidade e o código do município vêm sozinhos.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-6">
                <div className="sm:col-span-2"><Input label="CEP *" value={form.zip} inputMode="numeric" autoComplete="off" placeholder="00000-000" autoFocus onChange={(e) => { set("zip", maskZip(e.target.value)); set("city_code", ""); }} /></div>
                <div className="sm:col-span-4"><Input label="Rua *" value={form.street} autoComplete="off" onChange={(e) => set("street", e.target.value)} /></div>
                <div className="sm:col-span-2"><Input label="Número" value={form.number} autoComplete="off" onChange={(e) => set("number", e.target.value)} placeholder="S/N" /></div>
                <div className="sm:col-span-4"><Input label="Bairro *" value={form.district} autoComplete="off" onChange={(e) => set("district", e.target.value)} /></div>
                <div className="sm:col-span-4"><Input label="Cidade *" value={form.city} autoComplete="off" onChange={(e) => { set("city", e.target.value); set("city_code", ""); }} /></div>
                <div className="sm:col-span-2"><Input label="UF *" value={form.state} maxLength={2} autoComplete="off" onChange={(e) => { set("state", e.target.value.toUpperCase()); set("city_code", ""); }} /></div>
                <div className="sm:col-span-6"><Input label="Complemento" value={form.complement} autoComplete="off" onChange={(e) => set("complement", e.target.value)} /></div>
                <div className="sm:col-span-6 text-[11px]">
                  {cityState === "loading" && <span className="flex items-center gap-1.5 text-slate-500"><Loader2 size={12} className="animate-spin" /> Buscando o código do município…</span>}
                  {cityState === "ok" && digits(form.city_code).length === 7 && <span className="flex items-center gap-1.5 text-emerald-600"><CheckCircle2 size={12} /> Município confirmado (código {form.city_code}).</span>}
                  {(cityState === "fail" || (digits(form.city_code).length !== 7 && cityState === "idle" && form.city.trim() && form.state.trim())) && (
                    <span className="flex flex-wrap items-center gap-2 text-amber-700">
                      Não achei o código do município sozinho. Digite os 7 dígitos (IBGE):
                      <input value={form.city_code} inputMode="numeric" maxLength={7} onChange={(e) => set("city_code", digits(e.target.value))} placeholder="3554003" className="h-8 w-28 rounded-lg border border-slate-300 px-2 font-mono text-xs" />
                    </span>
                  )}
                </div>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Destinatário</p>
                    <p className="truncate text-sm font-semibold text-slate-900">{form.name}</p>
                    <p className="font-mono text-slate-500">{form.document}{form.ie_indicator === "1" && form.ie ? ` · IE ${form.ie}` : ""}</p>
                    <p className="mt-1 text-slate-600">{addressLine}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total</p>
                    <p className="text-base font-bold text-slate-900">{fmtMoney(preview.order.total_amount)}</p>
                    <button type="button" onClick={() => setStep(1)} className="mt-1 text-[11px] font-medium text-blue-600 hover:underline">Editar dados</button>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-6">
                <div className="sm:col-span-3"><Input label="E-mail (opcional)" value={form.email} autoComplete="off" onChange={(e) => set("email", e.target.value)} /></div>
                <div className="sm:col-span-3"><Input label="Telefone (opcional)" value={form.phone} inputMode="tel" autoComplete="off" placeholder="(00) 00000-0000" onChange={(e) => set("phone", maskPhone(e.target.value))} /></div>
                <div className="sm:col-span-3"><Select label="Frete" value={form.freightMode} onChange={(e) => set("freightMode", e.target.value)} options={FREIGHT_OPTIONS} /></div>
                <div className="sm:col-span-3"><Input label="Valor do frete (R$)" value={form.freightValue} inputMode="decimal" disabled={form.freightMode === "9"} onChange={(e) => set("freightValue", e.target.value)} placeholder="0,00" /></div>
                {form.freightMode !== "9" && (
                  <>
                    <div className="sm:col-span-3"><Input label="Transportadora" value={form.carrierName} onChange={(e) => set("carrierName", e.target.value)} /></div>
                    <div className="sm:col-span-3"><Input label="CNPJ da transportadora" value={form.carrierDocument} inputMode="numeric" autoComplete="off" onChange={(e) => set("carrierDocument", maskDoc(e.target.value))} /></div>
                  </>
                )}
                <div className="sm:col-span-6">
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">Informações adicionais (saem no DANFE)</label>
                  <textarea value={form.additionalInfo} onChange={(e) => set("additionalInfo", e.target.value)} rows={2}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200">
                <button type="button" onClick={() => setShowMore((v) => !v)} className="flex w-full items-center justify-between px-4 py-2.5 text-left">
                  <span className="text-xs font-semibold text-slate-700">Avançado <span className="font-normal text-slate-400">(natureza da operação, presença, consumidor final)</span></span>
                  {showMore ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </button>
                {showMore && (
                  <div className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-6">
                    <div className="sm:col-span-3"><Input label="Natureza da operação" value={form.nature} maxLength={60} onChange={(e) => set("nature", e.target.value)} /></div>
                    <div className="sm:col-span-3">
                      <Select label="Presença do comprador" value={form.indPres} onChange={(e) => set("indPres", e.target.value)}>
                        <option value="1">Presencial</option>
                        <option value="9">Não presencial (internet, telefone, entrega)</option>
                      </Select>
                    </div>
                    <div className="sm:col-span-6">
                      <label className="flex items-start gap-2 text-xs text-slate-700">
                        <input type="checkbox" className="mt-0.5" checked={form.finalConsumer} onChange={(e) => set("finalConsumer", e.target.checked)} />
                        <span>Consumidor final (compra para uso próprio, não para revenda). Obrigatório quando o comprador não é contribuinte do ICMS.</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-500">Sem mexer nas opções, a nota sai como <b>{form.nature || "Venda de mercadoria"}</b>, sem frete.</p>
            </section>
          )}

          {currentProblems.length > 0 && (
            <p className="flex items-start gap-1.5 text-xs text-amber-700"><AlertTriangle size={14} className="mt-px shrink-0" /> Falta preencher: {currentProblems.join(", ")}.</p>
          )}
          {step === 3 && problems.length > 0 && (
            <p className="flex items-start gap-1.5 text-xs text-amber-700"><AlertTriangle size={14} className="mt-px shrink-0" /> Falta preencher: {problems.join(", ")}. Volte e complete.</p>
          )}
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
