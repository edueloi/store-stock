import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2, RefreshCw, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { Button, Input } from "../ui";
import Modal from "../ui/Modal";
import { useToast } from "../ui/Toast";
import FiscalCodeLookup from "./FiscalCodeLookup";
import { onRealtimeAny } from "../../lib/realtime";
import type { NfceInvoice } from "../../types";

const token = () => localStorage.getItem("token");
const authHeader = () => ({ Authorization: `Bearer ${token()}` });
const jsonHeader = () => ({ ...authHeader(), "Content-Type": "application/json" });

interface FiscalProduct { id: number; name: string; sku: string | null; ncm: string | null; cest: string | null; cfop: string | null; csosn: string | null; origem: number | null; unidade_comercial: string | null }
interface FiscalDraft { ncm: string; cest: string; cfop: string; csosn: string; origem: string }

const ORIGENS = [
  ["0", "0 · Nacional"],
  ["1", "1 · Estrangeira (importação direta)"],
  ["2", "2 · Estrangeira (comprada no mercado interno)"],
  ["3", "3 · Nacional, importação 40% a 70%"],
  ["5", "5 · Nacional, importação até 40%"],
  ["8", "8 · Nacional, importação acima de 70%"],
];
const digits = (v: string) => v.replace(/\D/g, "");

/**
 * NFC-e (nota de PRODUTO) do pedido gerado ao faturar um orçamento ou uma O.S.
 * Mostra a situação da nota e deixa emitir, tentar de novo e baixar o DANFE.
 * Antes de emitir confere os dados fiscais dos produtos: se faltar algum, abre uma janela para completar e grava no produto.
 * `autoEmit` dispara a emissão sozinha (uma vez) — usado quando o operador marcou "emitir NFC-e" ao confirmar a venda.
 */
