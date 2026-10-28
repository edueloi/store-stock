import { useEffect, useMemo, useRef, useState } from "react";
import { Bike, Check, Copy, ExternalLink, Plus, Printer, QrCode, Save, Trash2 } from "lucide-react";
import { Button, Input, PageWrapper, SectionTitle, Alert } from "../../components/ui";
import { listHeldSales, type HeldSale } from "../../lib/heldSales";
import { cn } from "../../lib/utils";

let qrModule: Promise<any> | null = null;
const loadQr = () => (qrModule ??= import("qrcode").then((m) => m.default || m));

function QrCanvas({ text, size = 160 }: { text: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let alive = true;
    loadQr().then((qr) => { if (alive && ref.current) qr.toCanvas(ref.current, text, { width: size, margin: 2 }, () => {}); });
    return () => { alive = false; };
  }, [text, size]);
  return <canvas ref={ref} width={size} height={size} style={{ width: size, height: size }} />;
}

interface MenuConfig {
  accepts: { mesa: boolean; balcao: boolean; pickup: boolean; delivery: boolean };
  delivery: { fee_mode: "fixed" | "neighborhood"; fixed_fee: number; free_above: number; min_order: number; eta: string; neighborhoods: { name: string; fee: number }[] };
  pickup_eta: string;
  payments: { pix: boolean; money: boolean; card: boolean };
}

const DEFAULT_CFG: MenuConfig = {
  accepts: { mesa: true, balcao: true, pickup: true, delivery: false },
  delivery: { fee_mode: "fixed", fixed_fee: 0, free_above: 0, min_order: 0, eta: "40-60 min", neighborhoods: [] },
  pickup_eta: "20-30 min",
  payments: { pix: true, money: true, card: true },
};

