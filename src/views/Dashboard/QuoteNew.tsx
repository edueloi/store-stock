import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";

const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

export default function QuoteNew() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        const res = await fetch("/api/quotes", {
          method: "POST",
          headers: authHeader(),
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setError(err.error || "Falha ao criar orçamento");
          return;
        }
        const created = await res.json();
        navigate(`/admin/orcamentos/${created.id}`, { replace: true });
      } catch {
        setError("Falha ao criar orçamento");
      }
    })();
  }, [navigate]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <AlertTriangle className="text-red-500" size={28} />
        <p className="text-[12px] font-bold text-slate-600">{error}</p>
        <button
          onClick={() => navigate("/admin/orcamentos")}
          className="h-9 px-4 bg-slate-900 text-white rounded-lg text-[11px] font-black uppercase tracking-wider hover:bg-slate-800 transition-all"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="animate-spin text-blue-500" size={28} />
    </div>
  );
}
