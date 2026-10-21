import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, Copy, Loader2, Pencil, Ruler, Search, Send, Trash2 } from "lucide-react";
import { useStore } from "../../StoreLayout";
import { buildStorePath, resolveStoreSlug } from "../../store-routing";
import StoreSEO from "../../../../components/store/StoreSEO";
import GlassDrawing from "../../../../components/GlassDrawing";
import { pieceSummary } from "../../../../lib/glassPieces";
import { glassPrice, type GlassCatalogItem } from "../../../../../shared/glassCatalog";
import PieceConfigurator from "./PieceConfigurator";
import { useGlassProject, type ProjectPiece } from "./project";
import { vitraImage, vitraMoney } from "./ThemeParts";

type Entry = GlassCatalogItem & { key: string; category_id?: number };
export default function QuoteBuilder() {
  const { tenant, categories } = useStore();
  const { slug: routeSlug } = useParams();
  const slug = resolveStoreSlug(routeSlug), path = (suffix = "") => buildStorePath(slug, suffix);
  const [params] = useSearchParams();
  const project = useGlassProject(slug);
  const [catalog, setCatalog] = useState<Entry[] | null>(null), [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0), [selected, setSelected] = useState(""), [editing, setEditing] = useState<ProjectPiece | undefined>();
  const [query, setQuery] = useState(""), [message, setMessage] = useState("");
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "" });
  const [notes, setNotes] = useState(""), [installation, setInstallation] = useState(false), [sending, setSending] = useState(false), [error, setError] = useState("");
  const [done, setDone] = useState<{ number: number; total: number | null } | null>(null);
  const sendingRef = useRef(false), configurator = useRef<HTMLDivElement>(null), list = useRef<HTMLElement>(null);
  useEffect(() => {
    const abort = new AbortController(); setLoadError(""); setCatalog(null);
    fetch(`/api/public/store/${encodeURIComponent(slug)}/quote-catalog`, { signal: abort.signal }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Não foi possível carregar o catálogo."); return d; }).then(d => {
      const entries: Entry[] = [...(d.products || []).map((p: GlassCatalogItem) => ({ ...p, key: `product:${p.id}` })), ...(d.services || []).map((s: GlassCatalogItem) => ({ ...s, key: `service:${s.id}` }))];
      setCatalog(entries);
    }).catch(e => { if (!abort.signal.aborted) setLoadError(e.message); });
    return () => abort.abort();
  }, [slug, retry]);
  useEffect(() => { if (catalog && params.get("produto")) setSelected(`product:${params.get("produto")}`); }, [catalog, params]);
  const item = catalog?.find(p => p.key === selected);
  const shown = catalog?.filter(p => `${p.name} ${p.description || ""}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))) || [];
  const lines = useMemo(() => project.pieces.map(piece => {
    const product = catalog?.find(p => p.key === piece.key);
    const price = product ? glassPrice(product, piece.spec?.width_mm || 0, piece.spec?.height_mm || 0, piece.quantity) : null;
    const known = price?.known && (!!piece.spec || product?.sale_unit === "unidade");
    return { piece, product, price, known };
  }), [catalog, project.pieces]);
  const allKnown = lines.length > 0 && lines.every(l => l.known);
  const total = lines.reduce((sum, l) => sum + (l.known ? l.price!.total : 0), 0);
  const choose = (key: string, edit?: ProjectPiece) => { setSelected(key); setEditing(edit); setMessage(""); setTimeout(() => configurator.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); };
  const add = (piece: ProjectPiece) => {
    if (!editing && project.pieces.length >= 30) { setMessage("Seu projeto já tem 30 modelos de peça. Envie esta solicitação antes de iniciar outra."); return; }
    project.save(editing ? project.pieces.map(p => p.id === editing.id ? piece : p) : [...project.pieces, piece]);
    setSelected(""); setEditing(undefined); setMessage(editing ? "Peça atualizada no projeto." : "Peça adicionada. Você pode incluir outro produto ou enviar o projeto.");
    list.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const send = async (event: React.FormEvent) => {
    event.preventDefault(); if (sendingRef.current) return; setError("");
    if (!lines.length || lines.some(l => !l.product)) return setError("Revise os itens indisponíveis antes de enviar o projeto.");
    if (!customer.name.trim() || customer.phone.replace(/\D/g, "").length < 10) return setError("Informe seu nome e WhatsApp com DDD.");
    sendingRef.current = true; setSending(true);
    try {
      const r = await fetch(`/api/public/store/${encodeURIComponent(slug)}/quote-request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_id: project.request_id, customer, notes, installation, pieces: project.pieces.map(p => ({ [p.key.startsWith("product:") ? "product_id" : "service_id"]: Number(p.key.split(":")[1]), quantity: p.quantity, spec: p.spec, measure_later: !p.spec, selected_options: p.selected_options })) }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || "Não foi possível enviar o projeto.");
      setDone(data); project.clear();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha de conexão. Tente novamente; seu projeto continua salvo."); }
    finally { sendingRef.current = false; setSending(false); }
  };
  const whatsapp = tenant.whatsapp?.replace(/\D/g, "");
  if (done) return <main className="vitra-root vitra-project"><div className="vitra-project-success"><CheckCircle2 size={48}/><span className="vitra-eyebrow">Projeto recebido</span><h1>Vamos dar forma à sua ideia.</h1><p>Sua solicitação <strong>nº {String(done.number).padStart(6, "0")}</strong> foi enviada para {tenant.name}. A equipe vai conferir as peças e entrar em contato para preparar o orçamento.</p>{done.total != null && <p>Estimativa inicial: <strong>{vitraMoney(done.total)}</strong></p>}<small>O envio não confirma compra, pagamento ou início da produção.</small><div className="vitra-hero-actions">{whatsapp && <a className="vitra-btn-primary" target="_blank" rel="noreferrer" href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Olá! Enviei o projeto nº ${String(done.number).padStart(6, "0")} pelo catálogo e gostaria de acompanhar o orçamento.`)}`}>Conversar sobre meu projeto <ArrowRight size={16}/></a>}<Link className="vitra-btn-secondary" to={path("/catalogo")}>Voltar ao catálogo</Link></div></div></main>;
  return <main className="vitra-root vitra-project">
    <StoreSEO title={`Orçamento sob medida | ${tenant.name}`} description="Escolha as peças do catálogo, informe as medidas e solicite seu orçamento." siteName={tenant.name}/>
    <section className="vitra-project-intro vitra-container"><Link className="vitra-back" to={path("/catalogo")}><ArrowLeft size={14}/>Voltar ao catálogo</Link><div className="vitra-eyebrow">Seu espaço, suas medidas</div><h1>Um projeto feito<br/><em>para você.</em></h1><p>Escolha os produtos da loja, configure cada peça e envie tudo em uma única solicitação.</p><ol className="vitra-project-steps"><li><b>01</b> Escolha as peças</li><li><b>02</b> Informe as medidas</li><li><b>03</b> Receba o orçamento</li></ol></section>
    <div className="vitra-container vitra-project-layout">
      <div className="vitra-project-main">
        <section className="vitra-project-catalog"><div className="vitra-sec-head"><div><div className="vitra-eyebrow">01 · Catálogo da loja</div><h2>O que vamos criar?</h2></div></div>
          <label className="vitra-project-search"><Search size={17}/><input aria-label="Buscar no catálogo do projeto" value={query} onChange={e => setQuery(e.target.value)} placeholder="Busque box, espelhos, portas…"/></label>
          {loadError ? <div role="alert" className="vitra-form-error">{loadError}<button type="button" onClick={() => setRetry(n => n + 1)}>Tentar novamente</button></div> : catalog === null ? <p role="status"><Loader2 className="animate-spin"/>Carregando catálogo…</p> : !catalog.length ? <p>A loja ainda está preparando o catálogo de projetos. Entre em contato para solicitar seu orçamento.</p> : <div className="vitra-project-picker">{shown.map(p => <button disabled={sending} className={selected === p.key ? "selected" : ""} type="button" key={p.key} onClick={() => choose(p.key)}>{vitraImage(p) ? <img src={vitraImage(p)!} alt=""/> : <span className="vitra-picker-placeholder"><Ruler size={26}/></span>}<span><small>{p.key.startsWith("service:") ? "Serviço" : categories.find(c => c.id === p.category_id)?.name || "Produto sob medida"}</small><b>{p.name}</b><em>Configurar peça <ArrowRight size={12}/></em></span></button>)}{!shown.length && <p>Nenhum item encontrado. Tente outro termo.</p>}</div>}
        </section>
        {item && <section ref={configurator} className="vitra-config-panel"><div className="vitra-config-product"><div><small>02 · Configure sua peça</small><h2>{item.name}</h2></div><button disabled={sending} type="button" onClick={() => { setSelected(""); setEditing(undefined); }}>Cancelar</button></div><PieceConfigurator key={`${selected}:${editing?.id || "new"}`} item={item} itemKey={selected} initial={editing} onAdd={add} label={editing ? "Salvar alterações da peça" : "Adicionar ao projeto"}/></section>}
        {message && <p role="status" className="vitra-project-message">{message}</p>}
        <section ref={list} className="vitra-project-pieces"><div className="vitra-sec-head"><div><div className="vitra-eyebrow">Sua seleção</div><h2>Peças do projeto <span>({project.pieces.length})</span></h2></div><Link className="vitra-textlink" to={path("/catalogo")}>Ver mais produtos <ArrowRight size={14}/></Link></div>
          {!lines.length ? <div className="vitra-project-empty"><ClipboardList size={32}/><h3>Seu projeto começa com uma peça.</h3><p>Escolha um produto acima. Você pode adicionar medidas diferentes para o mesmo modelo.</p></div> : <div className="vitra-piece-list">{lines.map(({ piece, product, price, known }, i) => <article key={piece.id} className="vitra-piece-row"><div className="vitra-piece-drawing">{piece.spec ? <GlassDrawing spec={piece.spec}/> : <Ruler size={32}/>}</div><div className="vitra-piece-info"><small>PEÇA {String(i + 1).padStart(2, "0")} · {piece.quantity} {piece.quantity === 1 ? "unidade" : "unidades"}</small><h3>{product?.name || "Item indisponível no catálogo"}</h3><p>{piece.spec ? pieceSummary(piece.spec) : "Medidas a conferir com a loja"}</p><p>{Object.entries(piece.selected_options).map(([k,v]) => `${k}: ${v}`).join(" · ")}</p><strong>{known ? vitraMoney(price!.total) : "Sob consulta"}</strong><div className="vitra-piece-actions"><button type="button" disabled={!product || sending} onClick={() => choose(piece.key, piece)}><Pencil size={13}/>Editar</button><button type="button" disabled={sending || project.pieces.length >= 30} onClick={() => project.save([...project.pieces, { ...piece, id: crypto.randomUUID() }])}><Copy size={13}/>Duplicar</button><button type="button" disabled={sending} onClick={() => project.save(project.pieces.filter(p => p.id !== piece.id))}><Trash2 size={13}/>Remover</button></div></div></article>)}</div>}
        </section>
      </div>
      <aside className="vitra-project-sidebar"><div className="vitra-project-summary"><div className="vitra-eyebrow">03 · Envie para a loja</div><h2>Seu orçamento<br/>começa aqui.</h2><div className="vitra-summary-line"><span>Peças na solicitação</span><b>{project.pieces.reduce((s,p) => s + p.quantity, 0)}</b></div><div className="vitra-summary-total"><small>{allKnown ? "Estimativa dos itens" : "Projeto sob consulta"}</small><strong>{allKnown ? vitraMoney(total) : "Vamos conversar"}</strong><p>O valor final depende da conferência das medidas, acabamentos e instalação.</p></div><form onSubmit={send} className="vitra-contact-form"><fieldset disabled={sending || !project.pieces.length}><label>Seu nome<input required autoComplete="name" maxLength={120} value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })}/></label><label>WhatsApp com DDD<input required type="tel" autoComplete="tel" maxLength={30} placeholder="(11) 99999-9999" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })}/></label><label>E-mail <small>(opcional)</small><input type="email" autoComplete="email" maxLength={120} value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })}/></label><label>Local do projeto <small>(opcional)</small><input autoComplete="street-address" maxLength={350} placeholder="Bairro, cidade ou endereço" value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })}/></label><label className="vitra-checkline"><input type="checkbox" checked={installation} onChange={e => setInstallation(e.target.checked)}/>Preciso de instalação ou visita para medir</label><label>Conte mais sobre o projeto<textarea rows={3} maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ambiente, prazo desejado e outros detalhes…"/></label></fieldset>{error && <p className="vitra-form-error" role="alert">{error}</p>}<button type="submit" disabled={sending || !project.pieces.length || lines.some(l => !l.product)} className="vitra-btn-primary">{sending ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}Enviar projeto para orçamento</button><p className="vitra-hint">Sua solicitação será analisada pela loja. Nenhum pagamento é realizado nesta etapa.</p></form></div></aside>
    </div>
  </main>;
}
