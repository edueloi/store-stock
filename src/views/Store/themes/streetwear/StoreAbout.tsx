import { Link } from "react-router-dom";
import StoreSEO from "../../../../components/store/StoreSEO";
import { useKit } from "../street/kit";
import "./styles.css";

export default function StoreAbout() {
  const { tenant, path } = useKit();

  return (
    <div className="rua-root">
      <StoreSEO
        title={`Nossa rua / Sobre nós | ${tenant.name || "RUA013"}`}
        description={tenant.about_text || "A RUA013 nasceu na cultura urbana e skate. Conheça nossa essência e nosso corre."}
        url={typeof window !== "undefined" ? window.location.href : ""}
        siteName={tenant.name}
      />

      {/* PAGE BANNER */}
      <div className="rua-page-banner">
        <div className="rua-container">
          <div className="rua-eyebrow light">Do asfalto pra vida</div>
          <h1 className="rua-headline">
            NOSSA RUA.<br />
            NOSSA HISTÓRIA.
          </h1>
          <p>Criado na cultura, movido pela atitude.</p>
        </div>
      </div>

      {/* ABOUT GRID */}
      <div className="rua-container rua-about-grid">
        <img
          src="https://images.unsplash.com/photo-1572618047447-4e753d6e3e9c?w=1000&q=85"
          alt="Cultura skateboard"
        />
        <div>
          <div className="rua-eyebrow">Quem somos</div>
          <h2 className="rua-headline">
            NÃO É SÓ<br />
            ROUPA.
          </h2>
          <p>
            {tenant.about_text ||
              `A ${tenant.name || "RUA013"} foi criada para quem vive e respira a cultura urbana e skate. Nossa inspiração está nas pistas, nos muros, na música e nas pessoas que fazem a cultura de rua acontecer.`}
          </p>
          <p>
            Acreditamos na liberdade de expressão, na autenticidade e na conexão entre quem compartilha o mesmo corre. Uma loja com curadoria de tênis, roupas, skate e acessórios para todas as jornadas.
          </p>
          <Link to={path("/catalogo")} className="rua-btn dark" style={{ marginTop: 16 }}>
            Conheça a loja ↗
          </Link>
        </div>
      </div>

      {/* VALUES */}
      <div className="rua-container" style={{ paddingBottom: 90 }}>
        <div className="rua-values">
          <div className="rua-value">
            <div className="rua-eyebrow">01 / Essência</div>
            <h3>A RUA ENSINA.</h3>
            <p>Inspirados no skate, na música, na arte e no movimento urbano.</p>
          </div>
          <div className="rua-value">
            <div className="rua-eyebrow">02 / Expressão</div>
            <h3>SEM PADRÃO.</h3>
            <p>O estilo é seu. A regra é expressar sua identidade.</p>
          </div>
          <div className="rua-value">
            <div className="rua-eyebrow">03 / Comunidade</div>
            <h3>TODO MUNDO NO CORRE.</h3>
            <p>Uma plataforma para reunir produtos e a comunidade que faz a cultura acontecer.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
