import { ArrowUpRight, Wine } from "lucide-react";
import { Link } from "react-router-dom";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useCatalog } from "./kit";
import { Empty, ProductCard, SearchField } from "./parts";
import { BRISA_HERO } from "./Hero";
import "./styles.css";

export default function StoreCatalog() {
  const c = useCatalog(16);
  const { tenant, sf, categories, active, hidden } = c;
  const current = categories.find((category) => category.id === c.cat);
  const title = current?.name || sf.catalog_title || "Uma boa escolha espera por você.";
  const description = sf.catalog_description || "Explore a nossa seleção de bebidas e encontre o sabor que combina com o seu momento.";
  return <div className="brs-page">
    <StoreSEO title={`${title} | ${tenant.name}`} description={description} image={tenant.banner_url || tenant.logo_url} siteName={tenant.name} url={typeof window !== "undefined" ? window.location.href : ""} />
    <header className="brs-catalog-hero brs-wrap"><div><span className="brs-kicker"><Wine size={13} /> A seleção da casa</span><h1>{title}</h1><p>{description}</p></div><div className="brs-catalog-photo"><img src={tenant.banner_url || sf.hero_slides?.[0]?.image || BRISA_HERO} alt="" /></div></header>
    <div className="brs-wrap brs-catalog-body"><div className="brs-filter"><div className="brs-filter-tools"><SearchField value={c.q} onChange={(value) => c.setParam("q", value)} placeholder="Busque seu próximo brinde" label="Buscar produtos" /><label className="brs-select"><span className="brs-sr">Ordenar por</span><select value={c.sort} onChange={(event) => c.setParam("sort", event.target.value === "destaques" ? null : event.target.value)}><option value="destaques">Destaques</option><option value="nome">Nome (A a Z)</option>{!hidden && <><option value="menor">Menor preço</option><option value="maior">Maior preço</option></>}</select></label></div><div className="brs-pills" role="group" aria-label="Categorias"><button type="button" aria-pressed={!c.cat} onClick={() => c.setParam("categoria", null)}>Tudo</button>{categories.map((category) => <button type="button" key={category.id} aria-pressed={c.cat === category.id} onClick={() => c.setParam("categoria", String(category.id))}>{category.name}</button>)}</div></div><div className="brs-catalog-count"><p role="status">{c.list.length} {c.list.length === 1 ? "boa escolha" : "boas escolhas"} por aqui</p><Link className="brs-text-link" to={c.path("/sobre")}>Conheça a adega <ArrowUpRight size={15} /></Link></div>{c.list.length ? <><div className="brs-grid brs-grid-cat">{c.shown.map((product) => <ProductCard key={product.id} product={product} />)}</div>{c.hasMore && <div className="brs-more"><button type="button" className="brs-btn brs-btn-ghost" onClick={c.more}>Descobrir mais produtos</button><span>Mostrando {c.shown.length} de {c.list.length}</span></div>}</> : <Empty title={active.length ? "Nada encontrado" : "Em breve por aqui"} text={active.length ? "Experimente outra busca ou categoria." : "Estamos preparando a nossa seleção de bons momentos."} onClear={active.length ? c.clear : undefined} />}</div>
  </div>;
}
