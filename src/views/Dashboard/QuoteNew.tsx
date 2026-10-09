import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button, ContentCard, EmptyState } from "../../components/ui";

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
      <ContentCard>
        <EmptyState
          icon={AlertTriangle}
          title="Não foi possível continuar"
          description={error}
          action={<Button variant="outline" onClick={() => navigate("/admin/orcamentos")}>Voltar</Button>}
        />
      </ContentCard>
    );
  }

  return (
    <div role="status" className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500">
      <Loader2 size={18} className="animate-spin" />
      Criando...
    </div>
  );
}
