import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Expand, MessageCircle, Ruler, X } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useStore } from "../../StoreLayout";
import { buildStorePath, parseProductIdFromRoute, resolveStoreSlug } from "../../store-routing";
import { glassMeasureLabel, glassMeasurements } from "../../../../../shared/glassCatalog";
import { pieceSummary } from "../../../../lib/glassPieces";
import PieceConfigurator from "./PieceConfigurator";
import { useGlassProject } from "./project";
import { VitraProductCard, vitraHidePrices, vitraImage, vitraMoney } from "./ThemeParts";

export default function StoreProduct() {
  const { slug: routeSlug, productId } = useParams();
  const { tenant, products, categories, addToCart, openCart } = useStore();
  const slug = resolveStoreSlug(routeSlug), path = (suffix = "") => buildStorePath(slug, suffix);
  const product = products.find(p => p.id === parseProductIdFromRoute(productId) && p.is_active);
  const project = useGlassProject(slug);
  const [active, setActive] = useState(0), [zoom, setZoom] = useState(false), [added, setAdded] = useState(false), [error, setError] = useState("");
  const [tab, setTab] = useState("description"), [contactHref, setContactHref] = useState("");
  useEffect(() => { setActive(0); setAdded(false); setError(""); setZoom(false); setContactHref(""); setTab("description"); }, [productId]);
  useEffect(() => { if (!zoom) return; const close = (e: KeyboardEvent) => { if (e.key === "Escape") setZoom(false); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [zoom]);
  if (!product) return <main className="vitra-root vitra-project-empty"><h1>Produto não encontrado</h1><Link className="vitra-btn-primary" to={path("/catalogo")}>Voltar ao catálogo</Link></main>;
  const images = [...new Set([product.image_url, ...(Array.isArray(product.images) ? product.images : [])].filter((i): i is string => typeof i === "string" && !!i))];
  const image = images[active] || vitraImage(product);
  const category = categories.find(c => c.id === product.category_id)?.name;
  const hidden = vitraHidePrices(tenant) || product.price_hidden || product.hide_price_on_site;
  const quoteEnabled = tenant.policies?.storefront?.glass_quote_enabled === true;
  const measuredSale = ["m2", "linear"].includes(product.sale_unit || "") || glassMeasurements(product).enabled;
  const sections = [{ id: "description", title: "Descrição", text: product.description }, { id: "specifications", title: "Especificações", text: product.storefront_details?.specifications }, { id: "delivery", title: "Entrega e instalação", text: product.storefront_details?.delivery_installation }].filter(s => s.text?.trim());
  const currentSection = sections.find(s => s.id === tab) || sections[0];
  const rate = Number(product.sale_unit && product.sale_unit !== "unidade" ? product.price_per_measure : product.discount_price ?? product.price);
  const related = products.filter(p => p.is_active && p.id !== product.id).sort((a,b) => Number(b.category_id === product.category_id) - Number(a.category_id === product.category_id)).slice(0,4);
  return <main className="vitra-root vitra-product-page">
    <StoreSEO title={`${product.name} | ${tenant.name}`} description={product.description || `Configure as medidas de ${product.name} e solicite um orçamento.`} image={image || ""} siteName={tenant.name}/>
    <div className="vitra-container"><Link className="vitra-back" to={path("/catalogo")}><ArrowLeft size={14}/>Catálogo{category ? ` / ${category}` : ""}</Link>
      <div className="vitra-product-layout"><div className="vitra-product-gallery"><button className="vitra-gallery-main" type="button" disabled={!image} onClick={() => setZoom(true)} aria-label={`Ampliar foto de ${product.name}`}>{image ? <img src={image} alt={product.name}/> : <Ruler size={58}/>}<span><Expand size={15}/>Ver imagem</span></button>
        {images.length > 1 && <div className="vitra-gallery-thumbs" aria-label="Fotos do produto">{images.map((src,i) => <button type="button" aria-label={`Foto ${i + 1} de ${product.name}`} aria-pressed={active === i} key={src} onClick={() => setActive(i)}><img src={src} alt=""/></button>)}</div>}
      </div><div className="vitra-product-config"><span className="vitra-eyebrow">{category || "Catálogo da loja"}</span><h1>{product.name}</h1>{quoteEnabled && <p className="vitra-product-lead">Selecione as opções deste produto e adicione ao seu projeto.</p>}<div className="vitra-product-reference"><strong>{hidden || !rate || rate < 0 ? "Sob consulta" : vitraMoney(rate)}</strong>{!hidden && rate > 0 && <span>por {glassMeasureLabel(product)}</span>}</div>
        <PieceConfigurator key={product.id} item={{ ...product, price_hidden: !!hidden }} itemKey={`product:${product.id}`} allowNotes={quoteEnabled || measuredSale || !!hidden} label={quoteEnabled ? "Adicionar ao projeto" : measuredSale || hidden ? "Preparar consulta" : "Adicionar ao carrinho"} onAdd={piece => {
          setError("");
          if (quoteEnabled) {
            if (project.pieces.length >= 30) { setError("Seu projeto já tem 30 modelos de peça. Envie esta solicitação antes de iniciar outra."); return; }
            project.save([...project.pieces, piece]); setAdded(true);
          } else if (measuredSale || hidden) {
            if (!tenant.whatsapp) { setError("Entre em contato com a loja para consultar este produto."); return; }
            const message = `Olá! Tenho interesse em ${product.name}. Quantidade: ${piece.quantity}. ${piece.spec ? pieceSummary(piece.spec) : ""} ${Object.entries(piece.selected_options).map(([k,v]) => `${k}: ${v}`).join(" · ")}`;
            setContactHref(`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`);
          } else {
            const options = { ...piece.selected_options, ...(piece.spec ? { "Medidas informadas": pieceSummary(piece.spec) } : {}) };
            for (let n = 0; n < piece.quantity; n++) addToCart(product, options);
            setAdded(true);
          }
        }}/>
        {error && <p role="alert" className="vitra-form-error">{error}</p>}
        {contactHref && <a className="vitra-btn-secondary" href={contactHref} target="_blank" rel="noreferrer"><MessageCircle size={16}/>Continuar consulta no WhatsApp</a>}
        {added && <div className="vitra-product-added" role="status"><CheckCircle2 size={19}/><div><b>{quoteEnabled ? "Peça adicionada ao seu projeto." : "Produto adicionado ao carrinho."}</b>{quoteEnabled ? <Link to={path("/orcamento")} className="vitra-textlink">Ver projeto e enviar orçamento <ArrowRight size={15}/></Link> : <button type="button" className="vitra-textlink" onClick={openCart}>Ver carrinho <ArrowRight size={15}/></button>}</div></div>}
      </div></div>
      {currentSection && <section className="vitra-product-content"><div role="tablist" aria-label="Informações do produto">{sections.map(s => <button role="tab" id={`vitra-tab-${s.id}`} type="button" key={s.id} aria-selected={currentSection.id === s.id} aria-controls="vitra-product-panel" onClick={() => setTab(s.id)}>{s.title}</button>)}</div><div role="tabpanel" id="vitra-product-panel" aria-labelledby={`vitra-tab-${currentSection.id}`} tabIndex={0}><p>{currentSection.text}</p></div></section>}
      {related.length > 0 && <section className="vitra-section"><div className="vitra-sec-head"><div><span className="vitra-eyebrow">Complete seu projeto</span><h2>Outras possibilidades</h2></div><Link to={path("/catalogo")} className="vitra-textlink">Catálogo completo <ArrowRight size={15}/></Link></div><div className="vitra-grid">{related.map(p => <VitraProductCard key={p.id} product={p} category={categories.find(c => c.id === p.category_id)?.name} path={path} hidePrices={vitraHidePrices(tenant)} quoteEnabled={quoteEnabled}/>)}</div></section>}
    </div>
    {zoom && image && <div className="vitra-image-lightbox" role="dialog" aria-modal="true" aria-label="Imagem ampliada" onClick={() => setZoom(false)}><button type="button" autoFocus aria-label="Fechar imagem ampliada" onClick={() => setZoom(false)}><X size={25}/></button><img src={image} alt={product.name}/></div>}
  </main>;
}
