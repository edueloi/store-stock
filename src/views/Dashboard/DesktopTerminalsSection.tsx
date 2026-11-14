import { useState, useEffect } from "react";
import { Monitor, Trash2, Loader2, LinkIcon, Pencil, Check, X } from "lucide-react";
import { useToast } from "../../components/ui/Toast";
import { Button, IconButton, Input } from "../../components/ui";

interface DesktopTerminal {
  id: number;
  name: string;
  last_seen_at: string;
  printers: {
    id: number;
    label: string;
    role: string;
    is_default?: boolean;
    config?: { transport?: string; usbPrinterName?: string; serialPort?: string; networkHost?: string; networkPort?: number };
  }[];
}

const ROLE_LABEL: Record<string, string> = { receipt: "Cupom", service_order: "Ordem de serviço", danfe: "DANFE A4", label: "Etiquetas", custom: "Personalizada" };

function describeConnection(c?: DesktopTerminal["printers"][number]["config"]) {
  if (!c) return "Sem configuração";
  if (c.transport === "network") return `Rede ${c.networkHost ?? "?"}:${c.networkPort ?? 9100}`;
  if (c.transport === "serial") return `Porta ${c.serialPort ?? "?"}`;
  return `Windows: ${c.usbPrinterName ?? "?"}`;
}

const ONLINE_WINDOW_MS = 75_000;

function getTerminalPresence(lastSeenAt: string) {
  let elapsed = Date.now() - new Date(lastSeenAt).getTime();
  if (!Number.isFinite(elapsed)) return { online: false, label: "Sem atividade registrada" };
  // Relógio deste computador atrasado em relação ao servidor faz a "última atividade" parecer estar no futuro.
  // Isso não é falta de atividade: tolera até 10 min de diferença e trata como "agora".
  if (elapsed < 0) elapsed = elapsed > -10 * 60_000 ? 0 : NaN;
  if (!Number.isFinite(elapsed)) return { online: false, label: "Relógio deste computador fora de hora" };
  if (elapsed <= ONLINE_WINDOW_MS) return { online: true, label: "Online agora" };
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return { online: false, label: `Visto há ${minutes} min` };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { online: false, label: `Visto há ${hours} h` };
  return { online: false, label: `Visto em ${new Date(lastSeenAt).toLocaleString("pt-BR")}` };
}

