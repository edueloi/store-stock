import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Usb } from "lucide-react";

interface Terminal { id: number; name: string; last_seen_at: string }
interface Cert { subject: string; issuer: string; thumbprint: string; notAfter: string }

const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` });
const cn = (subject: string) => /CN=([^,]+)/.exec(subject)?.[1] ?? subject;
const online = (iso: string) => Date.now() - new Date(iso).getTime() < 75_000;

/**
 * Alternativa ao arquivo A1: usar o certificado A3 (token/cartão) de um computador com o app desktop.
 * O app lista os certificados do Windows; a pessoa escolhe o da empresa e o servidor passa a assinar/transmitir por ele.
 */
export default function A3CertificatePicker({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [terminal, setTerminal] = useState("");
  const [certs, setCerts] = useState<Cert[] | null>(null);
  const [busy, setBusy] = useState<"list" | "save" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/desktop-terminals", { headers: headers() })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setTerminals(Array.isArray(d) ? d : []))
      .catch(() => setTerminals([]));
  }, [open]);

  const list = async () => {
    if (!terminal) { setError("Escolha o computador onde o token está conectado."); return; }
    setBusy("list"); setError(""); setCerts(null);
    try {
      const r = await fetch("/api/tenant/a3/certificates", { method: "POST", headers: headers(), body: JSON.stringify({ terminal_id: Number(terminal) }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Não foi possível listar os certificados.");
      setCerts(d.certs ?? []);
      if (!(d.certs ?? []).length) setError("Nenhum certificado com chave privada foi encontrado nesse computador. Conecte o token e confira se ele aparece no Windows.");
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };

  const choose = async (c: Cert) => {
    setBusy("save"); setError("");
    try {
      const r = await fetch("/api/tenant/a3/select", { method: "POST", headers: headers(), body: JSON.stringify({ terminal_id: Number(terminal), thumbprint: c.thumbprint }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Não foi possível usar este certificado.");
      onDone();
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 hover:underline">
        <Usb size={13} /> Tenho certificado A3 (token ou cartão)
      </button>
    );
  }

  return (
    <div className="space-y-2.5 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700"><Usb size={13} className="text-blue-600" /> Certificado A3 pelo app desktop</p>
        <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-slate-400 hover:text-slate-600">Fechar</button>
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">
        A chave do A3 não sai do token: quem assina e envia a nota é o app Store BoxSys do computador onde ele está conectado. Esse computador precisa estar
        ligado, com o token plugado e o app aberto na hora de emitir. O Windows pode pedir o PIN do token.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[220px] flex-1 text-[11px] font-semibold text-slate-600">
          Computador com o token
          <select value={terminal} onChange={(e) => { setTerminal(e.target.value); setCerts(null); }} className="mt-1 block h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs">
            <option value="">Escolha…</option>
            {terminals.map((t) => <option key={t.id} value={t.id}>{t.name}{online(t.last_seen_at) ? " · online" : " · offline"}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => void list()} disabled={busy !== null || !terminal}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-60">
          {busy === "list" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Buscar certificados
        </button>
      </div>
      {terminals.length === 0 && <p className="text-[11px] text-amber-700">Nenhum computador vinculado. Vincule o app desktop em Configurações → App Desktop.</p>}
      {certs && certs.length > 0 && (
        <ul className="space-y-1.5" aria-label="Certificados encontrados">
          {certs.map((c) => (
            <li key={c.thumbprint} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-800">{cn(c.subject)}</p>
                <p className="truncate text-[11px] text-slate-500">Emitido por {cn(c.issuer)} · vence em {new Date(c.notAfter).toLocaleDateString("pt-BR")}</p>
              </div>
              <button type="button" disabled={busy !== null} onClick={() => void choose(c)} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-blue-300 px-3 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60">
                {busy === "save" ? <Loader2 size={12} className="animate-spin" /> : null} Usar este
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-[11px] font-semibold text-red-600">{error}</p>}
    </div>
  );
}
