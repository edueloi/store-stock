import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { Button, Input, Modal } from "../ui";
import Combobox from "../ui/Combobox";
import { useToast } from "../ui/Toast";
import { maskBrWhatsapp, WHATSAPP_PLACEHOLDER } from "../../lib/phoneBr";

interface CustomerOption { id: number; name: string; phone: string | null }

export interface SendReportWhatsappModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Rótulo do período/escopo que vai no PDF (ex.: "Novembro 2026"). */
  scopeLabel: string;
  /** Mensagem pré-preenchida (resumo + período). O usuário pode editar. */
  defaultMessage: string;
  /** Gera o PDF só na hora do envio, já no período escolhido na tela. */
  buildPdf: () => Promise<{ base64: string; fileName: string }>;
}

const token = () => localStorage.getItem("token");

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Não foi possível enviar pelo WhatsApp.");
}

export default function SendReportWhatsappModal({ open, onClose, title = "Enviar por WhatsApp", scopeLabel, defaultMessage, buildPdf }: SendReportWhatsappModalProps) {
  const toast = useToast();
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(defaultMessage);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMessage(defaultMessage);
    setError(null);
    fetch("/api/customers", { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setCustomers(data.map((c: CustomerOption) => ({ id: c.id, name: c.name, phone: c.phone ?? null })));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const options = useMemo(
    () => customers.filter((c) => c.phone).map((c) => ({ value: String(c.id), label: c.name, description: maskPhone(c.phone!) })),
    [customers],
  );

  const pickCustomer = (id: string) => {
    setCustomerId(id);
    const c = customers.find((x) => String(x.id) === id);
    if (c?.phone) setPhone(maskPhone(c.phone));
  };

  const digits = phone.replace(/\D/g, "");
  const validPhone = digits.length === 10 || digits.length === 11 || (digits.startsWith("55") && digits.length >= 12);

  const send = async () => {
    if (!validPhone || sending) return;
    setSending(true);
    setError(null);
    try {
      const number = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
      const { base64, fileName } = await buildPdf();
      await postJson("/api/whatsapp/send-document", { number, base64, fileName, caption: message.trim() || undefined });
      toast.success?.("Relatório enviado pelo WhatsApp.");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar pelo WhatsApp.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { if (!sending) onClose(); }} title={title} subtitle={scopeLabel} size="sm">
      <div className="space-y-4">
        <Combobox
          label="Cliente (opcional)"
          options={options}
          value={customerId}
          onChange={pickCustomer}
          placeholder="Selecionar cliente com telefone"
          searchPlaceholder="Buscar cliente..."
          clearable
        />
        <Input
          label="Número do WhatsApp"
          placeholder={WHATSAPP_PLACEHOLDER}
          inputMode="tel"
          value={phone}
          onChange={(e) => { setPhone(maskBrWhatsapp(e.target.value)); setCustomerId(""); }}
          error={phone && !validPhone ? "Informe DDD + número" : undefined}
        />
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-500">Mensagem</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-700 outline-none focus:border-slate-400"
          />
        </label>
        <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <MessageCircle size={12} className="text-emerald-600" /> O PDF do relatório vai anexado com essa mensagem.
        </p>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>Cancelar</Button>
          <Button variant="success" size="sm" className="!border-emerald-600 !bg-emerald-600 !text-white hover:!bg-emerald-700 disabled:!opacity-50" onClick={send} disabled={!validPhone || sending}
            iconLeft={sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}>
            {sending ? "Enviando..." : "Enviar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
