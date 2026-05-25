import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  Search,
  Download,
  FileText,
  Table,
  X,
  ChevronDown,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  SlidersHorizontal,
  FileSpreadsheet,
} from "lucide-react";
import { FinanceEntry, Tenant } from "../../types";
import { cn } from "../../lib/utils";
import Modal from "../../components/ui/Modal";

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const today = () => new Date().toISOString().split("T")[0];

const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

function formatDateBR(dateStr: string) {
  if (!dateStr) return "";
  // ISO string or "YYYY-MM-DD"
  const d = new Date(dateStr + (dateStr.length === 10 ? "T12:00:00" : ""));
  return d.toLocaleDateString("pt-BR");
}

// ─── Excel export (pure JS, no lib needed) ───────────────────────────────────
function exportToCSV(entries: FinanceEntry[], tenant: Partial<Tenant> | null, period: string) {
  const BOM = "﻿"; // UTF-8 BOM for Excel
  const sep = ";";
  const header = [
    `Relatório Financeiro - ${tenant?.name || "Nexus ERP"}`,
    `Período: ${period}`,
    tenant?.address ? `Endereço: ${tenant.address}` : "",
    (tenant as any)?.cnpj ? `CNPJ: ${(tenant as any).cnpj}` : "",
    "",
    ["Descrição", "Data", "Categoria", "Tipo", "Valor (R$)"].join(sep),
  ]
    .filter((l) => l !== null)
    .join("\n");

  const rows = entries.map((e) =>
    [
      `"${e.description}"`,
      formatDateBR(e.date),
      e.category || "Operacional",
      e.type === "income" ? "Receita" : "Despesa",
      (e.type === "income" ? "" : "-") + Number(e.amount).toFixed(2).replace(".", ","),
    ].join(sep)
  );

  const totalIncome = entries
    .filter((e) => e.type === "income")
    .reduce((a, e) => a + Number(e.amount), 0);
  const totalExpense = entries
    .filter((e) => e.type === "expense")
    .reduce((a, e) => a + Number(e.amount), 0);

  const footer = [
    "",
    `"TOTAL ENTRADAS";;;"";${totalIncome.toFixed(2).replace(".", ",")}`,
    `"TOTAL SAÍDAS";;;"";-${totalExpense.toFixed(2).replace(".", ",")}`,
    `"SALDO";;;"";"${(totalIncome - totalExpense).toFixed(2).replace(".", ",")}"`,
  ].join("\n");

  const csv = BOM + header + "\n" + rows.join("\n") + "\n" + footer;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `financeiro_${period.replace(/\s/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── PDF export (print-based, no lib needed) ─────────────────────────────────
function exportToPDF(entries: FinanceEntry[], tenant: Partial<Tenant> | null, period: string) {
  const totalIncome = entries
    .filter((e) => e.type === "income")
    .reduce((a, e) => a + Number(e.amount), 0);
  const totalExpense = entries
    .filter((e) => e.type === "expense")
    .reduce((a, e) => a + Number(e.amount), 0);
  const balance = totalIncome - totalExpense;

  const rows = entries
    .map(
      (e) => `
      <tr>
        <td>${e.description}</td>
        <td>${formatDateBR(e.date)}</td>
        <td>${e.category || "Operacional"}</td>
        <td class="${e.type === "income" ? "income" : "expense"}">
          ${e.type === "income" ? "+" : "−"} R$ ${Number(e.amount).toFixed(2)}
        </td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Relatório Financeiro</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 32px; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 3px solid #1e40af; padding-bottom: 16px; }
  .brand h1 { font-size: 20px; font-weight: 900; color: #1e293b; text-transform: uppercase; letter-spacing: 0.1em; }
  .brand p { font-size: 10px; color: #64748b; margin-top: 2px; }
  .brand .logo { width: 48px; height: 48px; background: #2563eb; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 22px; font-weight: 900; margin-bottom: 8px; }
  .meta { text-align: right; font-size: 10px; color: #64748b; line-height: 1.8; }
  .meta strong { color: #1e293b; font-size: 11px; }
  .period { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 6px 14px; display: inline-block; font-size: 10px; font-weight: 700; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 20px; }
  .summary { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px; }
  .card { padding: 14px 16px; border-radius: 10px; border: 1px solid #e2e8f0; }
  .card label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; display: block; margin-bottom: 4px; color: #94a3b8; }
  .card .val { font-size: 18px; font-weight: 900; font-family: monospace; }
  .card.income .val { color: #059669; }
  .card.expense .val { color: #dc2626; }
  .card.balance { background: #1e293b; border-color: #1e293b; }
  .card.balance label { color: #64748b; }
  .card.balance .val { color: #fff; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 10px 12px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #94a3b8; }
  td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
  tr:hover td { background: #f8fafc; }
  td.income { color: #059669; font-weight: 700; font-family: monospace; text-align: right; }
  td.expense { color: #dc2626; font-weight: 700; font-family: monospace; text-align: right; }
  th:last-child { text-align: right; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
<div class="header">
  <div class="brand">
    ${tenant?.logo_url ? `<img src="${tenant.logo_url}" style="height:48px;margin-bottom:8px;border-radius:8px;" />` : `<div class="logo">N</div>`}
    <h1>${tenant?.name || "Nexus ERP"}</h1>
    <p>${tenant?.address || ""}</p>
    ${(tenant as any)?.cnpj ? `<p>CNPJ: ${(tenant as any).cnpj}</p>` : ""}
    ${tenant?.whatsapp ? `<p>WhatsApp: ${tenant.whatsapp}</p>` : ""}
  </div>
  <div class="meta">
    <strong>Relatório Financeiro</strong><br/>
    Gerado em: ${new Date().toLocaleString("pt-BR")}<br/>
    Sistema: Nexus ERP
  </div>
</div>
<div class="period">Período: ${period}</div>
<div class="summary">
  <div class="card income">
    <label>Total Entradas</label>
    <div class="val">R$ ${fmt(totalIncome)}</div>
  </div>
  <div class="card expense">
    <label>Total Saídas</label>
    <div class="val">R$ ${fmt(totalExpense)}</div>
  </div>
  <div class="card balance">
    <label>Saldo Consolidado</label>
    <div class="val" style="color:${balance >= 0 ? "#34d399" : "#f87171"}">R$ ${fmt(balance)}</div>
  </div>
</div>
<table>
  <thead>
    <tr>
      <th>Descrição</th>
      <th>Data</th>
      <th>Categoria</th>
      <th style="text-align:right">Valor</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">
  <span>${tenant?.name || "Nexus ERP"} · Relatório gerado pelo sistema Nexus</span>
  <span>Total de lançamentos: ${entries.length}</span>
</div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

// ─── PRESET PERIODS ──────────────────────────────────────────────────────────
type Preset = "today" | "week" | "month" | "quarter" | "year" | "custom";

function getPresetRange(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const t = iso(now);

  if (preset === "today") return { from: t, to: t };
  if (preset === "week") {
    const day = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    return { from: iso(mon), to: t };
  }
  if (preset === "month") {
    return { from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, to: t };
  }
  if (preset === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    const qStart = new Date(now.getFullYear(), q * 3, 1);
    return { from: iso(qStart), to: t };
  }
  if (preset === "year") {
    return { from: `${now.getFullYear()}-01-01`, to: t };
  }
  return { from: monthStart(), to: t };
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function Finance() {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"income" | "expense">("income");
  const [newEntry, setNewEntry] = useState<Partial<FinanceEntry>>({
    type: "income",
    date: today(),
  });
  const [saving, setSaving] = useState(false);
  const [tenant, setTenant] = useState<Partial<Tenant> | null>(null);

  // Filters
  const [preset, setPreset] = useState<Preset>("month");
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo, setDateTo] = useState(today());
  const [searchQ, setSearchQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const token = () => localStorage.getItem("token");

  // Close export dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExport(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchFinance = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/finance", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchFinance();
    fetch("/api/tenant", { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then((d) => setTenant(d))
      .catch(() => {});
  }, []);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      const range = getPresetRange(p);
      setDateFrom(range.from);
      setDateTo(range.to);
    }
  };

  const openModal = (type: "income" | "expense") => {
    setModalType(type);
    setNewEntry({ type, date: today() });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(newEntry),
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchFinance();
      }
    } catch {}
    setSaving(false);
  };

  // Filtered entries
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const entryDate = e.date.substring(0, 10);
      if (entryDate < dateFrom || entryDate > dateTo) return false;
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (searchQ && !e.description.toLowerCase().includes(searchQ.toLowerCase())) return false;
      return true;
    });
  }, [entries, dateFrom, dateTo, typeFilter, searchQ]);

  const totalIncome = filtered.filter((e) => e.type === "income").reduce((a, e) => a + Number(e.amount), 0);
  const totalExpense = filtered.filter((e) => e.type === "expense").reduce((a, e) => a + Number(e.amount), 0);
  const balance = totalIncome - totalExpense;

  const periodLabel = (() => {
    if (preset === "today") return "Hoje";
    if (preset === "week") return "Esta Semana";
    if (preset === "month") return `${new Date(dateFrom + "T12:00:00").toLocaleString("pt-BR", { month: "long", year: "numeric" })}`;
    if (preset === "quarter") return "Este Trimestre";
    if (preset === "year") return `Ano ${new Date().getFullYear()}`;
    return `${formatDateBR(dateFrom)} a ${formatDateBR(dateTo)}`;
  })();

  const PRESETS: { key: Preset; label: string }[] = [
    { key: "today", label: "Hoje" },
    { key: "week", label: "Semana" },
    { key: "month", label: "Mês" },
    { key: "quarter", label: "Trimestre" },
    { key: "year", label: "Ano" },
    { key: "custom", label: "Personalizado" },
  ];

  return (
    <div className="space-y-5">
      {/* ── PAGE HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
            Fluxo Financeiro
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            Controle de Tesouraria & Lançamentos
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => openModal("income")}
            className="flex-1 sm:flex-none h-10 px-4 bg-emerald-600 text-white rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-500 transition-all active:scale-95"
          >
            <Plus size={13} strokeWidth={3} /> Receita
          </button>
          <button
            onClick={() => openModal("expense")}
            className="flex-1 sm:flex-none h-10 px-4 bg-rose-600 text-white rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-200 hover:bg-rose-500 transition-all active:scale-95"
          >
            <Minus size={13} strokeWidth={3} /> Despesa
          </button>
        </div>
      </div>

      {/* ── SUMMARY CARDS ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
            Total Entradas
          </div>
          <div className="text-2xl font-mono font-black text-emerald-600">
            R$ {fmt(totalIncome)}
          </div>
          <div className="mt-2 text-[9px] font-bold text-slate-400 uppercase">
            {filtered.filter((e) => e.type === "income").length} lançamentos
          </div>
          <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-400">
            <ArrowUpRight size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
            Total Saídas
          </div>
          <div className="text-2xl font-mono font-black text-rose-600">
            R$ {fmt(totalExpense)}
          </div>
          <div className="mt-2 text-[9px] font-bold text-slate-400 uppercase">
            {filtered.filter((e) => e.type === "expense").length} lançamentos
          </div>
          <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-400">
            <ArrowDownRight size={20} />
          </div>
        </div>

        <div
          className={cn(
            "p-5 rounded-2xl shadow-xl relative overflow-hidden",
            balance >= 0 ? "bg-slate-900" : "bg-rose-900"
          )}
        >
          <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">
            Saldo Consolidado
          </div>
          <div
            className={cn(
              "text-2xl font-mono font-black",
              balance >= 0 ? "text-white" : "text-rose-300"
            )}
          >
            R$ {fmt(balance)}
          </div>
          <div className="mt-2 text-[9px] font-bold text-slate-600 uppercase">
            Período: {periodLabel}
          </div>
          <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-600">
            <Wallet size={20} />
          </div>
        </div>
      </div>

      {/* ── TRANSACTION TABLE ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-slate-100 flex flex-col gap-3">
          {/* Row 1: title + actions */}
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
              <FileText size={13} className="text-blue-600" />
              Histórico de Movimentações
              <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-mono text-[9px]">
                {filtered.length}
              </span>
            </h3>
            <div className="flex items-center gap-2">
              {/* Filter toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "h-8 px-3 rounded-lg flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest border transition-all",
                  showFilters
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                )}
              >
                <SlidersHorizontal size={12} />
                <span className="hidden sm:block">Filtros</span>
              </button>

              {/* Export dropdown */}
              <div className="relative" ref={exportRef}>
                <button
                  onClick={() => setShowExport(!showExport)}
                  className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest border border-slate-200 bg-white text-slate-500 hover:border-slate-400 transition-all"
                >
                  <Download size={12} />
                  <span className="hidden sm:block">Exportar</span>
                  <ChevronDown size={10} />
                </button>
                {showExport && (
                  <div className="absolute right-0 top-10 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                    <button
                      onClick={() => {
                        exportToCSV(filtered, tenant, periodLabel);
                        setShowExport(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <FileSpreadsheet size={14} className="text-emerald-600" />
                      Excel / CSV
                    </button>
                    <div className="h-px bg-slate-100 mx-3" />
                    <button
                      onClick={() => {
                        exportToPDF(filtered, tenant, periodLabel);
                        setShowExport(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <FileText size={14} className="text-rose-600" />
                      PDF / Imprimir
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: preset pills */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className={cn(
                  "shrink-0 h-7 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border",
                  preset === p.key
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Row 3: expanded filters */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <input
                  type="text"
                  placeholder="Pesquisar descrição..."
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  className="w-full pl-8 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-widest placeholder:text-slate-300 focus:outline-none focus:border-blue-400 transition-all"
                />
              </div>
              {/* Type filter */}
              <div className="flex gap-1.5">
                {(["all", "income", "expense"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={cn(
                      "flex-1 h-9 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all",
                      typeFilter === t
                        ? t === "income"
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : t === "expense"
                          ? "bg-rose-600 text-white border-rose-600"
                          : "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
                    )}
                  >
                    {t === "all" ? "Todos" : t === "income" ? "Receitas" : "Despesas"}
                  </button>
                ))}
              </div>
              {/* Date from */}
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPreset("custom"); }}
                  className="w-full pl-8 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold focus:outline-none focus:border-blue-400 transition-all"
                />
              </div>
              {/* Date to */}
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPreset("custom"); }}
                  className="w-full pl-8 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold focus:outline-none focus:border-blue-400 transition-all"
                />
              </div>
            </div>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={22} className="animate-spin text-slate-300" />
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest w-1/2">
                    Descrição
                  </th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Data
                  </th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Categoria
                  </th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, idx) => (
                  <tr
                    key={entry.id}
                    className={cn(
                      "border-b border-slate-50 hover:bg-slate-50/50 transition-colors",
                      idx % 2 === 0 ? "" : "bg-slate-50/20"
                    )}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white",
                            entry.type === "income" ? "bg-emerald-500" : "bg-rose-500"
                          )}
                        >
                          {entry.type === "income" ? (
                            <TrendingUp size={12} />
                          ) : (
                            <TrendingDown size={12} />
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-slate-800 uppercase truncate max-w-[220px]">
                          {entry.description}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {formatDateBR(entry.date)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                        {entry.category || "Operacional"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span
                        className={cn(
                          "font-mono font-black text-sm",
                          entry.type === "income" ? "text-emerald-600" : "text-rose-600"
                        )}
                      >
                        {entry.type === "income" ? "+" : "−"} R$ {Number(entry.amount).toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-14 text-center text-[10px] font-black uppercase tracking-widest text-slate-300"
                    >
                      Nenhum lançamento no período selecionado
                    </td>
                  </tr>
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-900 text-white">
                    <td className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400" colSpan={2}>
                      Totais do período
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-[10px] font-black text-emerald-400 font-mono">
                        + R$ {fmt(totalIncome)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span
                        className={cn(
                          "text-sm font-mono font-black",
                          balance >= 0 ? "text-white" : "text-rose-400"
                        )}
                      >
                        R$ {fmt(balance)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* Mobile list */}
        <div className="sm:hidden divide-y divide-slate-50">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-slate-300" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-[10px] font-black uppercase tracking-widest text-slate-300">
              Nenhum lançamento no período
            </div>
          ) : (
            filtered.map((entry) => (
              <div key={entry.id} className="px-4 py-3.5 flex items-center gap-3">
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white",
                    entry.type === "income" ? "bg-emerald-500" : "bg-rose-500"
                  )}
                >
                  {entry.type === "income" ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-slate-900 uppercase truncate">
                    {entry.description}
                  </p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                    {formatDateBR(entry.date)} · {entry.category || "Operacional"}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-sm font-mono font-black shrink-0",
                    entry.type === "income" ? "text-emerald-600" : "text-rose-600"
                  )}
                >
                  {entry.type === "income" ? "+" : "−"}R$ {Number(entry.amount).toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── ADD ENTRY MODAL ─────────────────────────────────────────────── */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Novo Lançamento — ${modalType === "income" ? "Receita" : "Despesa"}`}
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 h-10 border border-slate-200 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              form="finance-form"
              type="submit"
              disabled={saving}
              className={cn(
                "flex-1 h-10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2",
                modalType === "income"
                  ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200"
                  : "bg-rose-600 hover:bg-rose-500 shadow-rose-200"
              )}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : "Efetivar"}
            </button>
          </>
        }
      >
        <form id="finance-form" onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] px-1 block">
              Descrição
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Venda balcão, aluguel, etc."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all"
              value={newEntry.description || ""}
              onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] px-1 block">
              Valor (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0,00"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all"
              value={newEntry.amount || ""}
              onChange={(e) => setNewEntry({ ...newEntry, amount: Number(e.target.value) })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] px-1 block">
                Data
              </label>
              <input
                type="date"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all"
                value={newEntry.date || ""}
                onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] px-1 block">
                Categoria
              </label>
              <input
                type="text"
                placeholder="Operacional"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all"
                value={newEntry.category || ""}
                onChange={(e) => setNewEntry({ ...newEntry, category: e.target.value })}
              />
            </div>
          </div>
          {/* Type toggle inside modal */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] px-1 block">
              Tipo
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNewEntry({ ...newEntry, type: "income" })}
                className={cn(
                  "h-10 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                  newEntry.type === "income"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-slate-400 border-slate-200 hover:border-emerald-300"
                )}
              >
                + Receita
              </button>
              <button
                type="button"
                onClick={() => setNewEntry({ ...newEntry, type: "expense" })}
                className={cn(
                  "h-10 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                  newEntry.type === "expense"
                    ? "bg-rose-600 text-white border-rose-600"
                    : "bg-white text-slate-400 border-slate-200 hover:border-rose-300"
                )}
              >
                − Despesa
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
