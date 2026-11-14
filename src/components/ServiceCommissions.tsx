import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, DollarSign, Percent, RotateCcw, Wallet } from "lucide-react";
import { Badge, Button, ContentCard, EmptyState, FilterLine, FilterLineDateRange, FilterLineItem, FilterLineSection, FilterLineSegmented, Input, Select } from "./ui";
import { PERIOD_OPTIONS, presetRange, type ListPeriod } from "../lib/listPeriod";

type Role = "technician" | "seller";

interface Row {
  id: number;
  number: number;
  customer_name: string;
  status: string;
  date: string;
  service_base: number;
  total_amount: number;
  person_id: number | null;
  person_name: string | null;
  rule_type: "percent" | "fixed";
  rule_value: number;
  overridden: boolean;
  commission: number;
  paid_at: string | null;
}

interface Person { id: number; name: string; is_active?: boolean }

const authH = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" });
const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
const parseNum = (s: string) => Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;
const STATUS_LABEL: Record<string, string> = { finalizado: "Finalizada", nota_emitida: "Nota emitida", entregue: "Entregue" };

/**
 * Comissão sobre SERVIÇOS das Ordens de Serviço concluídas.
 * A regra padrão fica no cadastro (% ou valor fixo); aqui dá para ajustar uma O.S. específica,
 * vincular quem executou/vendeu e marcar as comissões como pagas.
 */
