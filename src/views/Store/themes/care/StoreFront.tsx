import { Link } from "react-router-dom";
import { ArrowRight, HeartHandshake, Leaf, MessageCircle, Sparkles } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import { pageUrl, productImage, useShop, whatsappLink } from "./core";
import { Blob, ProductCard, Rail, T } from "./parts";

export default function StoreFront() {
  const { tenant, categories, active, config, path } = useShop();
  const featured = active.filter((p) => p.is_featured);
  const shelf = (featured.length ? featured : active).slice(0, 12);
  const cats = categories.filter((c) => active.some((p) => p.category_id === c.id));
  const art = tenant.banner_url || productImage(shelf[0]);
  const benefits = [
    { icon: <Sparkles size={22} />, title: "Rotina simples", text: "Produtos organizados por cuidado, fáceis de encontrar." },
    { icon: <Leaf size={22} />, title: "Seleção cuidadosa", text: "Itens escolhidos para o seu dia a dia." },
    { icon: <HeartHandshake size={22} />, title: "Atendimento acolhedor", text: tenant.whatsapp ? "Tire dúvidas direto com a equipe." : "Estamos por perto para ajudar." },
  ];
  return (
    <div className="ca ca-page">
      <StoreSEO title={`${tenant.name} | ${config.segment_label || T.tag}`} description={tenant.about_text || T.sub} image={tenant.banner_url} siteName={tenant.name} url={pageUrl()} />

      <section className="ca-hero">
        <div className="ca-hero-copy">
          <span className="ca-eyebrow">{config.segment_label || T.tag}</span>
          <h1>{tenant.hero_tagline || T.hero}</h1>
          <p>{T.sub}</p>
          <div className="ca-hero-btns">
            <Link to={path("/catalogo")} className="ca-btn">{config.hero_button_label || "Ver catálogo"} <ArrowRight size={18} aria-hidden="true" /></Link>
            <Link to={path("/sobre")} className="ca-btn ca-btn-ghost">Nossa história</Link>
          </div>
        </div>
        <div className="ca-hero-art">
          <Blob className="ca-blob-a" />
          <Blob className="ca-blob-b" />
          <div className="ca-hero-photo">{art ? <img src={art} alt="" /> : <Leaf size={90} aria-hidden="true" />}</div>
          <div className="ca-float ca-float-1"><span><Sparkles size={18} aria-hidden="true" /></span> Cuidado diário</div>
          <div className="ca-float ca-float-2"><span><Leaf size={18} aria-hidden="true" /></span> Bem-estar</div>
        </div>
      </section>

      <section className="ca-benefits" aria-label="Benefícios">
        {benefits.map((b) => (
          <div key={b.title} className="ca-benefit">
            <span>{b.icon}</span>
            <div><b>{b.title}</b><p>{b.text}</p></div>
          </div>
        ))}
      </section>

      {cats.length > 0 && (
        <section className="ca-block">
          <h2 className="ca-h2">{config.home_categories_title || T.categories}</h2>
          <div className="ca-bubbles">
            {cats.map((c) => (
              <Link key={c.id} to={path(`/catalogo?cat=${c.id}`)} className="ca-bubble">
                <span>{c.cover_url ? <img src={c.cover_url} alt="" loading="lazy" /> : c.name.charAt(0).toUpperCase()}</span>
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {shelf.length > 0 ? (
        <Rail title={config.home_featured_title || T.featured} to={path("/catalogo")}>
          {shelf.map((p) => <div className="ca-slide" key={p.id}><ProductCard product={p} /></div>)}
        </Rail>
      ) : (
        <p className="ca-empty">Em breve, novos cuidados por aqui.</p>
      )}

      <section className="ca-cta">
        <div>
          <h2>Cuidar de você é uma rotina.</h2>
          <p>Conheça a loja e descubra como podemos ajudar.</p>
        </div>
        {tenant.whatsapp ? (
          <a className="ca-btn ca-btn-white" href={whatsappLink(tenant, "Olá! Gostaria de uma orientação.")} target="_blank" rel="noreferrer"><MessageCircle size={18} aria-hidden="true" /> Conversar agora</a>
        ) : (
          <Link className="ca-btn ca-btn-white" to={path("/sobre")}>Conhecer a loja</Link>
        )}
      </section>
    </div>
  );
}
