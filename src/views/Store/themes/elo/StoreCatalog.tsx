import { ArrowUpRight, Shirt } from "lucide-react";
import { Link } from "react-router-dom";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useCatalog } from "./kit";
import { Empty, ProductCard, SearchField } from "./parts";
import { ELO_HERO } from "./Hero";
import "./styles.css";

export default function StoreCatalog() {
  const c = useCatalog(16);
  const { tenant, sf, categories, active, hidden } = c;
  const current = categories.find((category) => category.id === c.cat);
  const title = current?.name || sf.catalog_title || "Encontre o seu próximo favorito.";
  const description = sf.catalog_description || "Peças para combinar com o seu ritmo, seus encontros e seu jeito de ser.";
  return <div className="els-page">
    <StoreSEO title={`${title} | ${tenant.name}`} description={description} image={tenant.banner_url || tenant.logo_url} siteName={tenant.name} url={typeof window !== "undefined" ? window.location.href : ""} />
    <header className="els-catalog-hero els-wrap"><div><span className="els-kicker">A coleção</span><h1>{title}</h1><p>{description}</p></div><div className="els-catalog-photo"><img src={tenant.banner_url || sf.hero_slides?.[0]?.image || ELO_HERO} alt="" /></div></header>
    <div className="els-wrap els-catalog-body"><div className="els-filter"><div className="els-filter-tools"><SearchField value={c.q} onChange={(value) => c.setParam("q", value)} placeholder="Buscar uma peça..." label="Buscar produtos" /><label className="els-select"><span className="els-sr">Ordenar por</span><select value={c.sort} onChange={(event) => c.setParam("sort", event.target.value === "destaques" ? null : event.target.value)}><option value="destaques">Destaques</option><option value="nome">Nome (A a Z)</option>{!hidden && <><option value="menor">Menor preço</option><option value="maior">Maior preço</option></>}</select></label></div><div className="els-pills" role="group" aria-label="Categorias"><button type="button" aria-pressed={!c.cat} onClick={() => c.setParam("categoria", null)}>Tudo</button>{categories.map((category) => <button type="button" key={category.id} aria-pressed={c.cat === category.id} onClick={() => c.setParam("categoria", String(category.id))}>{category.name}</button>)}</div></div><div className="els-catalog-count"><p role="status">{c.list.length} {c.list.length === 1 ? "peça" : "peças"} por aqui</p><Link className="els-text-link" to={c.path("/sobre")}>Sobre a marca <ArrowUpRight size={15} /></Link></div>{c.list.length ? <><div className="els-grid els-grid-cat">{c.shown.map((product) => <ProductCard key={product.id} product={product} />)}</div>{c.hasMore && <div className="els-more"><button type="button" className="els-btn els-btn-ghost" onClick={c.more}>Descobrir mais produtos</button><span>Mostrando {c.shown.length} de {c.list.length}</span></div>}</> : <Empty title={active.length ? "Nada encontrado" : "Em breve por aqui"} text={active.length ? "Experimente outra busca ou categoria." : "Uma nova seleção está chegando. Volte em breve."} onClear={active.length ? c.clear : undefined} />}</div>
  </div>;
}