export default function NfceOrderPanel({ orderId, autoEmit = false, className = "" }: { orderId: number; autoEmit?: boolean; className?: string }) {
  const toast = useToast();
  const [invoice, setInvoice] = useState<NfceInvoice | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState<FiscalProduct[] | null>(null);
  const [drafts, setDrafts] = useState<Record<number, FiscalDraft>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const autoDone = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/nfce/${orderId}`, { headers: authHeader() });
      setInvoice(res.ok ? await res.json() : null);
    } catch { /* mantém o que já tinha */ }
    setLoaded(true);
  }, [orderId]);

  useEffect(() => { setLoaded(false); void load(); }, [load]);
  useEffect(() => onRealtimeAny(["nfce:changed"], (p) => { if (!p?.orderId || Number(p.orderId) === orderId) void load(); }), [load, orderId]);

  // enquanto emite, confere de novo a cada poucos segundos (caso o aviso em tempo real não chegue)
  useEffect(() => {
    if (invoice?.status !== "pending" && invoice?.status !== "processing") return;
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [invoice?.status, load]);

  const send = useCallback(async (retry: boolean) => {
    try {
      const res = await fetch(`/api/nfce/${orderId}/${retry ? "retry" : "emit"}`, { method: "POST", headers: authHeader() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data?.error || "Não foi possível emitir a NFC-e."); return; }
      toast.success("Emissão da NFC-e iniciada.");
      void load();
    } catch { toast.error("Erro de conexão ao emitir a NFC-e."); }
  }, [orderId, load, toast]);

  /** Confere os dados fiscais dos produtos; só emite se estiver tudo certo (senão abre a janela de preenchimento). */
  const start = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/nfce/${orderId}/fiscal-check`, { headers: authHeader() });
      const data = res.ok ? await res.json() : { products: [] };
      const list: FiscalProduct[] = data.products ?? [];
      if (list.length) {
        const d: Record<number, FiscalDraft> = {};
        for (const p of list) d[p.id] = { ncm: digits(p.ncm ?? "").slice(0, 8), cest: digits(p.cest ?? "").slice(0, 7), cfop: p.cfop || "5102", csosn: p.csosn || "102", origem: String(p.origem ?? 0) };
        setDrafts(d); setSaveError(""); setMissing(list);
        return;
      }
      await send(!!invoice);
    } finally { setBusy(false); }
  }, [orderId, send, invoice]);

  useEffect(() => {
    if (!autoEmit || autoDone.current || !loaded) return;
    autoDone.current = true;
    if (!invoice) void start();
  }, [autoEmit, loaded, invoice, start]);

  const setField = (id: number, patch: Partial<FiscalDraft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  const allValid = !!missing && missing.every((p) => digits(drafts[p.id]?.ncm ?? "").length === 8 && /^\d{4}$/.test(drafts[p.id]?.cfop ?? "") && (drafts[p.id]?.csosn ?? "").trim() !== "");

  const saveAndEmit = async () => {
    if (!missing) return;
    setSaving(true); setSaveError("");
    try {
      for (const p of missing) {
        const d = drafts[p.id];
        const res = await fetch(`/api/products/${p.id}`, {
          method: "PUT", headers: jsonHeader(),
          body: JSON.stringify({ ncm: digits(d.ncm), cest: digits(d.cest) || null, cfop: d.cfop, csosn: d.csosn.trim(), origem: Number(d.origem) || 0 }),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`${p.name}: ${e?.error || "não foi possível salvar."}`); }
      }
      setMissing(null);
      await send(!!invoice);
    } catch (e) { setSaveError(e instanceof Error ? e.message : "Não foi possível salvar os dados fiscais."); }
    finally { setSaving(false); }
  };

  const downloadDanfe = async () => {
    try {
      const res = await fetch(`/api/nfce/${orderId}/danfe`, { headers: authHeader() });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Não foi possível baixar o DANFE.");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url; a.download = `nfce-${invoice?.access_key ?? orderId}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível baixar o DANFE."); }
  };

  if (!loaded) return null;
  const st = invoice?.status as string | undefined;
  const working = st === "pending" || st === "processing";
  const failed = st === "rejected" || st === "error";

  return (
    <div className={`space-y-1.5 rounded-lg border border-slate-200 bg-white p-3 ${className}`}>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-800"><FileText size={14} className="text-blue-600" />NFC-e (produtos)</p>
      {st === "authorized" ? (
        <>
          <p className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><CheckCircle2 size={13} />Autorizada — série {invoice!.series}/nº {invoice!.number}</p>
          <Button variant="outline" size="sm" fullWidth onClick={downloadDanfe} iconLeft={<Download size={13} />}>Baixar DANFE</Button>
        </>
      ) : working ? (
        <p className="flex items-center gap-1.5 text-[11px] text-slate-600"><Loader2 size={13} className="animate-spin" />Emitindo na SEFAZ…</p>
      ) : (
        <>
          {failed && <p className="flex items-start gap-1 text-[11px] font-semibold text-red-600"><AlertCircle size={13} className="mt-px shrink-0" />{invoice?.rejection_reason || "A SEFAZ não autorizou a nota."}</p>}
          {!failed && <p className="text-[11px] text-slate-500">Emite a nota fiscal dos produtos deste pedido. Serviços saem pela NFS-e.</p>}
          <Button variant={failed ? "outline" : "primary"} size="sm" fullWidth loading={busy} onClick={() => void start()} iconLeft={failed ? <RefreshCw size={13} /> : <FileText size={13} />}>
            {failed ? "Tentar de novo" : "Emitir NFC-e"}
          </Button>
        </>
      )}

      <Modal
        open={!!missing}
        onClose={() => { if (!saving) setMissing(null); }}
        size="lg"
        title="Dados fiscais dos produtos"
        subtitle="Estes produtos ainda não têm os dados fiscais para a NFC-e. Preencha e gravamos no cadastro de cada um."
        footer={
          <>
            <Button variant="outline" size="md" onClick={() => setMissing(null)} disabled={saving} className="flex-1">Cancelar</Button>
            <Button variant="success" size="md" onClick={saveAndEmit} loading={saving} disabled={!allValid} className="flex-1 justify-center">Salvar e emitir NFC-e</Button>
          </>
        }
      >
        <div className="space-y-4">
          {missing?.map((p) => {
            const d = drafts[p.id];
            if (!d) return null;
            return (
              <div key={p.id} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
                <p className="border-b border-slate-100 pb-3 text-sm font-semibold text-slate-900">{p.name}{p.sku ? <span className="ml-1.5 font-mono text-[10px] font-normal text-slate-400">{p.sku}</span> : null}</p>
                <div className="grid gap-x-4 gap-y-4 sm:grid-cols-6">
                  <div className="flex items-end gap-2 sm:col-span-3">
                    <div className="min-w-0 flex-1"><Input label="NCM (8 dígitos)" value={d.ncm} onChange={(e) => setField(p.id, { ncm: digits(e.target.value).slice(0, 8) })} inputMode="numeric" placeholder="00000000" /></div>
                    <FiscalCodeLookup kind="ncm" token={token()} onSelect={(item) => setField(p.id, { ncm: digits(item.code).slice(0, 8) })} />
                  </div>
                  <div className="sm:col-span-3"><Input label="CEST (opcional)" value={d.cest} onChange={(e) => setField(p.id, { cest: digits(e.target.value).slice(0, 7) })} inputMode="numeric" /></div>
                  <div className="sm:col-span-2"><Input label="CFOP" value={d.cfop} onChange={(e) => setField(p.id, { cfop: digits(e.target.value).slice(0, 4) })} inputMode="numeric" /></div>
                  <div className="sm:col-span-2"><Input label="CSOSN / CST" value={d.csosn} onChange={(e) => setField(p.id, { csosn: e.target.value.slice(0, 3) })} /></div>
                  <label className="block sm:col-span-2">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">Origem</span>
                    <select value={d.origem} onChange={(e) => setField(p.id, { origem: e.target.value })} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                      {ORIGENS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            );
          })}
          <p className="px-1 text-xs text-slate-500">CFOP 5102 e CSOSN 102 são o padrão para revenda no Simples Nacional. Na dúvida, confirme com o contador.</p>
          {saveError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{saveError}</p>}
        </div>
      </Modal>
    </div>
  );
}
