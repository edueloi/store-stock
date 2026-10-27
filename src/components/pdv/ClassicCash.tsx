import React, { useEffect, useState } from "react";
import { CASH_DENOMINATIONS, type ClosedCashSession } from "../../lib/cashSession";
import { forgetLogin, rememberLogin, verifyOfflineLogin } from "../../lib/offlineLogin";

// Telas do Caixa Clássico que antes reaproveitavam as do PDV moderno: login, abertura e fechamento de
// caixa. Mesmo visual do balcão clássico: o layout de venda ao fundo (escurecido) e uma janela clara por
// cima, tudo operável por teclado (Enter confirma, Esc volta).

const cn = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

const money = (v: number | string) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const centsToNumber = (cents: string) => (cents ? Number(cents) / 100 : 0);

const inputCls = "h-11 w-full rounded-sm border border-[#c5cfdf] bg-white px-3 text-[15px] text-slate-800 outline-none focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/20 disabled:bg-slate-100";
const labelCls = "mb-1 block text-[12px] font-medium text-slate-500";
const btn = (tone: "green" | "navy" | "red" | "gray") =>
  cn(
    "h-12 w-full rounded-sm px-5 text-[13px] font-semibold uppercase tracking-wide text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    tone === "green" && "bg-[#1b7e0e] hover:bg-[#166a0b]",
    tone === "navy" && "bg-[#0b527a] hover:bg-[#09425f]",
    tone === "red" && "bg-[#c00000] hover:bg-[#a00000]",
    tone === "gray" && "bg-slate-500 hover:bg-slate-600",
  );

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

/** Layout de balcão ao fundo, escurecido, com a janela clara por cima (igual à referência "Entrar no Caixa"). */
export function ClassicBackdrop({ children, width = 440 }: { children: React.ReactNode; width?: number }) {
  const online = useOnline();
  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#eef2f9] font-sans text-slate-800">
      <header className="flex h-[68px] shrink-0 items-center justify-between bg-[#0b527a] px-5 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-white/15 text-lg font-bold">B</div>
          <div className="leading-tight">
            <p className="text-[15px] font-semibold">Store BoxSys</p>
            <p className={cn("flex items-center gap-1.5 text-[11px] font-medium", online ? "text-emerald-300" : "text-amber-300")}>
              <i className={cn("h-1.5 w-1.5 rounded-full", online ? "bg-emerald-400" : "bg-amber-400")} />
              {online ? "Online" : "Modo offline"}
            </p>
          </div>
        </div>
        <p className="text-[11px] uppercase tracking-widest text-white/60">Caixa Clássico</p>
      </header>

      {/* esqueleto do balcão (só decoração) */}
      <main className="grid min-h-0 flex-1 grid-cols-[minmax(380px,40%)_1fr] gap-6 p-5 opacity-60" aria-hidden>
        <section>
          <p className={labelCls}>Cód. / Produto (Ctrl+P)</p>
          <div className="h-11 rounded-sm border border-[#c5cfdf] bg-white" />
          <div className="mt-5 grid grid-cols-3 gap-3">
            {["Quantidade", "Valor Unitário", "Valor Total"].map((l) => (
              <div key={l}><p className={labelCls}>{l}</p><div className="h-11 rounded-sm border border-[#c5cfdf] bg-white" /></div>
            ))}
          </div>
          <div className="mt-5 h-12 rounded-sm bg-[#0078d4]" />
        </section>
        <section>
          <div className="mb-3 rounded-sm border border-[#c5cfdf] bg-white px-4 py-3 text-[13px] text-slate-500">Aguardando abertura de pedido.</div>
          <div className="flex h-[300px] items-center justify-center rounded-sm border border-[#c5cfdf] bg-white text-[20px] text-slate-400">
            Seu caixa está <b className="mx-1 text-[#0078d4]">livre</b> no momento!
          </div>
        </section>
      </main>
      <div className="absolute inset-0 bg-slate-900/55" />

      <div className="absolute inset-0 flex items-center justify-center overflow-y-auto p-4">
        <div className="max-h-full w-full overflow-y-auto rounded-sm bg-white p-7 shadow-2xl" style={{ maxWidth: width }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Login ───────────────────────────────────────────────────────────────────
export function ClassicLogin({ onLogin }: { onLogin: (token: string) => void }) {
  const online = useOnline();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading) return;
    if (!identifier.trim() || !password) { setError("Informe o usuário e a senha."); return; }
    setLoading(true);
    setError("");
    try {
      let res: Response;
      try {
        res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: identifier.trim(), password }),
          signal: AbortSignal.timeout(8000),
        });
      } catch {
        // sem servidor/internet: entra com a verificação guardada neste computador
        const offline = await verifyOfflineLogin(identifier, password);
        if (offline === "unknown") setError("Sem conexão com o servidor. Este usuário ainda não entrou neste computador — conecte à internet uma vez para liberar o acesso offline.");
        else if (offline === "wrong") setError("Senha incorreta.");
        else {
          localStorage.setItem("token", offline.token);
          localStorage.setItem("user", JSON.stringify(offline.user));
          onLogin(offline.token);
        }
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        void rememberLogin(identifier, password, data.token, data.user);
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        if (data.user?.role === "super_admin") { window.location.href = "/super-admin"; return; }
        onLogin(data.token);
      } else {
        if (res.status === 400 || res.status === 401) void forgetLogin(identifier);
        setError(data.error || "Usuário ou senha inválidos.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ClassicBackdrop>
      <form onSubmit={submit}>
        <h2 className="text-[22px] font-semibold text-[#0b527a]">Entrar no PDV</h2>
        <p className="mt-1 text-[13px] text-slate-500">Informe seu usuário e senha para abrir o caixa.</p>

        <div className="mt-6">
          <label className={labelCls}>Usuário</label>
          <input className={inputCls} value={identifier} autoFocus autoComplete="username" placeholder="ex.: joyce.antunes" onChange={(e) => setIdentifier(e.target.value)} />
        </div>
        <div className="mt-4">
          <label className={labelCls}>Senha</label>
          <div className="relative">
            <input className={cn(inputCls, "pr-20")} type={show ? "text" : "password"} value={password} autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} />
            <button type="button" tabIndex={-1} onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-[#0078d4] hover:underline">
              {show ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </div>

        {error && <p className="mt-4 rounded-sm border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}

        <button type="submit" disabled={loading} className={cn(btn("green"), "mt-6")}>{loading ? "Entrando…" : "Entrar (Enter)"}</button>
        <p className={cn("mt-4 text-center text-[12px] font-medium", online ? "text-emerald-600" : "text-amber-600")}>
          Servidor: {online ? "conectado" : "offline — entra com usuário que já acessou neste computador"}
        </p>
      </form>
    </ClassicBackdrop>
  );
}

// ─── Abertura de caixa ───────────────────────────────────────────────────────
function Denominations({ counts, onChange }: { counts: Record<number, string>; onChange: (next: Record<number, string>) => void }) {
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-2 rounded-sm border border-[#c5cfdf] bg-slate-50 p-3">
      {CASH_DENOMINATIONS.map((d) => (
        <label key={d.value} className="flex items-center justify-between gap-2 text-[12px] text-slate-600">
          <span className="font-medium">{d.label}</span>
          <input
            className="h-8 w-14 rounded-sm border border-[#c5cfdf] bg-white px-2 text-center text-[13px] outline-none focus:border-[#0078d4]"
            inputMode="numeric" value={counts[d.value] ?? ""} placeholder="0"
            onChange={(e) => onChange({ ...counts, [d.value]: e.target.value.replace(/\D/g, "") })}
          />
        </label>
      ))}
    </div>
  );
}

const denomTotal = (counts: Record<number, string>) => CASH_DENOMINATIONS.reduce((sum, d) => sum + d.value * (Number(counts[d.value]) || 0), 0);

export function ClassicOpenCash({ operatorName, onOpen, onLogout }: {
  operatorName?: string;
  onOpen: (openingAmount: number, openingNote?: string) => Promise<void>;
  onLogout: () => void;
}) {
  const [cents, setCents] = useState("");
  const [counting, setCounting] = useState(false);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = counting ? denomTotal(counts) : centsToNumber(cents);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onOpen(amount, note.trim() || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao abrir o caixa.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ClassicBackdrop width={460}>
      <div onKeyDown={(e) => { if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); void submit(); } }}>
        <h2 className="text-[22px] font-semibold text-[#0b527a]">Abrir Caixa</h2>
        <p className="mt-1 text-[13px] text-slate-500">
          Informe o dinheiro que está na gaveta para começar a vender.{operatorName ? <> Operador: <b className="text-slate-700">{operatorName}</b>.</> : null}
        </p>

        <div className="mt-6">
          <div className="mb-1 flex items-center justify-between">
            <label className="text-[12px] font-medium text-slate-500">Valor inicial em dinheiro (troco)</label>
            <button type="button" onClick={() => setCounting((v) => !v)} className="text-[12px] font-semibold text-[#0078d4] hover:underline">
              {counting ? "Digitar o valor" : "Contar cédulas"}
            </button>
          </div>
          {counting ? (
            <>
              <Denominations counts={counts} onChange={setCounts} />
              <p className="mt-2 text-right text-[13px] text-slate-600">Total contado: <b className="text-[#0b527a]">R$ {money(amount)}</b></p>
            </>
          ) : (
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-slate-400">R$</span>
              <input
                className={cn(inputCls, "pl-10 text-right font-mono text-[18px] font-semibold")} autoFocus inputMode="numeric"
                value={money(amount)} onFocus={(e) => e.target.select()}
                onChange={(e) => setCents(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          )}
        </div>

        <div className="mt-4">
          <label className={labelCls}>Observação <span className="text-slate-400">(opcional)</span></label>
          <textarea className="min-h-[64px] w-full rounded-sm border border-[#c5cfdf] bg-white px-3 py-2 text-[14px] outline-none focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/20" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {error && <p className="mt-4 rounded-sm border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}

        <button type="button" onClick={() => void submit()} disabled={submitting} className={cn(btn("green"), "mt-6")}>{submitting ? "Abrindo…" : "Abrir caixa (Enter)"}</button>
        <button type="button" onClick={onLogout} className="mt-4 w-full text-center text-[12px] font-semibold uppercase tracking-wide text-[#c00000] hover:underline">Sair do PDV</button>
      </div>
    </ClassicBackdrop>
  );
}

// ─── Fechamento de caixa ─────────────────────────────────────────────────────
const METHOD_LABELS: Record<string, string> = { money: "Dinheiro", pix: "PIX", debit: "Débito", credit: "Crédito", crediario: "Crediário" };

export function ClassicCloseCash({ onCancel, onConfirm, onFinish }: {
  onCancel: () => void;
  onConfirm: (countedAmount: number, countedBreakdown?: Record<string, number>, closingNote?: string) => Promise<ClosedCashSession>;
  onFinish: () => void;
}) {
  const [step, setStep] = useState<"count" | "result">("count");
  const [cents, setCents] = useState("");
  const [counting, setCounting] = useState(false);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClosedCashSession | null>(null);

  const counted = counting ? denomTotal(counts) : centsToNumber(cents);

  const confirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      setResult(await onConfirm(counted, undefined, note.trim() || undefined));
      setStep("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao fechar o caixa.");
    } finally {
      setSubmitting(false);
    }
  };

  // Enter confirma / conclui; Esc volta (só antes de confirmar — depois o fechamento já aconteceu).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && step === "count") { e.preventDefault(); onCancel(); }
      if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        if (step === "result") onFinish(); else void confirm();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, counted, note, submitting]);

  const breakdown = result?.payment_breakdown ?? {};
  const diff = result ? Number(result.difference_amount) : 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4 font-sans">
      <div className="max-h-full w-full overflow-y-auto rounded-sm bg-white p-7 shadow-2xl" style={{ maxWidth: step === "result" ? 560 : 460 }}>
        {step === "count" ? (
          <>
            <h2 className="text-[22px] font-semibold text-[#0b527a]">Fechar Caixa</h2>
            <p className="mt-1 text-[13px] text-slate-500">Informe o dinheiro contado na gaveta. O valor esperado só aparece depois de confirmar, e a ação não pode ser desfeita.</p>

            <div className="mt-6">
              <div className="mb-1 flex items-center justify-between">
                <label className="text-[12px] font-medium text-slate-500">Dinheiro contado</label>
                <button type="button" onClick={() => setCounting((v) => !v)} className="text-[12px] font-semibold text-[#0078d4] hover:underline">
                  {counting ? "Digitar o valor" : "Contar cédulas"}
                </button>
              </div>
              {counting ? (
                <>
                  <Denominations counts={counts} onChange={setCounts} />
                  <p className="mt-2 text-right text-[13px] text-slate-600">Total contado: <b className="text-[#0b527a]">R$ {money(counted)}</b></p>
                </>
              ) : (
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-slate-400">R$</span>
                  <input className={cn(inputCls, "pl-10 text-right font-mono text-[18px] font-semibold")} autoFocus inputMode="numeric" value={money(counted)} onFocus={(e) => e.target.select()} onChange={(e) => setCents(e.target.value.replace(/\D/g, ""))} />
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className={labelCls}>Observação <span className="text-slate-400">(opcional)</span></label>
              <textarea className="min-h-[64px] w-full rounded-sm border border-[#c5cfdf] bg-white px-3 py-2 text-[14px] outline-none focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/20" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            {error && <p className="mt-4 rounded-sm border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" className={btn("gray")} onClick={onCancel} disabled={submitting}>Voltar (Esc)</button>
              <button type="button" className={btn("red")} onClick={() => void confirm()} disabled={submitting}>{submitting ? "Fechando…" : "Fechar caixa (Enter)"}</button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-[22px] font-semibold text-[#0b527a]">Caixa fechado</h2>
            {result?.pendingSync ? (
              <p className="mt-3 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
                Fechamento salvo neste computador (sem internet). O esperado por forma de pagamento e a diferença serão calculados assim que sincronizar.
              </p>
            ) : (
              <>
                <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 rounded-sm bg-[#eef2f9] p-4 text-[14px]">
                  <div><dt className="text-[12px] text-slate-500">Valor inicial</dt><dd className="font-mono font-semibold">R$ {money(result?.opening_amount ?? 0)}</dd></div>
                  <div><dt className="text-[12px] text-slate-500">Esperado em dinheiro</dt><dd className="font-mono font-semibold">R$ {money(result?.expected_amount ?? 0)}</dd></div>
                  <div><dt className="text-[12px] text-slate-500">Contado</dt><dd className="font-mono font-semibold">R$ {money(result?.counted_amount ?? 0)}</dd></div>
                  <div>
                    <dt className="text-[12px] text-slate-500">Diferença</dt>
                    <dd className={cn("font-mono text-[16px] font-bold", Math.abs(diff) < 0.005 ? "text-emerald-600" : diff < 0 ? "text-rose-600" : "text-amber-600")}>
                      {diff > 0 ? "+" : ""}R$ {money(diff)}
                    </dd>
                  </div>
                </dl>

                {Object.keys(breakdown).length > 0 && (
                  <table className="mt-5 w-full text-[13px]">
                    <thead className="text-[11px] uppercase text-slate-400">
                      <tr className="border-b border-slate-200"><th className="py-2 text-left">Forma</th><th className="text-right">Esperado</th><th className="text-right">Taxa</th><th className="text-right">Líquido</th></tr>
                    </thead>
                    <tbody>
                      {Object.entries(breakdown).map(([method, entry]) => (
                        <tr key={method} className="border-b border-slate-100">
                          <td className="py-2">{METHOD_LABELS[method] ?? method}</td>
                          <td className="text-right font-mono">R$ {money(entry.expected)}</td>
                          <td className="text-right font-mono text-slate-500">{entry.fee ? `R$ ${money(entry.fee)}` : "—"}</td>
                          <td className="text-right font-mono">{entry.net != null ? `R$ ${money(entry.net)}` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
            <button type="button" className={cn(btn("green"), "mt-6")} onClick={onFinish}>Concluir (Enter)</button>
          </>
        )}
      </div>
    </div>
  );
}
