import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ClipboardList, FileText, Hammer, MessageCircle, Ruler } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useShop, waLink } from "./lib";
import { Sidebar, ToolCard } from "./parts";

export default function StoreFront() {
  const { tenant, categories, active, sf, path, vars } = useShop();
  const navigate = useNavigate();
  const highlighted = active.filter((p) => p.is_featured);
  const featured = (highlighted.length ? highlighted : active).slice(0, 10);
  const depts = categories.filter((c) => active.some((p) => p.category_id === c.id));
  const wa = waLink(tenant, "Olá! Gostaria de um orçamento de materiais.");
  const goCat = (id: string) => navigate(path(id ? `/catalogo?cat=${id}` : "/catalogo"));
  return (
    <main className="op-scope op-page" style={vars}>
      <StoreSEO title={`${tenant.name} | ${sf.segment_label || "Ferramentas & Construção"}`} description={tenant.hero_tagline || "Ferramentas, materiais e acessórios para tirar projetos do papel."} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="op-wrap">
        <div className="op-shell">
          <Sidebar selected="" onSelect={goCat} />
          <div style={{ minWidth: 0 }}>
            <section className="op-hero">
              <div className="op-hero-copy">
                <span className="op-tag">{sf.segment_label || "Ferramentas & Construção"}</span>
                <h1 className="op-h">{tenant.hero_tagline || "Seu trabalho merece a ferramenta certa."}</h1>
                <p>Ferramentas, materiais e acessórios para tirar projetos do papel.</p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Link className="op-btn dark" to={path("/catalogo")}>{sf.hero_button_label || "Ver catálogo"} <ArrowRight size={16} /></Link>
                  {wa && <a className="op-btn light" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={16} />Pedir orçamento</a>}
                </div>
              </div>
              <div className="op-hero-art" style={tenant.banner_url ? { backgroundImage: `linear-gradient(rgba(28,42,52,.35), rgba(28,42,52,.6)), url(${tenant.banner_url})` } : undefined} aria-hidden="true">
                <span className="op-big">{String(active.length).padStart(2, "0")}</span>
                <small>itens no catálogo</small>
                <span className="op-stripe-corner" />
              </div>
            </section>
            <div className="op-perks">
              <div className="op-perk"><ClipboardList /><div><b>Lista de materiais</b><span>Reúna tudo o que o projeto precisa em um só pedido.</span></div></div>
              <div className="op-perk"><FileText /><div><b>Ficha técnica</b><span>Referência, departamento e disponibilidade em cada item.</span></div></div>
              <div className="op-perk"><Ruler /><div><b>Orientação da equipe</b><span>Dúvida de medida ou aplicação? Chame a loja.</span></div></div>
            </div>
            {depts.length > 0 && (
              <>
                <div className="op-sec-head"><h2 className="op-h">{sf.home_categories_title || "Departamentos da oficina"}</h2></div>
                <div className="op-depts">
                  {depts.slice(0, 9).map((c, i) => (
                    <Link key={c.id} className="op-dept" to={path(`/catalogo?cat=${c.id}`)}>
                      <i>{String(i + 1).padStart(2, "0")}</i><span>{c.name}</span><small>{active.filter((p) => p.category_id === c.id).length} itens</small>
                    </Link>
                  ))}
                </div>
              </>
            )}
            <div className="op-sec-head">
              <h2 className="op-h">{sf.home_featured_title || "Prontos para o trabalho"}</h2>
              <Link className="op-link" to={path("/catalogo")}>Ver catálogo completo <ArrowRight size={15} /></Link>
            </div>
            {featured.length ? (
              <div className="op-grid cols5">{featured.map((p) => <ToolCard key={p.id} product={p} />)}</div>
            ) : (
              <div className="op-empty"><Hammer size={38} /><h2 className="op-h">Estoque em atualização</h2><p>Ainda não há itens publicados nesta loja.</p></div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
