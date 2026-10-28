import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play, Sparkles, Wine } from "lucide-react";
import { useKit } from "./kit";

export const BRISA_HERO = "/store-assets/adega-brisa-hero-v1.webp";
export const BRISA_MOMENT = "/store-assets/adega-brisa-moment-v1.webp";

export default function Hero() {
  const { tenant, sf, path } = useKit();
  const custom = (sf.hero_slides || []).filter((slide) => slide.image);
  const slides = custom.length ? custom : [
    { id: "encontro", image: tenant.banner_url || BRISA_HERO, title: tenant.hero_tagline || "Bons encontros.\nMelhores brindes.", subtitle: tenant.about_text || "Vinhos, cervejas e pequenas descobertas para acompanhar os seus melhores momentos. Escolha o seu próximo brinde.", button_label: sf.hero_button_label || "Encontre seu favorito", button_url: "/catalogo" },
    { id: "momento", image: tenant.banner_url || BRISA_MOMENT, title: "Um brinde aos\npequenos momentos.", subtitle: "Um almoço que se estende, a visita de última hora, um encontro especial. Tem uma boa escolha esperando por você.", button_label: "Conheça a seleção", button_url: "/catalogo" },
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

  return <section className="brs-hero" aria-label="Destaques da adega" aria-roledescription="carrossel" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setHovered(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHovered(false); }} onTouchStart={(event) => setTouch(event.touches[0].clientX)} onTouchEnd={(event) => { if (touch !== null && Math.abs(event.changedTouches[0].clientX - touch) > 50) go(event.changedTouches[0].clientX < touch ? 1 : -1); setTouch(null); }}>
    <div className="brs-wrap brs-hero-stage">
      {slides.map((slide, i) => {
        const external = /^https?:\/\//i.test(slide.button_url || "");
        const url = slide.button_url || "/catalogo";
        return <div key={slide.id} className={`brs-scene ${i === current ? "is-active" : ""}`} aria-hidden={i !== current} inert={i !== current} role="group" aria-roledescription="slide" aria-label={`${i + 1} de ${slides.length}`}>
          <div className="brs-hero-copy">
            <span className="brs-kicker"><Sparkles size={13} /> {sf.segment_label || "A vida pede bons brindes"}</span>
            <h1>{slide.title || tenant.hero_tagline || tenant.name}</h1>
            <p>{slide.subtitle || "Descubra a bebida que combina com o seu momento."}</p>
            <div className="brs-hero-actions">{external ? <a className="brs-btn" href={url} target="_blank" rel="noreferrer">{slide.button_label || "Saiba mais"}<ArrowUpRight size={17} /></a> : <Link className="brs-btn" to={path(url)}>{slide.button_label || "Conheça a seleção"}<ArrowUpRight size={17} /></Link>}<a className="brs-text-link" href="#selecao">Deixe-se inspirar <ArrowDown size={14} /></a></div>
            <div className="brs-hero-note"><span><Wine size={21} strokeWidth={1.2} /></span><p>Escolhas que combinam com você.<br /><strong>E com quem você gosta de ter por perto.</strong></p></div>
          </div>
          <div className="brs-hero-visual"><img className="brs-scene-photo" src={slide.image} alt="" fetchPriority={i === 0 ? "high" : "auto"} loading={i === 0 ? "eager" : "lazy"} /><span className="brs-photo-label">Um convite para celebrar o agora.</span></div>
        </div>;
      })}
      {slides.length > 1 && <div className="brs-hero-controls"><span>{String(current + 1).padStart(2, "0")} <i>/ {String(slides.length).padStart(2, "0")}</i></span><button className="brs-round" type="button" aria-label="Banner anterior" onClick={() => go(-1)}><ChevronLeft size={17} /></button><div className="brs-hero-dots">{slides.map((slide, i) => <button key={slide.id} type="button" aria-label={`Ver banner ${i + 1}`} aria-current={i === current ? "true" : undefined} onClick={() => setIndex(i)} />)}</div><button className="brs-round" type="button" aria-label="Próximo banner" onClick={() => go(1)}><ChevronRight size={17} /></button>{seconds > 0 && <button className="brs-round" type="button" aria-label={paused ? "Reproduzir banners" : "Pausar banners"} aria-pressed={paused} onClick={() => setPaused((value) => !value)}>{paused ? <Play size={13} /> : <Pause size={13} />}</button>}</div>}
    </div>
  </section>;
}