// Vincula uma instalação do app desktop (BoxSys PDV) a este tenant via código de
// pareamento de 6 dígitos gerado no próprio Electron (menu PDV → Vincular
// Dispositivo) — o operador digita o código aqui e dá um nome, pra depois saber
// exatamente qual terminal físico está recebendo impressões remotas.
export default function DesktopTerminalsSection() {
  const toast = useToast();
  const [terminals, setTerminals] = useState<DesktopTerminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [pairing, setPairing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const jsonHeaders = () => ({ Authorization: `Bearer ${token()}`, "Content-Type": "application/json" });

  const saveRename = async (id: number) => {
    const n = renameValue.trim();
    if (!n) return;
    const res = await fetch(`/api/desktop-terminals/${id}`, { method: "PUT", headers: jsonHeaders(), body: JSON.stringify({ name: n }) });
    if (res.ok) { toast.success("Nome atualizado."); setRenamingId(null); fetchTerminals(); }
    else toast.error("Não foi possível renomear.");
  };

  const changePrinterRole = async (terminalId: number, printerId: number, role: string) => {
    const res = await fetch(`/api/desktop-terminals/${terminalId}/printers/${printerId}`, {
      method: "PUT", headers: jsonHeaders(), body: JSON.stringify({ role, is_default: true }),
    });
    if (res.ok) { toast.success("Uso da impressora atualizado."); fetchTerminals(); }
    else toast.error("Não foi possível alterar o uso.");
  };

  const removePrinter = async (terminalId: number, printerId: number) => {
    if (!confirm("Remover esta impressora do terminal?")) return;
    const res = await fetch(`/api/desktop-terminals/${terminalId}/printers/${printerId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) { toast.success("Impressora removida."); fetchTerminals(); }
    else toast.error("Não foi possível remover.");
  };

  const token = () => localStorage.getItem("token");

  const fetchTerminals = () => {
    setLoading(true);
    fetch("/api/desktop-terminals", { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((data) => setTerminals(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTerminals();
    // Atualiza o estado visual sem o operador precisar recarregar Configurações.
    const refresh = window.setInterval(fetchTerminals, 30_000);
    return () => window.clearInterval(refresh);
  }, []);

  const handlePair = async () => {
    if (code.trim().length !== 6 || !name.trim()) {
      toast.error("Informe o código de 6 dígitos e um nome para o terminal.");
      return;
    }
    setPairing(true);
    try {
      const res = await fetch("/api/desktop-terminals/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ code: code.trim(), name: name.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Terminal "${data.terminal.name}" vinculado!`);
        setCode("");
        setName("");
        fetchTerminals();
      } else {
        toast.error(data.error || "Não foi possível vincular. Confira o código.");
      }
    } catch {
      toast.error("Erro de conexão. Verifique sua internet.");
    }
    setPairing(false);
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/desktop-terminals/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        toast.success("Terminal desvinculado.");
        fetchTerminals();
      } else {
        toast.error("Erro ao desvincular terminal.");
      }
    } catch {
      toast.error("Erro de conexão. Verifique sua internet.");
    }
    setDeletingId(null);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
      <div>
        <p className="text-[11px] font-semibold text-slate-400 mb-1">Vincular Dispositivos</p>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          No app desktop, abra o menu <span className="font-semibold text-slate-700">PDV → Vincular Dispositivo...</span> pra
          gerar um código de 6 dígitos. Digite esse código aqui e dê um nome pra esse terminal (ex: "Escritório", "Caixa 1")
          — assim você sabe exatamente qual computador vai receber notificações e impressões remotas.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <Input
          type="text"
          inputMode="numeric"
          maxLength={6}
          showCount={false}
          placeholder="Código de 6 dígitos"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          wrapperClassName="w-full sm:w-40"
          className="font-mono text-center"
        />
        <Input
          type="text"
          placeholder="Nome do terminal (ex: Escritório)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          wrapperClassName="flex-1"
        />
        <Button
          onClick={handlePair}
          disabled={pairing}
          loading={pairing}
          iconLeft={<LinkIcon size={14} />}
          className="shrink-0"
        >
          Vincular
        </Button>
      </div>

      <div className="border-t border-slate-100 pt-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-6"><Loader2 size={18} className="animate-spin text-slate-300" /></div>
        ) : terminals.length === 0 ? (
          <p className="text-[11px] text-slate-400 font-semibold text-center py-4">Nenhum terminal vinculado ainda</p>
        ) : (
          terminals.map((t) => {
            const presence = getTerminalPresence(t.last_seen_at);
            return (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-lg">
              <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                <Monitor size={16} className="text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                {renamingId === t.id ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void saveRename(t.id); if (e.key === "Escape") setRenamingId(null); }}
                      placeholder="Ex.: Caixa 2, Escritório"
                      wrapperClassName="max-w-[240px]"
                      aria-label="Nome do terminal"
                    />
                    <IconButton variant="ghost" size="sm" aria-label="Salvar nome" onClick={() => void saveRename(t.id)}><Check size={14} /></IconButton>
                    <IconButton variant="ghost" size="sm" aria-label="Cancelar" onClick={() => setRenamingId(null)}><X size={14} /></IconButton>
                  </div>
                ) : (
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-900">
                    <span className="truncate">{t.name}</span>
                    <button type="button" title="Renomear terminal" aria-label="Renomear terminal"
                      onClick={() => { setRenamingId(t.id); setRenameValue(t.name); }}
                      className="text-slate-400 hover:text-blue-600"><Pencil size={12} /></button>
                  </p>
                )}
                {t.printers.map((p) => (
                  <div key={p.id} className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600">
                    <span className="min-w-0 truncate">🖨 <span className="font-semibold">{p.label}</span>{p.is_default ? " (padrão)" : ""} · {describeConnection(p.config)}</span>
                    <select
                      aria-label={`Uso da impressora ${p.label}`}
                      value={p.role}
                      onChange={(e) => void changePrinterRole(t.id, p.id, e.target.value)}
                      className="h-6 rounded border border-slate-200 bg-white px-1 text-[11px] text-slate-700"
                    >
                      <option value="receipt">Cupom de venda</option>
                      <option value="label">Etiquetas</option>
                      <option value="service_order">Ordem de serviço (A4)</option>
                      <option value="danfe">DANFE / notas (A4)</option>
                      <option value="custom">Personalizada</option>
                    </select>
                    <button type="button" title="Remover impressora" aria-label="Remover impressora"
                      onClick={() => void removePrinter(t.id, p.id)}
                      className="text-slate-300 hover:text-rose-500"><Trash2 size={12} /></button>
                  </div>
                ))}
                <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                  <span className={presence.online ? "w-1.5 h-1.5 rounded-full bg-emerald-500" : "w-1.5 h-1.5 rounded-full bg-slate-300"} />
                  <span className={presence.online ? "text-emerald-600" : undefined}>{presence.label}</span>
                  <span className="text-slate-300">·</span>
                  {t.printers.length} impressora{t.printers.length !== 1 ? "s" : ""}
                </p>
              </div>
              <IconButton
                variant="ghost"
                size="sm"
                aria-label="Desvincular terminal"
                onClick={() => handleDelete(t.id)}
                disabled={deletingId === t.id}
                loading={deletingId === t.id}
                className="shrink-0 hover:bg-rose-50 hover:text-rose-500"
              >
                <Trash2 size={14} />
              </IconButton>
            </div>
            );
          })
        )}
      </div>
    </div>
  );
}
