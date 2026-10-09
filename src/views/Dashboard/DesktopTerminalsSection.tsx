import { useState, useEffect } from "react";
import { Monitor, Trash2, Loader2, LinkIcon } from "lucide-react";
import { useToast } from "../../components/ui/Toast";
import { Button, IconButton, Input } from "../../components/ui";

interface DesktopTerminal {
  id: number;
  name: string;
  last_seen_at: string;
  printers: { id: number; label: string; role: string }[];
}

const ONLINE_WINDOW_MS = 45_000;

function getTerminalPresence(lastSeenAt: string) {
  const elapsed = Date.now() - new Date(lastSeenAt).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return { online: false, label: "Sem atividade registrada" };
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
                <p className="text-[12px] font-semibold text-slate-900 truncate">{t.name}</p>
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
