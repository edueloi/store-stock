import { useCallback, useEffect, useState } from "react";
import { Building2, CheckCircle2, Loader2, Plus, Trash2, MapPin, ShieldCheck, ArrowRightLeft } from "lucide-react";
import { Alert, Badge, Button } from "../../components/ui";

interface Issuer {
  id: number;
  label: string;
  isActive: boolean;
  document: string;
  razaoSocial: string;
  nfceEnvironment: string;
  hasCertificate: boolean;
  notes: number;
  address: { street?: string; number?: string; complement?: string; district?: string; city?: string; state?: string; zip?: string } | null;
}

const authHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` });

function maskDoc(v: string) {
  const d = String(v ?? "").replace(/\D/g, "");
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return d;
}

const inputCls = "w-full h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

/** Vários CNPJs emissores numa mesma loja (uma mensalidade). Trocar o ativo muda só os dados fiscais: certificado, CSC, séries, numeração e notas. */
export default function IssuersCard() {
  const [issuers, setIssuers] = useState<Issuer[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | "new" | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: "", document: "" });
  const [editAddr, setEditAddr] = useState<number | null>(null);
  const [addr, setAddr] = useState({ street: "", number: "", complement: "", district: "", city: "", state: "", zip: "" });

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/tenant/issuers", { headers: authHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "Não foi possível carregar os CNPJs.");
      setIssuers(d.issuers);
      setCanManage(!!d.canManage);
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const call = async (key: number | "new", fn: () => Promise<Response>, ok: () => void) => {
    setBusy(key); setError("");
    try {
      const r = await fn();
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "Não foi possível concluir.");
      ok();
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };

  const activate = (id: number) => call(id, () => fetch(`/api/tenant/issuers/${id}/activate`, { method: "POST", headers: authHeaders() }), () => window.location.reload());
  const add = () => call("new", () => fetch("/api/tenant/issuers", { method: "POST", headers: authHeaders(), body: JSON.stringify(form) }), () => { setAdding(false); setForm({ label: "", document: "" }); void load(); });
  const remove = (id: number) => call(id, () => fetch(`/api/tenant/issuers/${id}`, { method: "DELETE", headers: authHeaders() }), () => void load());
  const saveAddr = (id: number) => call(id, () => fetch(`/api/tenant/issuers/${id}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify({ address: addr }) }), () => { setEditAddr(null); void load(); });

  if (!issuers) {
    return error
      ? <Alert variant="error" title="CNPJs da loja">{error}</Alert>
      : <div role="status" className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" />Carregando CNPJs…</div>;
  }

  const active = issuers.find((i) => i.isActive);

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-label="CNPJs emissores">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Building2 size={16} className="text-blue-600" />CNPJs da loja</p>
          <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
            Uma loja, uma mensalidade, vários CNPJs. O ativo emite as notas (NFC-e e NFS-e). Ao trocar, mudam só os dados fiscais: certificado, CSC, séries e numeração.
            Clientes, produtos, orçamentos e vendas continuam os mesmos.
          </p>
        </div>
        {canManage && !adding && <Button size="sm" icon={<Plus size={14} />} onClick={() => setAdding(true)}>Adicionar CNPJ</Button>}
      </div>

      {error && <Alert variant="error" title="Não foi possível concluir">{error}</Alert>}

      {adding && (
        <div className="grid gap-2 rounded-lg border border-blue-100 bg-blue-50/50 p-3 sm:grid-cols-[1fr_1fr_auto]">
          <input className={inputCls} placeholder="Nome (ex.: Filial Tatuí)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} aria-label="Nome do CNPJ" />
          <input className={inputCls} placeholder="CNPJ ou CPF" value={form.document} onChange={(e) => setForm({ ...form, document: maskDoc(e.target.value) })} aria-label="CNPJ" inputMode="numeric" />
          <div className="flex gap-2">
            <Button size="sm" loading={busy === "new"} onClick={add}>Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setError(""); }}>Cancelar</Button>
          </div>
          <p className="text-[11px] text-slate-500 sm:col-span-3">Depois de salvar, torne este CNPJ ativo e preencha os dados fiscais dele (inscrições, certificado, CSC) logo abaixo, como já faz hoje.</p>
        </div>
      )}

      <ul className="space-y-2">
        {issuers.map((i) => (
          <li key={i.id} className={`rounded-lg border p-3 ${i.isActive ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-slate-900">
                  {i.label}
                  {i.isActive ? <Badge color="success" icon={<CheckCircle2 size={12} />}>Ativo</Badge> : <Badge color="default">Inativo</Badge>}
                </p>
                <p className="text-[11px] text-slate-500">
                  {maskDoc(i.document) || "CNPJ não informado"}{i.razaoSocial ? ` · ${i.razaoSocial}` : ""} · {i.nfceEnvironment === "producao" ? "Produção" : "Homologação"} ·{" "}
                  {i.hasCertificate ? <span className="inline-flex items-center gap-0.5 text-emerald-700"><ShieldCheck size={11} />certificado</span> : "sem certificado"} · {i.notes} {i.notes === 1 ? "nota" : "notas"}
                </p>
              </div>
              {canManage && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button size="sm" variant="ghost" icon={<MapPin size={13} />} onClick={() => { setEditAddr(editAddr === i.id ? null : i.id); setAddr({ street: i.address?.street ?? "", number: i.address?.number ?? "", complement: i.address?.complement ?? "", district: i.address?.district ?? "", city: i.address?.city ?? "", state: i.address?.state ?? "", zip: i.address?.zip ?? "" }); }}>Endereço nas notas</Button>
                  {!i.isActive && <Button size="sm" variant="outline" icon={<ArrowRightLeft size={13} />} onClick={() => setConfirm(confirm === i.id ? null : i.id)}>Tornar ativo</Button>}
                  {!i.isActive && i.notes === 0 && <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} loading={busy === i.id} onClick={() => remove(i.id)}>Remover</Button>}
                </div>
              )}
            </div>

            {confirm === i.id && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <p>Trocar o CNPJ ativo de <b>{active?.label ?? "atual"}</b> para <b>{i.label}</b>? As próximas notas saem por {i.label}, com o certificado, o CSC, a série e a numeração dele. A tela vai recarregar.</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" loading={busy === i.id} onClick={() => activate(i.id)}>Confirmar troca</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>Cancelar</Button>
                </div>
              </div>
            )}

            {editAddr === i.id && (
              <div className="mt-2 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-6">
                <input className={`${inputCls} sm:col-span-3`} placeholder="Rua" value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} aria-label="Rua" />
                <input className={inputCls} placeholder="Número" value={addr.number} onChange={(e) => setAddr({ ...addr, number: e.target.value })} aria-label="Número" />
                <input className={`${inputCls} sm:col-span-2`} placeholder="Complemento" value={addr.complement} onChange={(e) => setAddr({ ...addr, complement: e.target.value })} aria-label="Complemento" />
                <input className={`${inputCls} sm:col-span-2`} placeholder="Bairro" value={addr.district} onChange={(e) => setAddr({ ...addr, district: e.target.value })} aria-label="Bairro" />
                <input className={`${inputCls} sm:col-span-2`} placeholder="Cidade" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} aria-label="Cidade" />
                <input className={inputCls} placeholder="UF" maxLength={2} value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value.toUpperCase() })} aria-label="UF" />
                <input className={inputCls} placeholder="CEP" value={addr.zip} onChange={(e) => setAddr({ ...addr, zip: e.target.value })} aria-label="CEP" />
                <div className="flex items-center gap-2 sm:col-span-6">
                  <Button size="sm" loading={busy === i.id} onClick={() => saveAddr(i.id)}>Salvar endereço</Button>
                  <span className="text-[11px] text-slate-500">Usado só dentro das notas deste CNPJ. O endereço da loja online não muda.</span>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
