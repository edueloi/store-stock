import { useEffect, useState } from "react";
import { Loader2, Mail, MessageCircle } from "lucide-react";

import { Button, Input, Modal, ModalFooter } from "../ui";
import { useToast } from "../ui/Toast";
import { isValidBrWhatsapp, maskBrWhatsapp, whatsappDigits, WHATSAPP_PLACEHOLDER } from "../../lib/phoneBr";

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" });

// o status do bot é o mesmo para todas as linhas: consulta uma vez a cada 60 s
let waCache: { at: number; value: boolean } | null = null;
let waInflight: Promise<boolean> | null = null;
function whatsappConnected(): Promise<boolean> {
  if (waCache && Date.now() - waCache.at < 60_000) return Promise.resolve(waCache.value);
  if (!waInflight) {
    waInflight = fetch("/api/whatsapp/connection-status", { headers: authHeader() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { const v = Boolean(d?.connected); waCache = { at: Date.now(), value: v }; return v; })
      .catch(() => false)
      .finally(() => { waInflight = null; });
  }
  return waInflight;
}


interface Props {
  /** Ex.: "/api/nfe/123" — recebe POST em /send-email e /send-whatsapp. */
  base: string;
  /** "NF-e", "NFC-e"… usado nos textos. */
  label: string;
  /** false quando a tela já tem o botão de WhatsApp próprio. */
  showWhatsapp?: boolean;
  size?: "xs" | "sm";
}

/** Botões "E-mail" e "WhatsApp" de um documento fiscal já autorizado. Se o cadastro não tem e-mail/telefone, pergunta na hora. */
export default function FiscalSendActions({ base, label, showWhatsapp = true, size = "xs" }: Props) {
  const toast = useToast();
  const [waOn, setWaOn] = useState(false);
  const [sending, setSending] = useState<"email" | "whatsapp" | null>(null);
  const [ask, setAsk] = useState<"email" | "whatsapp" | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!showWhatsapp) return;
    let alive = true;
    void whatsappConnected().then((v) => { if (alive) setWaOn(v); });
    return () => { alive = false; };
  }, [showWhatsapp]);

  const send = async (kind: "email" | "whatsapp", typed?: string) => {
    setSending(kind);
    try {
      const body = typed ? (kind === "email" ? { email: typed } : { number: whatsappDigits(typed) }) : {};
      const r = await fetch(`${base}/${kind === "email" ? "send-email" : "send-whatsapp"}`, { method: "POST", headers: authHeader(), body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 422 && !typed) { setAsk(kind); setValue(""); return; }
        toast.error(d?.error || `Não foi possível enviar a ${label}.`);
        return;
      }
      toast.success(kind === "email" ? `${label} enviada para ${d.recipient}.` : `${label} enviada pelo WhatsApp.`);
      setAsk(null);
    } catch {
      toast.error(`Erro de conexão ao enviar a ${label}.`);
    } finally {
      setSending(null);
    }
  };

  const valid = ask === "email" ? /^\S+@\S+\.\S+$/.test(value.trim()) : isValidBrWhatsapp(value);

  return (
    <>
      <Button variant="outline" size={size} onClick={() => send("email")} disabled={sending !== null} iconLeft={sending === "email" ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />}>E-mail</Button>
      {showWhatsapp && waOn && (
        <Button variant="outline" size={size} onClick={() => send("whatsapp")} disabled={sending !== null} className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" iconLeft={sending === "whatsapp" ? <Loader2 size={11} className="animate-spin" /> : <MessageCircle size={11} />}>WhatsApp</Button>
      )}
      <Modal
        open={!!ask}
        onClose={() => { if (!sending) setAsk(null); }}
        size="sm"
        title={ask === "email" ? `Enviar ${label} por e-mail` : `Enviar ${label} pelo WhatsApp`}
        subtitle={ask === "email" ? "Cliente sem e-mail cadastrado" : "Cliente sem telefone cadastrado"}
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setAsk(null)} disabled={sending !== null}>Voltar</Button>
            <Button onClick={() => ask && send(ask, value.trim())} disabled={!valid || sending !== null} loading={sending !== null}>Enviar</Button>
          </ModalFooter>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500">{ask === "email" ? `O cliente recebe o DANFE${label === "NF-e" ? " e o XML" : ""} anexado, em nome da loja.` : "O cliente recebe o DANFE em PDF pelo WhatsApp da loja."}</p>
          {ask === "email"
            ? <Input type="email" autoFocus autoComplete="off" placeholder="cliente@exemplo.com" value={value} onChange={(e) => setValue(e.target.value)} wrapperClassName="w-full" />
            : <Input type="tel" autoFocus autoComplete="off" placeholder={WHATSAPP_PLACEHOLDER} value={value} onChange={(e) => setValue(maskBrWhatsapp(e.target.value))} wrapperClassName="w-full" />}
        </div>
      </Modal>
    </>
  );
}