const money = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
const num = (v: string) => { const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) && n >= 0 ? n : 0; };

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={cn("flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors", checked ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50")}>
      <span>
        <span className="block text-xs font-semibold text-slate-800">{label}</span>
        {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
      </span>
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-emerald-500" : "bg-slate-300")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </span>
    </button>
  );
}

// Cardápio digital (módulo de estabelecimento alimentício): tela própria, separada do site.
// Aqui a loja configura como recebe pedidos (mesa, balcão, retirada, entrega), taxas e pagamentos,
// imprime os QR Codes das mesas e acompanha as comandas abertas.
export default function CardapioQr() {
  const token = () => localStorage.getItem("token") ?? "";
  const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token()}` });
  const [baseUrl, setBaseUrl] = useState("");
  const [policies, setPolicies] = useState<Record<string, unknown>>({});
  const [cfg, setCfg] = useState<MenuConfig>(DEFAULT_CFG);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tables, setTables] = useState("10");
  const [copied, setCopied] = useState("");
  const [comandas, setComandas] = useState<HeldSale[]>([]);

  useEffect(() => {
    fetch("/api/tenant", { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        if (d.public_url) setBaseUrl(String(d.public_url).replace(/\/+$/, ""));
        else if (d.slug) setBaseUrl(`${window.location.origin}/s/${d.slug}`);
        const pol = (d.policies && typeof d.policies === "object" ? d.policies : {}) as Record<string, any>;
        setPolicies(pol);
        const m = pol.menu || {};
        setCfg({
          accepts: { ...DEFAULT_CFG.accepts, ...(m.accepts || {}) },
          delivery: { ...DEFAULT_CFG.delivery, ...(m.delivery || {}), neighborhoods: Array.isArray(m.delivery?.neighborhoods) ? m.delivery.neighborhoods.map((n: any) => ({ name: String(n.name || ""), fee: Number(n.fee) || 0 })) : [] },
          pickup_eta: typeof m.pickup_eta === "string" ? m.pickup_eta : DEFAULT_CFG.pickup_eta,
          payments: { ...DEFAULT_CFG.payments, ...(m.payments || {}) },
        });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
    const load = () => listHeldSales(token(), "held").then(setComandas).catch(() => {});
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const save = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const cleaned: MenuConfig = { ...cfg, delivery: { ...cfg.delivery, neighborhoods: cfg.delivery.neighborhoods.filter((n) => n.name.trim()).map((n) => ({ name: n.name.trim(), fee: n.fee })) } };
      const res = await fetch("/api/tenant", { method: "PUT", headers: headers(), body: JSON.stringify({ policies: { ...policies, menu: cleaned } }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar.");
      setPolicies((p) => ({ ...p, menu: cleaned }));
      setSaveMsg({ ok: true, text: "Configurações salvas." });
    } catch (e) {
      setSaveMsg({ ok: false, text: e instanceof Error ? e.message : "Não foi possível salvar." });
    } finally {
      setSaving(false);
    }
  };

  const setAcc = (k: keyof MenuConfig["accepts"], v: boolean) => setCfg((c) => ({ ...c, accepts: { ...c.accepts, [k]: v } }));
  const setDel = (patch: Partial<MenuConfig["delivery"]>) => setCfg((c) => ({ ...c, delivery: { ...c.delivery, ...patch } }));
  const setPay = (k: keyof MenuConfig["payments"], v: boolean) => setCfg((c) => ({ ...c, payments: { ...c.payments, [k]: v } }));

  const count = Math.max(1, Math.min(60, Number(tables) || 1));
  const menuUrl = `${baseUrl}/cardapio`;
  const urlFor = (mesa: number | string) => `${menuUrl}?mesa=${encodeURIComponent(String(mesa))}`;
  const balcaoUrl = `${menuUrl}?balcao=1`;
  const mesas = useMemo(() => Array.from({ length: count }, (_, i) => i + 1), [count]);

  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); window.setTimeout(() => setCopied(""), 1500); } catch { /* sem permissão */ }
  };

  const printSheet = async () => {
    const qr = await loadQr();
    const items: { title: string; url: string }[] = [
      ...(cfg.accepts.mesa ? mesas.map((m) => ({ title: `MESA ${m}`, url: urlFor(m) })) : []),
      ...(cfg.accepts.balcao ? [{ title: "BALCÃO", url: balcaoUrl }] : []),
    ];
    const cards = await Promise.all(items.map(async (it) => {
      const dataUrl: string = await qr.toDataURL(it.url, { width: 320, margin: 2 });
      return `<div class="card"><div class="mesa">${it.title}</div><img src="${dataUrl}"/><div class="hint">Aponte a câmera do celular<br/>e faça seu pedido</div></div>`;
    }));
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>QR do cardápio</title><style>
      body{font-family:Arial,sans-serif;margin:16px}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
      .card{border:2px solid #111;border-radius:14px;padding:14px;text-align:center;page-break-inside:avoid}
      .mesa{font-size:22px;font-weight:900;letter-spacing:.08em;margin-bottom:6px}
      img{width:100%;max-width:240px}
      .hint{font-size:12px;color:#444;margin-top:6px}
      @media print{body{margin:0}}
    </style></head><body><div class="grid">${cards.join("")}</div><script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`);
    w.document.close();
  };

  const comandaTotal = (c: HeldSale) => (c.items ?? []).reduce((sum, it: any) => sum + Number(it.unit_price ?? 0) * Number(it.quantity ?? 0), 0);

  return (
    <PageWrapper>
      <div className="space-y-5">
        <SectionTitle title="Cardápio digital" description="Seu cardápio no estilo de app de delivery: o cliente pede pela mesa (QR Code), no balcão, por retirada ou entrega. É independente do site da loja." />

        {/* Links */}
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-800">Link do cardápio</h3>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">{baseUrl ? menuUrl : "carregando…"}</code>
            <Button variant="outline" iconLeft={copied === "menu" ? <Check size={14} /> : <Copy size={14} />} onClick={() => copy("menu", menuUrl)} disabled={!baseUrl}>{copied === "menu" ? "Copiado" : "Copiar"}</Button>
            <a href={baseUrl ? menuUrl : "#"} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"><ExternalLink size={13} /> Abrir cardápio</a>
          </div>
          <p className="text-xs text-slate-500">Use este link no Instagram, no WhatsApp e no Google. Para entrega e retirada o cliente escolhe o modo dentro do cardápio.</p>
        </section>

        {/* Configuração */}
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-800">Como a loja recebe pedidos</h3>
          {!loaded && <p className="text-xs text-slate-500">Carregando…</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            <Toggle checked={cfg.accepts.mesa} onChange={(v) => setAcc("mesa", v)} label="Pedido na mesa" hint="QR Code por mesa — vira comanda aberta" />
            <Toggle checked={cfg.accepts.balcao} onChange={(v) => setAcc("balcao", v)} label="Pedido no balcão" hint="Cliente pede pelo celular e retira no balcão" />
            <Toggle checked={cfg.accepts.pickup} onChange={(v) => setAcc("pickup", v)} label="Retirada" hint="Cliente pede antes e busca na loja" />
            <Toggle checked={cfg.accepts.delivery} onChange={(v) => setAcc("delivery", v)} label="Entrega (delivery)" hint="Com taxa de entrega e pedido mínimo" />
          </div>

          {cfg.accepts.delivery && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold text-slate-800"><Bike size={14} />Entrega</h4>
              <div className="flex gap-2">
                {(["fixed", "neighborhood"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setDel({ fee_mode: m })}
                    className={cn("h-9 rounded-lg border px-3 text-xs font-medium", cfg.delivery.fee_mode === m ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600")}>
                    {m === "fixed" ? "Taxa fixa" : "Taxa por bairro"}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                {cfg.delivery.fee_mode === "fixed" && (
                  <Input label="Taxa de entrega (R$)" inputMode="decimal" value={String(cfg.delivery.fixed_fee).replace(".", ",")} onChange={(e) => setDel({ fixed_fee: num(e.target.value) })} />
                )}
                <Input label="Frete grátis acima de (R$)" inputMode="decimal" value={String(cfg.delivery.free_above || "").replace(".", ",")} placeholder="0 = nunca" onChange={(e) => setDel({ free_above: num(e.target.value) })} />
                <Input label="Pedido mínimo (R$)" inputMode="decimal" value={String(cfg.delivery.min_order || "").replace(".", ",")} placeholder="0 = sem mínimo" onChange={(e) => setDel({ min_order: num(e.target.value) })} />
                <Input label="Tempo estimado" value={cfg.delivery.eta} onChange={(e) => setDel({ eta: e.target.value })} placeholder="40-60 min" />
              </div>
              {cfg.delivery.fee_mode === "neighborhood" && (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-500">Só entrega nos bairros listados. Cada um com a sua taxa.</p>
                  {cfg.delivery.neighborhoods.map((n, i) => (
                    <div key={i} className="grid grid-cols-[1fr_120px_36px] gap-2">
                      <Input aria-label="Bairro" placeholder="Bairro" value={n.name} onChange={(e) => setDel({ neighborhoods: cfg.delivery.neighborhoods.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                      <Input aria-label="Taxa" inputMode="decimal" placeholder="Taxa R$" value={String(n.fee || "").replace(".", ",")} onChange={(e) => setDel({ neighborhoods: cfg.delivery.neighborhoods.map((x, j) => (j === i ? { ...x, fee: num(e.target.value) } : x)) })} />
                      <button type="button" aria-label="Remover bairro" className="flex h-9 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50" onClick={() => setDel({ neighborhoods: cfg.delivery.neighborhoods.filter((_, j) => j !== i) })}><Trash2 size={15} /></button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" iconLeft={<Plus size={13} />} onClick={() => setDel({ neighborhoods: [...cfg.delivery.neighborhoods, { name: "", fee: 0 }] })}>Adicionar bairro</Button>
                </div>
              )}
              <p className="text-[11px] text-slate-500">Pedidos de entrega e retirada chegam em <b>Pedidos</b> como pendentes, com endereço, forma de pagamento e troco.</p>
            </div>
          )}

          {cfg.accepts.pickup && (
            <div className="max-w-xs"><Input label="Tempo estimado de retirada" value={cfg.pickup_eta} onChange={(e) => setCfg((c) => ({ ...c, pickup_eta: e.target.value }))} placeholder="20-30 min" /></div>
          )}

          {(cfg.accepts.delivery || cfg.accepts.pickup) && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-800">Formas de pagamento na entrega/retirada</h4>
              <div className="grid gap-2 sm:grid-cols-3">
                <Toggle checked={cfg.payments.pix} onChange={(v) => setPay("pix", v)} label="PIX" />
                <Toggle checked={cfg.payments.money} onChange={(v) => setPay("money", v)} label="Dinheiro (com troco)" />
                <Toggle checked={cfg.payments.card} onChange={(v) => setPay("card", v)} label="Cartão na maquininha" />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button variant="primary" iconLeft={<Save size={14} />} onClick={save} loading={saving}>Salvar configurações</Button>
            {saveMsg && <span className={cn("text-xs font-medium", saveMsg.ok ? "text-emerald-700" : "text-rose-600")}>{saveMsg.text}</span>}
          </div>
        </section>

        {/* QR */}
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-800">QR Code das mesas e do balcão</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40"><Input label="Quantidade de mesas" type="number" min={1} max={60} value={tables} onChange={(e) => setTables(e.target.value)} /></div>
            <Button variant="primary" iconLeft={<Printer size={14} />} onClick={printSheet} disabled={!baseUrl}>Imprimir QR Codes</Button>
            <Button variant="outline" iconLeft={copied === "balcao" ? <Check size={14} /> : <Copy size={14} />} onClick={() => copy("balcao", balcaoUrl)} disabled={!baseUrl}>{copied === "balcao" ? "Copiado" : "Copiar link do balcão"}</Button>
          </div>
          <p className="text-xs text-slate-500">Pedidos da mesma mesa somam na comanda aberta; a conta é fechada no caixa (PDV → Comandas).</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {baseUrl && mesas.slice(0, 10).map((m) => (
              <div key={m} className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 p-2">
                <span className="text-xs font-bold tracking-wide text-slate-700">MESA {m}</span>
                <QrCanvas text={urlFor(m)} size={120} />
              </div>
            ))}
          </div>
          {count > 10 && <p className="text-xs text-slate-500">Mostrando as 10 primeiras; a folha impressa traz todas as {count} mesas.</p>}
        </section>

        {/* Comandas */}
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Comandas abertas ({comandas.length})</h3>
            <span className="text-[11px] text-slate-500">Atualiza sozinho</span>
          </div>
          {comandas.length === 0 && <Alert variant="info">Nenhuma comanda aberta no momento.</Alert>}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {comandas.map((c) => (
              <div key={c.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">{c.customer_name || `Comanda #${String(c.number).padStart(4, "0")}`}</span>
                  <span className="text-[11px] text-slate-500">#{String(c.number).padStart(4, "0")}</span>
                </div>
                <p className="text-xs text-slate-500">{(c.items ?? []).length} item(ns) • {money(comandaTotal(c))}</p>
                {c.notes && <p className="mt-1 text-[11px] text-slate-400">{c.notes}</p>}
              </div>
            ))}
          </div>
          <a href="/admin/pdv" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800"><QrCode size={13} /> Abrir PDV para fechar comandas</a>
        </section>
      </div>
    </PageWrapper>
  );
}
