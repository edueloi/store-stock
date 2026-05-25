import { Heart, Star, Gift, Users, TrendingUp, Award } from "lucide-react";

export default function Loyalty() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Fidelidade</h1>
        <p className="mt-1 text-sm text-slate-500">Programa de pontos e recompensas para seus clientes.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { icon: Users,     label: "Clientes Ativos",  value: "—", color: "bg-blue-50 text-blue-600" },
          { icon: Star,      label: "Pontos Emitidos",  value: "—", color: "bg-amber-50 text-amber-600" },
          { icon: Gift,      label: "Resgates",         value: "—", color: "bg-purple-50 text-purple-600" },
          { icon: TrendingUp,label: "Taxa de Retorno",  value: "—", color: "bg-emerald-50 text-emerald-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${s.color}`}>
              <s.icon size={18} />
            </div>
            <p className="text-2xl font-black text-slate-900">{s.value}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Em breve */}
      <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#C9A227]/10">
          <Award size={28} className="text-[#C9A227]" />
        </div>
        <h2 className="text-xl font-black text-slate-900">Em breve</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
          O módulo de fidelidade está em desenvolvimento. Em breve você poderá criar programas de pontos, recompensas e cupons para seus clientes.
        </p>
        <div className="mt-6 flex items-center gap-2 rounded-full border border-[#C9A227]/30 bg-[#C9A227]/10 px-5 py-2">
          <Heart size={14} className="text-[#C9A227]" />
          <span className="text-sm font-bold text-[#C9A227]">Módulo em desenvolvimento</span>
        </div>
      </div>
    </div>
  );
}