export default function ServiceCommissions({ role }: { role: Role }) {
  const label = role === "technician" ? "técnico" : "vendedor";
  const plural = role === "technician" ? "técnicos" : "vendedores";
  const [period, setPeriod] = useState<ListPeriod>("month");
  const [from, setFrom] = useState<string | null>(() => presetRange("month").from);
  const [to, setTo] = useState<string | null>(() => presetRange("month").to);
  const [person, setPerson] = useState("all");
  const [people, setPeople] = useState<Person[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [edits, setEdits] = useState<Record<number, { type: "percent" | "fixed"; value: string }>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const choosePeriod = (p: ListPeriod) => { setPeriod(p); const r = presetRange(p); setFrom(r.from); setTo(r.to); };

  useEffect(() => {
    fetch(role === "technician" ? "/api/technicians" : "/api/sellers", { headers: authH() })
      .then((r) => r.json()).then((d) => setPeople(Array.isArray(d) ? d : [])).catch(() => {});
  }, [role]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const q = new URLSearchParams({ role, person });
      if (from) q.set("from", from);
      if (to) q.set("to", to);
      const r = await fetch(`/api/service-commissions?${q}`, { headers: authH() });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "Falha ao carregar");
      setRows(d.rows ?? []);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }, [role, person, from, to]);

  useEffect(() => { void load(); }, [load]);

  const call = async (url: string, method: string, body: unknown) => {
    setBusy(true); setError("");
    try {
      const r = await fetch(url, { method, headers: authH(), body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "Não foi possível salvar");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setBusy(false);
    }
  };

  const saveRule = (row: Row) => {
    const e = edits[row.id];
    if (!e) return;
    void call(`/api/service-commissions/${row.id}`, "PUT", { role, type: e.type, value: parseNum(e.value) }).then(() =>
      setEdits((cur) => { const n = { ...cur }; delete n[row.id]; return n; }));
  };
  const resetRule = (row: Row) => void call(`/api/service-commissions/${row.id}`, "PUT", { role, type: null });
  const linkPerson = (row: Row, id: string) => void call(`/api/service-commissions/${row.id}`, "PUT", { role, person_id: id ? Number(id) : null });
  const pay = (ids: number[], paid: boolean) => void call("/api/service-commissions/pay", "POST", { role, ids, paid });

  const totals = useMemo(() => {
    let total = 0, paid = 0;
    rows.forEach((r) => { total += r.commission; if (r.paid_at) paid += r.commission; });
    return { total, paid, pending: total - paid, count: rows.filter((r) => r.person_id).length };
  }, [rows]);

  const payable = rows.filter((r) => r.person_id && r.commission > 0);
  const selectedRows = payable.filter((r) => selected.has(r.id));
  const selectedPending = selectedRows.filter((r) => !r.paid_at);
  const toggle = (id: number) => setSelected((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSelected = payable.length > 0 && payable.every((r) => selected.has(r.id));

  const personSelect = (r: Row) => (
    <Select size="sm" aria-label="Vincular" value={r.person_id ?? ""} disabled={busy} onChange={(ev) => linkPerson(r, ev.target.value)}>
      <option value="">— sem {label} —</option>
      {people.filter((p) => p.is_active !== false || p.id === r.person_id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </Select>
  );

  const ruleEditor = (r: Row) => {
    if (!r.person_id) return <span className="text-slate-400">—</span>;
    const e = edits[r.id];
    const type = e?.type ?? r.rule_type;
    const value = e?.value ?? String(r.rule_value).replace(".", ",");
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          aria-label="Tipo da comissão"
          value={type}
          onChange={(ev) => setEdits((c) => ({ ...c, [r.id]: { type: ev.target.value as "percent" | "fixed", value } }))}
          className="h-8 rounded border border-slate-200 bg-white px-1 text-xs"
        >
          <option value="percent">%</option>
          <option value="fixed">R$ fixo</option>
        </select>
        <Input size="sm" inputMode="decimal" value={value} aria-label="Valor da comissão"
          wrapperClassName="w-20" className="text-right"
          onChange={(ev) => setEdits((c) => ({ ...c, [r.id]: { type, value: ev.target.value } }))} />
        {e ? (
          <Button size="xs" disabled={busy} onClick={() => saveRule(r)}>Salvar</Button>
        ) : r.overridden ? (
          <>
            <Badge size="sm" color="warning">ajustada</Badge>
            <button type="button" title="Voltar à regra padrão do cadastro" onClick={() => resetRule(r)} className="text-slate-400 hover:text-slate-700"><RotateCcw size={13} /></button>
          </>
        ) : (
          <span className="text-[11px] text-slate-400">padrão</span>
        )}
      </div>
    );
  };

  const statusBadge = (r: Row) =>
    !r.person_id ? <span className="text-slate-400">—</span>
      : r.paid_at ? <Badge size="sm" color="success">Paga {fmtDate(r.paid_at)}</Badge>
      : <Badge size="sm" color="warning">A pagar</Badge>;

  return (
    <div className="space-y-3">
      <FilterLine>
        <FilterLineSection grow>
          <FilterLineItem minWidth={200}>
            <Select size="sm" aria-label={`Filtrar por ${label}`} value={person} onChange={(e) => setPerson(e.target.value)}>
              <option value="all">Todos os {plural}</option>
              <option value="none">Sem {label} vinculado</option>
              {people.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
            </Select>
          </FilterLineItem>
          <FilterLineSegmented value={period} onChange={(v) => choosePeriod(v as ListPeriod)} options={PERIOD_OPTIONS} />
          <FilterLineDateRange from={from} to={to}
            onFromChange={(v) => { setFrom(v); setPeriod("custom"); }}
            onToChange={(v) => { setTo(v); setPeriod("custom"); }} />
        </FilterLineSection>
      </FilterLine>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          { t: "Comissão no período", v: money(totals.total), icon: DollarSign, c: "text-slate-900" },
          { t: "A pagar", v: money(totals.pending), icon: Wallet, c: "text-amber-600" },
          { t: "Já paga", v: money(totals.paid), icon: CheckCircle2, c: "text-emerald-600" },
          { t: "O.S. com " + label, v: String(totals.count), icon: Percent, c: "text-blue-600" },
        ].map((s) => (
          <div key={s.t} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><s.icon size={12} /> {s.t}</div>
            <div className={`mt-1 text-lg font-semibold tabular-nums ${s.c}`}>{s.v}</div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-slate-500">
        A comissão é calculada sobre o <strong>valor do serviço</strong> (sem peças, já com o desconto da O.S.) das ordens
        finalizadas, com nota emitida ou entregues. A regra padrão é a do cadastro; você pode ajustar uma O.S. específica
        (% ou valor fixo) e vincular o {label} nas ordens que ficaram sem ninguém.
      </p>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

      {selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs">
          <span className="font-medium text-blue-800">
            {selectedRows.length} selecionada(s) · {money(selectedRows.reduce((s, r) => s + r.commission, 0))}
          </span>
          <Button size="xs" disabled={busy || selectedPending.length === 0} onClick={() => pay(selectedPending.map((r) => r.id), true)}>
            Marcar como paga ({selectedPending.length})
          </Button>
          <Button size="xs" variant="outline" disabled={busy || selectedRows.length === selectedPending.length}
            onClick={() => pay(selectedRows.filter((r) => r.paid_at).map((r) => r.id), false)}>
            Desfazer pagamento
          </Button>
        </div>
      )}

      {loading ? (
        <div role="status" className="py-10 text-center text-sm text-slate-500">Carregando…</div>
      ) : rows.length === 0 ? (
        <ContentCard>
          <EmptyState icon={Percent} title="Nenhuma O.S. concluída neste período" description="Mude o período ou o filtro para ver outras ordens." />
        </ContentCard>
      ) : (
        <>
          {/* Celular / tablet: um cartão por O.S. */}
          <div className="space-y-2 lg:hidden">
            {rows.map((r) => (
              <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    {r.person_id && r.commission > 0 && (
                      <input type="checkbox" className="mt-0.5" aria-label={"Selecionar O.S. " + r.number} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                    )}
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-900">O.S. #{r.number}</p>
                      <p className="truncate text-xs text-slate-600">{r.customer_name || "—"}</p>
                      <p className="text-[11px] text-slate-400">{STATUS_LABEL[r.status] ?? r.status} · {fmtDate(r.date)}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] text-slate-500">Comissão</p>
                    <p className="text-sm font-semibold tabular-nums text-slate-900">{r.person_id ? money(r.commission) : "—"}</p>
                    <div className="mt-0.5">{statusBadge(r)}</div>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 border-t border-slate-100 pt-2 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-[11px] text-slate-500">{label[0].toUpperCase() + label.slice(1)} · serviço {money(r.service_base)}</p>
                    {personSelect(r)}
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] text-slate-500">Regra desta O.S.</p>
                    {ruleEditor(r)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white lg:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-50 text-left text-[11px] font-semibold text-slate-500">
                  <th className="w-8 px-3 py-2"><input type="checkbox" aria-label="Selecionar todas" checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(payable.map((r) => r.id)))} /></th>
                  <th className="px-3 py-2">O.S.</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2 text-right">Serviço</th>
                  <th className="px-3 py-2">{label[0].toUpperCase() + label.slice(1)}</th>
                  <th className="px-3 py-2">Regra desta O.S.</th>
                  <th className="px-3 py-2 text-right">Comissão</th>
                  <th className="px-3 py-2">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="align-middle hover:bg-slate-50/60">
                    <td className="px-3 py-2">
                      {r.person_id && r.commission > 0 && <input type="checkbox" aria-label={"Selecionar O.S. " + r.number} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />}
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-800">#{r.number}</td>
                    <td className="px-3 py-2">
                      <div className="max-w-[180px] truncate font-medium text-slate-800">{r.customer_name || "—"}</div>
                      <div className="text-[11px] text-slate-400">{STATUS_LABEL[r.status] ?? r.status}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{fmtDate(r.date)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{money(r.service_base)}</td>
                    <td className="min-w-[170px] px-3 py-2">{personSelect(r)}</td>
                    <td className="px-3 py-2">{ruleEditor(r)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">{r.person_id ? money(r.commission) : "—"}</td>
                    <td className="px-3 py-2">{statusBadge(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
