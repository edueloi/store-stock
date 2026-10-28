import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Printer, QrCode, Copy, Check } from "lucide-react";
import { Button, Input, PageWrapper, SectionTitle, Alert } from "../../components/ui";
import { listHeldSales, type HeldSale } from "../../lib/heldSales";

let qrModule: Promise<any> | null = null;
const loadQr = () => (qrModule ??= import("qrcode").then((m) => m.default || m));

// QR em canvas (mesma lib usada nas etiquetas).
function QrCanvas({ text, size = 160 }: { text: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let alive = true;
    loadQr().then((qr) => { if (alive && ref.current) qr.toCanvas(ref.current, text, { width: size, margin: 2 }, () => {}); });
    return () => { alive = false; };
  }, [text, size]);
  return <canvas ref={ref} width={size} height={size} style={{ width: size, height: size }} />;
}

const money = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

// Cardápio digital por QR Code + comandas abertas (módulo de estabelecimento alimentício).
// O QR de cada mesa abre a vitrine com ?mesa=N; o pedido cai como uma comanda aberta no PDV.
export default function CardapioQr() {
  const token = () => localStorage.getItem("token") ?? "";
  const [baseUrl, setBaseUrl] = useState("");
  const [tables, setTables] = useState("10");
  const [copied, setCopied] = useState(false);
  const [comandas, setComandas] = useState<HeldSale[]>([]);

  useEffect(() => {
    fetch("/api/tenant", { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.public_url) setBaseUrl(String(d.public_url).replace(/\/+$/, "")); else if (d?.slug) setBaseUrl(`${window.location.origin}/s/${d.slug}`); })
      .catch(() => {});
    const load = () => listHeldSales(token(), "held").then(setComandas).catch(() => {});
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const count = Math.max(1, Math.min(60, Number(tables) || 1));
  const urlFor = (mesa: number | string) => `${baseUrl}/catalogo?mesa=${encodeURIComponent(String(mesa))}`;
  const mesas = useMemo(() => Array.from({ length: count }, (_, i) => i + 1), [count]);

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { /* sem permissão de clipboard */ }
  };

  const printSheet = async () => {
    const qr = await loadQr();
    const cards = await Promise.all(mesas.map(async (m) => {
      const dataUrl: string = await qr.toDataURL(urlFor(m), { width: 320, margin: 2 });
      return `<div class="card"><div class="mesa">MESA ${m}</div><img src="${dataUrl}"/><div class="hint">Aponte a câmera do celular<br/>e faça seu pedido</div></div>`;
    }));
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>QR das mesas</title><style>
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

  const comandaTotal = (c: HeldSale) =>
    (c.items ?? []).reduce((sum, it: any) => sum + Number(it.unit_price ?? 0) * Number(it.quantity ?? 0), 0);

  return (
    <PageWrapper>
      <div className="space-y-5">
        <SectionTitle
          title="Comandas e Cardápio QR"
          description="Cada mesa tem um QR Code: o cliente abre o cardápio no celular, pede, e o pedido vira uma comanda aberta no PDV."
        />

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-800">QR Code das mesas</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Input label="Quantidade de mesas" type="number" min={1} max={60} value={tables} onChange={(e) => setTables(e.target.value)} />
            </div>
            <Button variant="primary" iconLeft={<Printer size={14} />} onClick={printSheet} disabled={!baseUrl}>Imprimir QR das mesas</Button>
            <Button variant="outline" iconLeft={copied ? <Check size={14} /> : <Copy size={14} />} onClick={() => copy(`${baseUrl}/catalogo`)} disabled={!baseUrl}>
              {copied ? "Link copiado" : "Copiar link do cardápio"}
            </Button>
            <a href={baseUrl ? `${baseUrl}/catalogo` : "#"} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
              <ExternalLink size={13} /> Abrir cardápio
            </a>
          </div>
          <p className="text-xs text-slate-500">
            Dica: balcão e delivery podem usar o QR do "Cardápio sem mesa" (link acima). Pedidos por mesa somam na mesma comanda enquanto ela estiver aberta.
          </p>
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

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Comandas abertas ({comandas.length})</h3>
            <span className="text-[11px] text-slate-500">Atualiza sozinho • feche a conta no PDV → Comandas</span>
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
          <a href="/admin/pdv" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800">
            <QrCode size={13} /> Abrir PDV para fechar comandas
          </a>
        </section>
      </div>
    </PageWrapper>
  );
}
