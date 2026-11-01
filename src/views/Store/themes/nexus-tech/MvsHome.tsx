import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Headset, Lightbulb, PackageCheck, ShieldCheck, Wrench, Zap } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { useStore } from "../../StoreLayout";
import { imageOf, useTheme, waLink } from "./lib";
import { Card } from "./parts";
import LaunchCarousel from "./LaunchCarousel";
import { MVS_ART, normalizeMvsText } from "./mvs";

export default function MvsHome() {
  const { tenant, products, categories } = useStore(), { path } = useTheme();
  const sf = tenant.policies?.storefront || {};
  const active = products.filter(product => product.is_active && product.type !== "internal");
  const cats = categories.map(category => ({ ...category, items: active.filter(product => product.category_id === category.id) })).filter(category => category.items.length);
  const lines = [/arandel|lampad|lumina/, /eletrica|tomada/, /camera|sensor/, /ferrament/].map(pattern => cats.find(category => pattern.test(normalizeMvsText(category.name))));
  const curated = [...new Map([...lines.filter(Boolean), ...cats].map(category => [category!.id, category!])).values()];
  const featured = active.filter(product => product.is_featured);
  const selection = (featured.length ? featured : [...new Map([...curated.map(category => category.items.find(product => imageOf(product)) || category.items[0]), ...active].map(product => [product.id, product])).values()]).slice(0, tenant.featured_limit || 8);
  const fresh = [...active].sort((a, b) => b.id - a.id).slice(0, 10);
  const illumination = curated.find(category => /arandel|lampad|lumina/.test(normalizeMvsText(category.name)));
  const tools = curated.find(category => /ferrament|eletrica/.test(normalizeMvsText(category.name)));
  const slides = sf.hero_slides?.some(slide => slide.image) ? sf.hero_slides : [
    { id: "mvs-home", image: tenant.banner_url || MVS_ART.home, mobile_image: !tenant.banner_url || tenant.banner_url === MVS_ART.home ? MVS_ART.mobile : undefined, title: tenant.hero_tagline || "Para a sua casa.\nPara a sua vida.", subtitle: "Iluminação, elétrica, segurança e utilidades para transformar o seu dia. Encontre o que precisa na MVS.", button_label: sf.hero_button_label || "Explore o catálogo", button_url: "/catalogo" },
    { id: "mvs-work", image: MVS_ART.work, title: "Do reparo à conexão.\nConte com a MVS.", subtitle: "Ferramentas, acessórios e boas escolhas para colocar suas ideias em prática.", button_label: "Encontre sua solução", button_url: tools ? `/catalogo?cat=${tools.id}` : "/catalogo" },
  ];
  return <main className="nx-page mvs-home">
    <StoreSEO title={`${tenant.name} | Soluções para a casa e o dia a dia`} description="Conheça o catálogo da MVS Soluções: iluminação, elétrica, segurança, ferramentas e utilidades." image={tenant.banner_url || MVS_ART.home} siteName={tenant.name}/>
    <h1 className="nx-sr">MVS Soluções: iluminação, elétrica e utilidades para o seu dia.</h1>
    <div className="mvs-campaign"><span className="mvs-campaign-label">MVS SOLUÇÕES / ESCOLHAS QUE FACILITAM</span><HeroSlider slides={slides} autoplaySeconds={sf.hero_autoplay_seconds ?? 7} resolveUrl={url => url.startsWith("/") ? path(url) : url} layout="banner" className="mvs-slider" fallback={null} animate={false} pauseControl/><span className="mvs-campaign-signature">SUA CASA. SEU PROJETO. SUA MVS.</span></div>
    <section className="mvs-benefits" aria-label="Por que escolher a MVS"><div className="nx-wrap"><div><Lightbulb size={25}/><span><strong>Soluções para o seu dia</strong>Da iluminação aos pequenos reparos.</span></div><div><PackageCheck size={25}/><span><strong>Escolha do seu jeito</strong>Confira fotos, opções e detalhes.</span></div><div><Headset size={25}/><span><strong>Atendimento próximo</strong>Converse com a equipe da MVS.</span></div></div></section>
    {selection.length > 0 && <section className="nx-wrap nx-sec mvs-selection"><header className="nx-sec-h nx-sec-h-row"><div><p className="nx-kicker">SELEÇÃO MVS</p><h2>{sf.home_featured_title || "Boas escolhas começam aqui."}</h2></div><Link className="mvs-text-link" to={path("/catalogo")}>Catálogo completo<ArrowUpRight size={18}/></Link></header><div className="nx-grid">{selection.map(product => <Card key={product.id} product={product}/>)}</div></section>}
    {curated.length > 0 && <section className="nx-wrap nx-sec"><header className="nx-sec-h nx-sec-h-row"><div><p className="nx-kicker">ENCONTRE O QUE PRECISA</p><h2>{sf.home_categories_title || "Um mundo de soluções."}</h2></div><Link className="mvs-text-link" to={path("/catalogo")}>Todas as categorias<ArrowRight size={16}/></Link></header><div className="mvs-category-grid">{curated.slice(0, 8).map((category, index) => { const image = category.cover_url || imageOf(category.items.find(product => imageOf(product))); return <Link key={category.id} to={path(`/catalogo?cat=${category.id}`)}><span className="mvs-category-photo">{image ? <img src={image} alt="" loading="lazy"/> : <Zap size={30}/>}</span><div><small>0{index + 1} / {category.items.length} itens</small><h3>{category.name}</h3></div><ArrowUpRight size={19}/></Link>; })}</div></section>}
    <section className="nx-wrap nx-sec mvs-inspiration"><div className="mvs-editorial"><div className="mvs-editorial-photo"><img src={MVS_ART.home} alt="Iluminação de parede valorizando a entrada de uma casa, ambiente ilustrativo" loading="lazy"/><span>INSPIRAÇÃO PARA O SEU AMBIENTE</span></div><div className="mvs-editorial-copy"><span className="mvs-eyebrow">A DIFERENÇA ESTÁ NOS DETALHES</span><h2>Uma nova luz.<br/>Outras possibilidades.</h2><p>O ponto de luz certo, um acessório prático, o detalhe que faltava. Descubra escolhas que deixam a casa e a rotina mais do seu jeito.</p><Link className="mvs-solid-button" to={path(illumination ? `/catalogo?cat=${illumination.id}` : "/catalogo")}>Explore a iluminação<ArrowUpRight size={18}/></Link><div className="mvs-editorial-tags"><span><Lightbulb size={15}/>Iluminação</span><span><ShieldCheck size={15}/>Segurança</span><span><Wrench size={15}/>Praticidade</span></div></div></div></section>
    {fresh.length > 0 && <section className="nx-wrap nx-sec"><header className="nx-sec-h nx-sec-h-row"><div><p className="nx-kicker">NOVIDADES DA LOJA</p><h2>Acabou de chegar.</h2></div><Link className="mvs-text-link" to={path("/catalogo")}>Continue explorando<ArrowRight size={16}/></Link></header><LaunchCarousel products={fresh}/></section>}
    <section className="nx-wrap nx-sec mvs-contact-section"><div className="mvs-contact-banner"><div><span className="mvs-eyebrow">PODE CONTAR COM A GENTE</span><h2>Precisa de uma mão<br/>para escolher?</h2><p>Fale com a equipe e encontre o produto para o que você precisa.</p></div>{tenant.whatsapp ? <a className="mvs-solid-button" href={waLink(tenant)} target="_blank" rel="noreferrer">Converse com a MVS<ArrowUpRight size={19}/></a> : <Link className="mvs-solid-button" to={path("/catalogo")}>Explore o catálogo<ArrowUpRight size={19}/></Link>}</div></section>
  </main>;
}
