import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Cog, MessageCircle, PackageCheck, SearchCheck, ShieldCheck, Wrench } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useShop, waLink } from "./lib";
import { SkuRow, TableHead } from "./parts";

const hiddenLabel = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" } as const;

function Gauge({ a, b, c }: { a: number; b: number; c: number }) {
  const ticks = Array.from({ length: 21 }, (_, i) => i);
  return (
    <div className="tg-panel tg-gauge" aria-hidden="true">
      <svg viewBox="0 0 240 150">
        <path d="M30 130 A90 90 0 0 1 210 130" fill="none" stroke="#2f3d50" strokeWidth="14" />
        <path d="M30 130 A90 90 0 0 1 150 45" fill="none" stroke="var(--tg-accent)" strokeWidth="14" />
        {ticks.map((i) => {
          const ang = Math.PI + (i / 20) * Math.PI;
          const r1 = 70;
          const r2 = i % 5 === 0 ? 58 : 63;
          return <line key={i} x1={120 + r1 * Math.cos(ang)} y1={130 + r1 * Math.sin(ang)} x2={120 + r2 * Math.cos(ang)} y2={130 + r2 * Math.sin(ang)} stroke="#a3b3c6" strokeWidth={i % 5 === 0 ? 2 : 1} />;
        })}
        <line x1="120" y1="130" x2="160" y2="82" stroke="#f1f5f9" strokeWidth="3" strokeLinecap="round" />
        <circle cx="120" cy="130" r="8" fill="var(--tg-accent)" />
        <text x="120" y="112" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#a3b3c6" letterSpacing="2">ESTOQUE</text>
      </svg>
      <div className="tg-gauge-stats">
        <div><b>{a}</b><small>Peças</small></div>
        <div><b>{b}</b><small>Setores</small></div>
        <div><b>{c}</b><small>Destaques</small></div>
      </div>
    </div>
  );
}

export default function StoreFront() {
  const { tenant, categories, active, sf, path, vars } = useShop();
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const highlighted = active.filter((p) => p.is_featured);
  const featured = (highlighted.length ? highlighted : active).slice(0, 8);
  const sectors = categories.filter((c) => active.some((p) => p.category_id === c.id));
  const wa = waLink(tenant, "Olá! Preciso confirmar a compatibilidade de uma peça.");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const base = path("/catalogo");
    navigate(term.trim() ? `${base}${base.includes("?") ? "&" : "?"}q=${encodeURIComponent(term.trim())}` : base);
  };
  const words = (tenant.hero_tagline || "A próxima peça do seu projeto.").split(" ");
  const last = words.length > 2 ? words.pop() : null;
  return (
    <main className="tg-scope tg-page" style={vars}>
      <StoreSEO title={`${tenant.name} | ${sf.segment_label || "Autopeças & Acessórios"}`} description={tenant.hero_tagline || "Peças, acessórios e ferramentas com busca por código e SKU."} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <section className={`tg-hero ${tenant.banner_url ? "tg-has-banner" : ""}`} style={tenant.banner_url ? { backgroundImage: `linear-gradient(rgba(16,21,28,.88), rgba(16,21,28,.96)), url(${tenant.banner_url})` } : undefined}>
        <div className="tg-wrap tg-hero-grid">
          <div>
            <span className="tg-kicker">{sf.segment_label || "Autopeças & Acessórios"}</span>
            <h1 className="tg-h">
              {words.join(" ")}
              {last && <> <em>{last}</em></>}
            </h1>
            <p className="tg-sub">Peças, acessórios e ferramentas. Confira a compatibilidade com a equipe antes de comprar.</p>
            <form className="tg-bigsearch" role="search" onSubmit={submit}>
              <label htmlFor="tg-home-q" style={hiddenLabel}>Buscar peça, código ou SKU</label>
              <input id="tg-home-q" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Peça, código ou SKU" autoComplete="off" />
              <button className="tg-btn" type="submit">{sf.hero_button_label || "Buscar"}</button>
            </form>
            {sectors.length > 0 && (
              <div className="tg-chips">
                <span>Atalhos</span>
                {sectors.slice(0, 5).map((c) => (
                  <Link key={c.id} className="tg-chip" to={path(`/catalogo?cat=${c.id}`)}>{c.name}</Link>
                ))}
              </div>
            )}
          </div>
          <Gauge a={active.length} b={sectors.length} c={highlighted.length} />
        </div>
      </section>
      <section className="tg-compat" aria-label="Compatibilidade">
        <div className="tg-wrap">
          <div className="tg-compat-item"><SearchCheck size={26} /><div><b>Confirme a compatibilidade</b><span>Informe modelo e ano do veículo e a equipe valida a peça.</span></div></div>
          <div className="tg-compat-item"><PackageCheck size={26} /><div><b>Código e SKU na lista</b><span>Todo item exibe o código para você comparar com a peça original.</span></div></div>
          <div className="tg-compat-item"><ShieldCheck size={26} /><div><b>Atendimento técnico</b><span>Dúvidas de aplicação resolvidas antes do pedido.</span></div></div>
        </div>
      </section>
      {sectors.length > 0 && (
        <section className="tg-section">
          <div className="tg-wrap">
            <div className="tg-section-head">
              <div>
                <span className="tg-kicker">Mapa da loja</span>
                <h2 className="tg-h">{sf.home_categories_title || "Setores da garagem"}</h2>
              </div>
              <Link className="tg-link" to={path("/catalogo")}>Ver tudo <ArrowRight size={15} /></Link>
            </div>
            <div className="tg-sectors">
              {sectors.slice(0, 8).map((c, i) => (
                <Link key={c.id} className="tg-sector-tile" to={path(`/catalogo?cat=${c.id}`)}>
                  <span className="n">SET-{String(i + 1).padStart(2, "0")}</span>
                  <Wrench className="bg" strokeWidth={1.2} />
                  <div>
                    <b>{c.name}</b>
                    <small>{active.filter((p) => p.category_id === c.id).length} itens</small>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
      <section className="tg-section">
        <div className="tg-wrap">
          <div className="tg-section-head">
            <div>
              <span className="tg-kicker">Prontas para o pedido</span>
              <h2 className="tg-h">{sf.home_featured_title || "Seleção da garagem"}</h2>
            </div>
            <Link className="tg-link" to={path("/catalogo")}>Catálogo completo <ArrowRight size={15} /></Link>
          </div>
          {featured.length ? (
            <div className="tg-table" role="table" aria-label="Peças em destaque">
              <TableHead />
              {featured.map((p) => <SkuRow key={p.id} product={p} />)}
            </div>
          ) : (
            <div className="tg-empty">
              <Cog size={36} />
              <h2 className="tg-h">Estoque em atualização</h2>
              <p>Ainda não há peças publicadas. Fale com a equipe pelo WhatsApp.</p>
            </div>
          )}
        </div>
      </section>
      <div className="tg-wrap">
        <section className="tg-panel tg-cta">
          <div>
            <h2 className="tg-h">Não achou a peça?</h2>
            <p>Mande o modelo, o ano e o código que a equipe procura para você.</p>
          </div>
          {wa ? (
            <a className="tg-btn" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={18} />Chamar no WhatsApp</a>
          ) : (
            <Link className="tg-btn" to={path("/sobre")}>Falar com a loja</Link>
          )}
        </section>
      </div>
    </main>
  );
}
