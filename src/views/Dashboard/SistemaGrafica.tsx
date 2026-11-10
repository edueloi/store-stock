import { useEffect, useState } from "react";
import { Loader2, Printer, CheckCircle2, ExternalLink, Users, Package, Calculator, MessageCircle, Globe, Gift, Sparkles } from "lucide-react";
import { Badge, Button, ContentCard, PageWrapper, SectionTitle } from "../../components/ui";
import { getStoredUser } from "../../lib/session";

const SUPPORT_WA = "5515992418299";

const BENEFITS = [
  { icon: Calculator, t: "Orçamentos e ordens de serviço", d: "Orçamento na hora, pedidos e acompanhamento da produção." },
  { icon: Gift, t: "Catálogo de brindes (XBZ)", d: "Milhares de brindes prontos, com fotos e cores. Você define o preço de venda." },
  { icon: Globe, t: "Site com a sua marca", d: "Vitrine online no seu endereço, com catálogo e pedido de orçamento." },
  { icon: MessageCircle, t: "WhatsApp com atendente virtual", d: "Responde clientes e monta orçamentos sem perder tempo." },
];

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function SistemaGrafica() {
  const user = getStoredUser();
  // o login guarda uma cópia antiga dos dados da loja: a liberação do módulo vem sempre do servidor (sem precisar sair e entrar de novo)
  const [enabled, setEnabled] = useState<boolean | null>(user?.grafica_system_enabled ? true : null);
  const [monthly, setMonthly] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/tenant", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then((r) => r.json())
      .then((d) => setEnabled(!!d?.grafica_system_enabled))
      .catch(() => setEnabled(!!user?.grafica_system_enabled));
  }, [user?.grafica_system_enabled]);

  useEffect(() => {
    fetch("/api/tenant/billing", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then((r) => r.json())
      .then((d) => { if (d && typeof d.value !== "undefined") setMonthly(Number(d.value)); })
      .catch(() => {});
  }, []);

  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState("");
  // abre o Sistema Gráfica já logado (a aba é aberta antes da chamada para o navegador não bloquear)
  const openGrafica = async () => {
    setOpening(true); setOpenError("");
    const tab = window.open("", "_blank");
    try {
      const r = await fetch("/api/tenant/grafica-sso", { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.url) throw new Error(d?.error || "Não foi possível abrir o Sistema Gráfica.");
      if (tab) tab.location.href = d.url; else window.location.href = d.url;
    } catch (e) { tab?.close(); setOpenError((e as Error).message); } finally { setOpening(false); }
  };

  const ADDON = 100;
  const wa = `https://wa.me/${SUPPORT_WA}?text=${encodeURIComponent("Olá! Quero contratar o Sistema Gráfica (+R$ 100/mês) para a minha loja no Store BoxSys.")}`;

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle icon={Printer} title="Sistema Gráfica" description="Orçamentos, ordens de serviço, catálogo de brindes e site para gráficas e brindes" />

        {enabled === null ? (
          <div role="status" className="flex items-center gap-2 py-10 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />Carregando…</div>
        ) : enabled ? (
          <ContentCard className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <Badge color="success" icon={<CheckCircle2 size={12} />}>Ativo na sua loja</Badge>
                <p className="text-sm text-slate-600">Você entra direto, já logado, com o mesmo usuário do Store BoxSys.</p>
                {openError && <p role="alert" className="text-xs text-red-600">{openError}</p>}
              </div>
              <Button icon={<ExternalLink size={14} />} loading={opening} onClick={openGrafica}>Abrir Sistema Gráfica</Button>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              <li className="flex items-start gap-3 rounded-xl border border-slate-200 p-3"><Users size={18} className="mt-0.5 text-blue-600" /><div><p className="text-sm font-medium text-slate-800">Clientes sincronizados</p><p className="text-xs text-slate-500">Cadastre ou altere de um lado e aparece no outro em até 1 minuto.</p></div></li>
              <li className="flex items-start gap-3 rounded-xl border border-slate-200 p-3"><Package size={18} className="mt-0.5 text-blue-600" /><div><p className="text-sm font-medium text-slate-800">Produtos sincronizados</p><p className="text-xs text-slate-500">Os produtos do Sistema Gráfica vão para a sua loja, com o custo separado do preço de venda.</p></div></li>
            </ul>
          </ContentCard>
        ) : (
          <ContentCard className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-xl space-y-1.5">
                <Badge color="default" icon={<Sparkles size={12} />}>Módulo adicional</Badge>
                <h2 className="text-lg font-semibold text-slate-900">Tem gráfica ou vende brindes? Leve o sistema completo.</h2>
                <p className="text-sm text-slate-600">O Sistema Gráfica conversa com a sua loja: clientes e produtos ficam iguais nos dois, sem digitar duas vezes.</p>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-center">
                <p className="text-xs font-medium text-blue-700">Adicional na mensalidade</p>
                <p className="text-3xl font-bold text-blue-900">+ {brl(ADDON)}</p>
                {monthly !== null && monthly > 0 && <p className="mt-1 text-xs text-slate-600">Sua mensalidade vai de {brl(monthly)} para <b>{brl(monthly + ADDON)}</b></p>}
              </div>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {BENEFITS.map(({ icon: Icon, t, d }) => (
                <li key={t} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3"><Icon size={18} className="mt-0.5 text-blue-600" /><div><p className="text-sm font-medium text-slate-800">{t}</p><p className="text-xs text-slate-500">{d}</p></div></li>
              ))}
            </ul>
            <a href={wa} target="_blank" rel="noreferrer"><Button icon={<MessageCircle size={14} />}>Quero contratar</Button></a>
          </ContentCard>
        )}
      </div>
    </PageWrapper>
  );
}
