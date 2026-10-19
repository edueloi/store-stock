import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CreditCard, PawPrint, Repeat, Search, Truck } from "lucide-react";
import StoreSEO from "../../../../components/store/StoreSEO";
import HeroSlider from "../../../../components/store/HeroSlider";
import { StoreButton } from "../../../../components/store/StoreButton";
import { productImage, useKit } from "./kit";
import { useShelves } from "./extras";
import { useHeroMotion } from "./motion";
import { Shelf } from "./parts";

const TRUST = [
  { icon: Truck, title: "Entrega combinada", text: "Receba onde for melhor" },
  { icon: CreditCard, title: "Pagamento seguro", text: "Formas pensadas para você" },
  { icon: Repeat, title: "Troca facilitada", text: "Fale com a loja" },
];

export default function StoreFront() {
  const { tenant, active, config, path } = useKit();
  const shelves = useShelves();
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  useHeroMotion(heroRef);
  const [species, setSpecies] = useState("");
  const [term, setTerm] = useState("");
  const featured = active.filter((p) => p.is_featured);
  const first = (featured.length ? featured : active).find((p) => productImage(p));
  const hero = tenant.banner_url || productImage(first);
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const query: Record<string, string> = {};
    if (species) query.cat = species;
    if (term.trim()) query.q = term.trim();
    navigate(path("/catalogo", query));
  };
  const fallback = (
    <section className="feed-hero">
      <div className="feed-hero-copy">
        <span className="feed-eyebrow"><PawPrint size={15} aria-hidden="true" /> {config.segment_label || "Rações e nutrição"}</span>
        <h1>{tenant.hero_tagline || "A comida certa para cada fase da vida."}</h1>
        <p>{tenant.about_text || "Rações, petiscos e suplementos selecionados para cães, gatos, aves e muito mais."}</p>
        <form className="feed-finder" onSubmit={go} role="search" aria-label="Encontrar produto por animal">
          <label>
            <span className="feed-sr">Para qual animal?</span>
            <select value={species} onChange={(e) => setSpecies(e.target.value)}>
              <option value="">Todos os animais</option>
              {shelves.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>
            <span className="feed-sr">Palavra-chave</span>
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Ex.: filhote, adulto, castrado" />
          </label>
          <StoreButton type="submit" className="feed-cta"><Search size={17} aria-hidden="true" /> Buscar</StoreButton>
        </form>
      </div>
      <div className="feed-hero-art">
        <span className="feed-hero-orb" aria-hidden="true" />
        <div className="feed-hero-pic">{hero ? <img src={hero} alt="" /> : <PawPrint size={90} aria-hidden="true" />}</div>
        <span className="feed-hero-chip">Seleção da loja</span>
      </div>
    </section>
  );
  return (
    <div className="feed-page">
      <StoreSEO title={tenant.name} description={tenant.hero_tagline || "Rações e nutrição para o seu animal."} image={tenant.banner_url || tenant.logo_url} url={typeof window !== "undefined" ? window.location.href : ""} siteName={tenant.name} />
      <div className="feed-wrap feed-hero-wrap" ref={heroRef}>
        <HeroSlider
          slides={config.hero_slides}
          autoplaySeconds={config.hero_autoplay_seconds ?? 6}
          resolveUrl={(u) => (u.startsWith("/") ? path(u) : u)}
          layout="split"
          className="feed-slider"
          fallback={fallback}
        />
      </div>
      <div className="feed-wrap">
        <ul className="feed-trust" aria-label="Vantagens">
          {TRUST.map((t) => (
            <li key={t.title}>
              <t.icon size={22} aria-hidden="true" />
              <span><strong>{t.title}</strong><small>{t.text}</small></span>
            </li>
          ))}
        </ul>
      </div>
      <div className="feed-wrap feed-shelves">
        {shelves.slice(0, 4).map((c) => <Shelf key={c.id} id={c.id} name={c.name} count={c.count} items={c.items} />)}
        {!shelves.length && active.length > 0 && (
          <Shelf id={0} name="Nossos produtos" count={active.length} items={active} />
        )}
      </div>
      <div className="feed-wrap feed-more">
        <StoreButton asChild variant="outline" className="feed-ghost">
          <Link to={path("/catalogo")}>Ver todos os produtos <ArrowRight size={17} aria-hidden="true" /></Link>
        </StoreButton>
      </div>
    </div>
  );
}
