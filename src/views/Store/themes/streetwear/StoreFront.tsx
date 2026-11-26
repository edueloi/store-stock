import { Link } from "react-router-dom";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit, priceInfo, productImage } from "../street/kit";
import type { Product } from "../../../../types";
import "./styles.css";

const DEFAULT_CATEGORIES = [
  { name: "Tênis", label: "TÊNIS", desc: "Encontre o seu par ↗", image: "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=620&q=85" },
  { name: "Roupas", label: "ROUPAS", desc: "Monte o outfit ↗", image: "https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=620&q=85" },
  { name: "Skate", label: "SKATE", desc: "Pra sessão ↗", image: "https://images.unsplash.com/photo-1564982752979-3f7bc974d29a?w=620&q=85" },
  { name: "Acessórios", label: "ACESSÓRIOS", desc: "Detalhes que pesam ↗", image: "https://images.unsplash.com/photo-1521369909029-2afed882baee?w=620&q=85" },
];

export default function StoreFront() {
  const { tenant, active, categories, path, hidden, catName } = useKit();

  const heroImage = tenant.banner_url || "https://images.unsplash.com/photo-1520045892732-304bc3ac5d8e?w=1100&q=85";
  const featured = active.slice(0, 8);
  const primaryFeatured = featured.slice(0, 4);
  const secondaryFeatured = featured.slice(4, 8);

  // Mapeia categorias da loja ou usa o quarteto padrão
  const categoryCards = categories.length >= 4
    ? categories.slice(0, 4).map((c, i) => ({
        id: c.id,
        name: c.name,
        label: c.name.toUpperCase(),
        desc: "Ver coleção ↗",
        image: c.image_url || DEFAULT_CATEGORIES[i]?.image || DEFAULT_CATEGORIES[0].image,
      }))
    : DEFAULT_CATEGORIES.map((def) => {
        const matching = categories.find((c) => c.name.toLowerCase() === def.name.toLowerCase());
        return {
          id: matching?.id,
          name: def.name,
          label: def.label,
          desc: def.desc,
          image: matching?.image_url || def.image,
        };
      });

  const renderProductCard = (p: Product) => {
    const prices = priceInfo(p, hidden);
    const img = productImage(p) || "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=600&q=85";
    const brand = p.attributes?.find((a) => a.name.toLowerCase() === "marca")?.values?.[0] || catName(p) || "STREET";
    const tag = p.is_featured ? "BEST SELLER" : prices.off ? "SALE" : null;

    return (
      <Link key={p.id} to={path(`/produto/${p.id}`)} className="rua-product">
        <div className="rua-product-image">
          <img loading="lazy" src={img} alt={p.name} />
          {tag && <span className="rua-product-tag">{tag}</span>}
          <div className="rua-product-quick">Ver detalhes ↗</div>
        </div>
        <div className="rua-product-brand">{brand}</div>
        <div className="rua-product-name">{p.name}</div>
        <div className="rua-price">
          {prices.now}
          {prices.old && <span className="rua-old-price">{prices.old}</span>}
        </div>
      </Link>
    );
  };

  return (
    <div className="rua-root">
      <StoreSEO
        title={`${tenant.name || "RUA013"} | Streetwear & Skate Shop`}
        description={tenant.about_text || "Dos picos de skate para o seu corre. Tênis, camisetas, shapes e peças com atitude e autenticidade."}
        image={heroImage}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      {/* HERO SECTION */}
      <section className="rua-hero">
        <div className="rua-hero-copy">
          <div className="rua-eyebrow light">DROP 026 / STREET CULTURE</div>
          <h1>
            VIVA<br />
            A <i>RUA.</i>
          </h1>
          <p>
            {tenant.hero_tagline || "Dos picos de skate para o seu corre. Tênis, camisetas, shapes e peças que carregam atitude em cada detalhe."}
          </p>
          <Link to={path("/catalogo")} className="rua-btn">
            Explorar o drop <span>↗</span>
          </Link>
        </div>
        <div className="rua-hero-image">
          <img src={heroImage} alt="Cultura urbana e streetwear" />
        </div>
      </section>

      {/* TICKER */}
      <div className="rua-ticker" aria-hidden="true">
        <div className="rua-ticker-inner">
          SKATE NÃO PARA ✳ STREETWEAR ✳ DO CORRE PRA VIDA ✳ AUTENTICIDADE SEM FILTRO ✳ SKATE NÃO PARA ✳ STREETWEAR ✳ DO CORRE PRA VIDA ✳ AUTENTICIDADE SEM FILTRO ✳ SKATE NÃO PARA ✳ STREETWEAR ✳ DO CORRE PRA VIDA ✳ AUTENTICIDADE SEM FILTRO ✳ 
        </div>
      </div>

      {/* CATEGORIES SECTION */}
      <section className="rua-container rua-section">
        <div className="rua-section-title">
          <div>
            <div className="rua-eyebrow">Encontre seu estilo</div>
            <h2>SEU CORRE, SUAS REGRAS.</h2>
          </div>
          <Link to={path("/catalogo")} className="rua-small-link">
            Ver tudo ↗
          </Link>
        </div>

        <div className="rua-categories">
          {categoryCards.map((cat) => (
            <Link
              key={cat.label}
              to={cat.id ? path(`/catalogo?categoria=${cat.id}`) : path(`/catalogo?q=${encodeURIComponent(cat.name)}`)}
              className="rua-category"
            >
              <img loading="lazy" src={cat.image} alt={cat.label} />
              <div className="rua-category-info">
                <strong>{cat.label}</strong>
                <small>{cat.desc}</small>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* BRANDS ROW */}
      <section className="rua-brands">
        <div className="rua-container rua-brand-row">
          <Link to={path("/catalogo?q=Vans")} style={{ textDecoration: "none" }}>
            <span style={{ fontFamily: "var(--rua-display)", fontSize: "clamp(20px, 3vw, 36px)", color: "#242424" }}>VANS</span>
          </Link>
          <Link to={path("/catalogo?q=DC Shoes")} style={{ textDecoration: "none" }}>
            <span style={{ fontFamily: "var(--rua-display)", fontSize: "clamp(20px, 3vw, 36px)", color: "#242424" }}>DC SHOES</span>
          </Link>
          <Link to={path("/catalogo?q=ÖUS")} style={{ textDecoration: "none" }}>
            <span style={{ fontFamily: "var(--rua-display)", fontSize: "clamp(20px, 3vw, 36px)", color: "#242424" }}>ÖUS</span>
          </Link>
          <Link to={path("/catalogo?q=Hocks")} style={{ textDecoration: "none" }}>
            <span style={{ fontFamily: "var(--rua-display)", fontSize: "clamp(20px, 3vw, 36px)", color: "#242424" }}>HOCKS</span>
          </Link>
          <Link to={path("/catalogo?q=Independent")} style={{ textDecoration: "none" }}>
            <span style={{ fontFamily: "var(--rua-display)", fontSize: "clamp(20px, 3vw, 36px)", color: "#242424" }}>INDEPENDENT</span>
          </Link>
        </div>
      </section>

      {/* FEATURED PRODUCTS (SELEÇÃO DA CREW / NO RADAR) */}
      <section className="rua-container rua-section">
        <div className="rua-section-title">
          <div>
            <div className="rua-eyebrow">Seleção da crew</div>
            <h2>NO RADAR.</h2>
          </div>
          <Link to={path("/catalogo")} className="rua-small-link">
            Ver todos ↗
          </Link>
        </div>

        {primaryFeatured.length > 0 ? (
          <div className="rua-product-grid">
            {primaryFeatured.map(renderProductCard)}
          </div>
        ) : (
          <p style={{ color: "var(--rua-muted)", padding: "40px 0", textAlign: "center" }}>
            Adicione produtos ao catálogo para vê-los em destaque aqui.
          </p>
        )}
      </section>

      {/* PROMO SPLIT BANNER */}
      <section className="rua-promo">
        <img
          loading="lazy"
          src="https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1300&q=85"
          alt="Skatista na rua"
        />
        <div className="rua-promo-copy">
          <span className="rua-eyebrow light">Mais que um lifestyle</span>
          <h2>
            FEITO<br />
            PRO <span style={{ color: "var(--rua-acid)" }}>CORRE.</span>
          </h2>
          <p>
            Não é só sobre o que você veste. É sobre os lugares por onde você passa, as manobras que tenta e a história que você constrói.
          </p>
          <Link to={path("/catalogo")} className="rua-btn">
            SHOP SKATE ↗
          </Link>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="rua-container rua-benefits">
        <div className="rua-benefit">
          <span className="rua-benefit-icon">↗</span>
          <div>
            <strong>Envio para todo o Brasil</strong>
            <small>Receba seu estilo onde estiver</small>
          </div>
        </div>
        <div className="rua-benefit">
          <span className="rua-benefit-icon">✳</span>
          <div>
            <strong>Curadoria de rua</strong>
            <small>Seleção feita por quem vive a cena</small>
          </div>
        </div>
        <div className="rua-benefit">
          <span className="rua-benefit-icon">◎</span>
          <div>
            <strong>Compra com atitude</strong>
            <small>Escolha suas peças e feche o corre</small>
          </div>
        </div>
      </section>

      {/* MORE PRODUCTS */}
      {secondaryFeatured.length > 0 && (
        <section className="rua-container rua-section">
          <div className="rua-section-title">
            <div>
              <div className="rua-eyebrow">Você também vai curtir</div>
              <h2>MAIS PRA SUA SESSION.</h2>
            </div>
            <Link to={path("/catalogo")} className="rua-small-link">
              Ver catálogo ↗
            </Link>
          </div>
          <div className="rua-product-grid">
            {secondaryFeatured.map(renderProductCard)}
          </div>
        </section>
      )}
    </div>
  );
}
