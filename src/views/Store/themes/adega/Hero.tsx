import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowRight, ChevronLeft, ChevronRight, Moon, Pause, Play } from "lucide-react";
import { useKit } from "./kit";

export const ADEGA_HERO = "/store-assets/adega-night-hero-v1.webp";
export const ADEGA_WINE = "/store-assets/adega-wine-hero-v1.webp";

/** As imagens cadastradas na vitrine sempre têm prioridade sobre as fotos do tema. */
export default function Hero() {
  const { tenant, sf, path } = useKit();
  const custom = (sf.hero_slides || []).filter((slide) => slide.image);
  const slides = custom.length ? custom : [
    { id: "night", image: tenant.banner_url || ADEGA_HERO, title: tenant.hero_tagline || "A noite é sua.\nO brinde é com a gente.", subtitle: tenant.about_text || "Sua bebida favorita, bem gelada. Da primeira escolha ao último detalhe, a sua noite começa aqui.", button_label: sf.hero_button_label || "Explorar o cardápio", button_url: "/catalogo" },
    { id: "wine", image: tenant.banner_url || ADEGA_WINE, title: "Boas conversas.\nGrandes brindes.", subtitle: "Encontre o sabor que combina com o seu momento. Conheça a nossa seleção e escolha o próximo brinde.", button_label: "Encontre seu favorito", button_url: "/catalogo" },
  ];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [touch, setTouch] = useState<number | null>(null);
  const current = index % slides.length;
  const seconds = sf.hero_autoplay_seconds ?? 7;
  const go = (delta: number) => setIndex((value) => (value + delta + slides.length) % slides.length);

  useEffect(() => {
    if (slides.length < 2 || paused || hovered || seconds <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setIndex((value) => (value + 1) % slides.length), seconds * 1000);
    return () => window.clearTimeout(timer);
  }, [current, slides.length, paused, hovered, seconds]);

  return (
    <section className="adg-cinema" aria-label="Destaques da adega" aria-roledescription="carrossel" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setHovered(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHovered(false); }} onTouchStart={(event) => setTouch(event.touches[0].clientX)} onTouchEnd={(event) => { if (touch !== null && Math.abs(event.changedTouches[0].clientX - touch) > 50) go(event.changedTouches[0].clientX < touch ? 1 : -1); setTouch(null); }}>
      {slides.map((slide, i) => {
        const external = /^https?:\/\//i.test(slide.button_url || "");
        const url = slide.button_url || "/catalogo";
        return (
          <div key={slide.id} className={`adg-scene ${i === current ? "is-active" : ""}`} aria-hidden={i !== current} inert={i !== current} role="group" aria-roledescription="slide" aria-label={`${i + 1} de ${slides.length}`}>
            <img className="adg-scene-photo" src={slide.image} alt="" fetchPriority={i === 0 ? "high" : "auto"} loading={i === 0 ? "eager" : "lazy"} />
            <div className="adg-wrap adg-scene-content">
              <span className="adg-kicker"><span className="adg-live-dot" /> {sf.segment_label || "Para os seus melhores momentos"}</span>
              <h1>{slide.title || tenant.hero_tagline || tenant.name}</h1>
              <p>{slide.subtitle || "Bebidas, gelo e conveniência. Escolha o que combina com a sua noite."}</p>
              <div className="adg-hero-cta">
                {external ? <a className="adg-btn adg-btn-lg" href={url} target="_blank" rel="noreferrer">{slide.button_label || "Saiba mais"}<ArrowRight size={18} /></a> : <Link className="adg-btn adg-btn-lg" to={path(url)}>{slide.button_label || "Explorar o cardápio"}<ArrowRight size={18} /></Link>}
                <a className="adg-hero-discover" href="#selecao">Conheça a seleção <ArrowDown size={15} /></a>
              </div>
              <span className="adg-hero-sign"><Moon size={15} /> Bons momentos merecem um brinde.</span>
            </div>
          </div>
        );
      })}
      <div className="adg-wrap adg-cinema-bottom">
        <span className="adg-hero-caption">BEBIDAS & BOAS HISTÓRIAS <span>·</span> {tenant.name}</span>
        {slides.length > 1 && <div className="adg-cinema-controls">
          <button className="adg-round" type="button" aria-label="Banner anterior" onClick={() => go(-1)}><ChevronLeft size={18} /></button>
          <div className="adg-cinema-dots">{slides.map((slide, i) => <button key={slide.id} type="button" aria-label={`Ver banner ${i + 1}`} aria-current={i === current ? "true" : undefined} onClick={() => setIndex(i)} />)}</div>
          <button className="adg-round" type="button" aria-label="Próximo banner" onClick={() => go(1)}><ChevronRight size={18} /></button>
          {seconds > 0 && <button className="adg-round" type="button" aria-label={paused ? "Reproduzir banners" : "Pausar banners"} aria-pressed={paused} onClick={() => setPaused((value) => !value)}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>}
        </div>}
      </div>
    </section>
  );
}
