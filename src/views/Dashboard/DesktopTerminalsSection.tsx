import { useState, useEffect } from "react";
import { Monitor, Trash2, Loader2, LinkIcon } from "lucide-react";
import { useToast } from "../../components/ui/Toast";

interface DesktopTerminal {
  id: number;
  name: string;
  last_seen_at: string;
  printers: { id: number; label: string; role: string }[];
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

  useEffect(fetchTerminals, []);

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
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vincular Dispositivos</p>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          No app desktop, abra o menu <span className="font-bold text-slate-700">PDV → Vincular Dispositivo...</span> pra
          gerar um código de 6 dígitos. Digite esse código aqui e dê um nome pra esse terminal (ex: "Escritório", "Caixa 1")
          — assim você sabe exatamente qual computador vai receber notificações e impressões remotas.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="Código de 6 dígitos"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="w-full sm:w-40 h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-black text-center tracking-widest outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 transition-all"
        />
        <input
          type="text"
          placeholder="Nome do terminal (ex: Escritório)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 transition-all"
        />
        <button
          onClick={handlePair}
          disabled={pairing}
          className="h-11 px-5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shrink-0"
        >
          {pairing ? <Loader2 size={14} className="animate-spin" /> : <LinkIcon size={14} />} Vincular
        </button>
      </div>

      <div className="border-t border-slate-100 pt-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-6"><Loader2 size={18} className="animate-spin text-slate-300" /></div>
        ) : terminals.length === 0 ? (
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center py-4">Nenhum terminal vinculado ainda</p>
        ) : (
          terminals.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl">
              <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                <Monitor size={16} className="text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-slate-900 truncate">{t.name}</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                  {t.printers.length} impressora{t.printers.length !== 1 ? "s" : ""} · Visto por último: {new Date(t.last_seen_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <button
                onClick={() => handleDelete(t.id)}
                disabled={deletingId === t.id}
                className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all disabled:opacity-50"
              >
                {deletingId === t.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
