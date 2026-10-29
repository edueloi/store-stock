import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useKit } from "./kit";

export const ELO_HERO = "/store-assets/elo-campaign-v1.webp";
export const ELO_EDITORIAL = "/store-assets/elo-editorial-v1.webp";

export default function Hero() {
  const { tenant, sf, path } = useKit();
  const custom = (sf.hero_slides || []).filter((slide) => slide.image);
  const slides = custom.length ? custom : [
    { id: "essencia", image: tenant.banner_url || ELO_HERO, title: tenant.hero_tagline || "Vista a leveza.\nSinta-se você.", subtitle: tenant.about_text || "Peças que acompanham os seus dias, com delicadeza nos detalhes e espaço para o seu jeito de ser.", button_label: sf.hero_button_label || "Descubra a coleção", button_url: "/catalogo" },
    { id: "presenca", image: tenant.banner_url || ELO_EDITORIAL, title: "Delicada no toque.\nÚnica em você.", subtitle: "Encontre novas combinações para os seus encontros, seus planos e todos os momentos entre eles.", button_label: "Encontre seu favorito", button_url: "/catalogo" },
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
  return <section className="els-hero" aria-label="Campanhas da coleção" aria-roledescription="carrossel" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setHovered(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHovered(false); }} onTouchStart={(event) => setTouch(event.touches[0].clientX)} onTouchEnd={(event) => { if (touch !== null && Math.abs(event.changedTouches[0].clientX - touch) > 50) go(event.changedTouches[0].clientX < touch ? 1 : -1); setTouch(null); }}>
    {slides.map((slide, i) => {
      const url = slide.button_url || "/catalogo";
      return <div key={slide.id} className={`els-scene ${i === current ? "is-active" : ""}`} aria-hidden={i !== current} inert={i !== current} role="group" aria-label={`${i + 1} de ${slides.length}`} aria-roledescription="slide"><img className="els-scene-photo" src={slide.image} alt="" fetchPriority={i === 0 ? "high" : "auto"} loading={i === 0 ? "eager" : "lazy"} /><div className="els-wrap els-hero-copy"><span className="els-kicker">{sf.segment_label || "Um encontro com a sua essência"}</span><h1>{slide.title || tenant.hero_tagline || tenant.name}</h1><p>{slide.subtitle || "Conheça a coleção e descubra o que combina com você."}</p>{/^https?:\/\//i.test(url) ? <a className="els-btn" href={url} target="_blank" rel="noreferrer">{slide.button_label || "Saiba mais"}<ArrowUpRight size={16} /></a> : <Link className="els-btn" to={path(url)}>{slide.button_label || "Explore a coleção"}<ArrowUpRight size={16} /></Link>}</div></div>;
    })}
    <div className="els-wrap els-hero-bottom"><a href="#colecao" className="els-discover"><span>Novas formas de ser você</span><ArrowDown size={16} strokeWidth={1.2} /></a>{slides.length > 1 && <div className="els-hero-controls"><button type="button" className="els-round" aria-label="Banner anterior" onClick={() => go(-1)}><ChevronLeft size={17} /></button><div className="els-hero-dots">{slides.map((slide, i) => <button type="button" key={slide.id} aria-label={`Ver banner ${i + 1}`} aria-current={i === current ? "true" : undefined} onClick={() => setIndex(i)} />)}</div><button type="button" className="els-round" aria-label="Próximo banner" onClick={() => go(1)}><ChevronRight size={17} /></button>{seconds > 0 && <button type="button" className="els-round" aria-label={paused ? "Reproduzir banners" : "Pausar banners"} aria-pressed={paused} onClick={() => setPaused((value) => !value)}>{paused ? <Play size={12} /> : <Pause size={12} />}</button>}</div>}</div>
  </section>;
}
