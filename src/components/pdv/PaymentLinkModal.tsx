import React, { useEffect, useState } from "react";
import { Copy, ExternalLink, Link2, MessageCircle } from "lucide-react";
import { Modal, ModalFooter } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Alert } from "../ui/Alert";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Só o Asaas gera link; sem ele (ex.: apenas Mercado Pago conectado) o modal avisa. */
  asaasReady: boolean;
  initial: { value: number; name: string; document: string; phone: string };
}

const digits = (v: string) => v.replace(/\D/g, "");

export default function PaymentLinkModal({ open, onClose, asaasReady, initial }: Props) {
  const [value, setValue] = useState("");
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(initial.value ? initial.value.toFixed(2) : "");
    setName(initial.name);
    setDocument(initial.document);
    setPhone(initial.phone);
    setDescription("");
    setError("");
    setLink("");
    setCopied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const generate = async () => {
    setError("");
    const amount = Number(value.replace(",", "."));
    if (!(amount > 0)) return setError("Informe um valor maior que zero.");
    if (!name.trim()) return setError("Informe o nome do cliente.");
    if (![11, 14].includes(digits(document).length)) return setError("Informe um CPF ou CNPJ válido.");
    setLoading(true);
    try {
      const res = await fetch("/api/tenant/charges", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({
          value: amount, customerName: name.trim(), customerCpfCnpj: digits(document),
          customerPhone: digits(phone) || undefined, description: description.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.invoice_url) throw new Error(data.error || "Não foi possível gerar o link.");
      setLink(data.invoice_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível gerar o link.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch { /* sem permissão de clipboard */ }
  };

  const whatsappUrl = () => {
    const to = digits(phone);
    const text = encodeURIComponent(`Olá${name ? `, ${name.split(" ")[0]}` : ""}! Segue o link para pagamento: ${link}`);
    return `https://wa.me/${to ? (to.length <= 11 ? `55${to}` : to) : ""}?text=${text}`;
  };

  return (
    <Modal
      isOpen={open} onClose={onClose} size="sm" title="Gerar link de pagamento"
      subtitle="Pix, boleto ou cartão — o cliente escolhe na página"
      footer={link ? (
        <ModalFooter><Button variant="primary" onClick={onClose}>Concluir</Button></ModalFooter>
      ) : (
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={generate} loading={loading} disabled={!asaasReady || loading} iconLeft={<Link2 size={14} />}>Gerar link</Button>
        </ModalFooter>
      )}
    >
      {!asaasReady && <Alert variant="warning" className="mb-3">Links de pagamento usam o Asaas. Conecte sua conta Asaas em Minha Loja para gerar links.</Alert>}
      {link ? (
        <div className="space-y-3">
          <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={copy} iconLeft={<Copy size={14} />}>{copied ? "Copiado!" : "Copiar"}</Button>
            <a href={whatsappUrl()} target="_blank" rel="noreferrer">
              <Button variant="outline" iconLeft={<MessageCircle size={14} />}>WhatsApp</Button>
            </a>
            <a href={link} target="_blank" rel="noreferrer">
              <Button variant="outline" iconLeft={<ExternalLink size={14} />}>Abrir</Button>
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {error && <Alert variant="error">{error}</Alert>}
          <Input label="Valor (R$)" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
          <Input label="Nome do cliente" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="CPF/CNPJ" inputMode="numeric" value={document} onChange={(e) => setDocument(e.target.value)} />
          <Input label="WhatsApp (opcional)" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label="Descrição (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      )}
    </Modal>
  );
}
