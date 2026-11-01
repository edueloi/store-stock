import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { shorten, useKit } from "./kit";

export const GADGET_CAMPAIGN = {
  hero: "/store-assets/gadget-upgrade/productivity-hero-v1.webp",
  audio: "/store-assets/gadget-upgrade/audio-hero-v1.webp",
  mobile: "/store-assets/gadget-upgrade/productivity-mobile-v1.webp",
};
type Campaign = { id: string; image: string; mobile?: string; title?: string; subtitle?: string; eyebrow?: string; button_label?: string; button_url?: string };

export default function CampaignHero() {
  const { tenant, sf, path } = useKit();
  const configured = (sf.hero_slides || []).filter(slide => slide.image);
  const slides: Campaign[] = configured.length ? configured : [
    { id: "productivity", image: tenant.banner_url || GADGET_CAMPAIGN.hero, mobile: !tenant.banner_url || tenant.banner_url === GADGET_CAMPAIGN.hero ? GADGET_CAMPAIGN.mobile : undefined, eyebrow: "SEU UNIVERSO DE TECNOLOGIA", title: tenant.hero_tagline && tenant.hero_tagline.length <= 64 ? tenant.hero_tagline : "Seu próximo upgrade.\nComeça aqui.", subtitle: shorten(tenant.hero_tagline || "Eletrônicos, informática e acessórios para conectar você a novas possibilidades.", 175), button_label: sf.hero_button_label || "Explore a coleção", button_url: "/catalogo" },
    { id: "audio", image: GADGET_CAMPAIGN.audio, eyebrow: "CONECTE-SE AO QUE VOCÊ GOSTA", title: "Dê play em\nnovas possibilidades.", subtitle: "Encontre áudio, acessórios e conexões para acompanhar o seu dia.", button_label: "Descubra o catálogo", button_url: "/catalogo" },
  ];
  const [index, setIndex] = useState(0), [paused, setPaused] = useState(false), [interacting, setInteracting] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [hidden, setHidden] = useState(document.hidden);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const current = index % slides.length;
  const seconds = sf.hero_autoplay_seconds ?? 7;
  const auto = slides.length > 1 && seconds > 0 && !paused && !interacting && !reduced && !hidden;
  const go = (next: number) => setIndex((next + slides.length) % slides.length);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(preference.matches), visibility = () => setHidden(document.hidden);
    preference.addEventListener("change", change); document.addEventListener("visibilitychange", visibility);
    return () => { preference.removeEventListener("change", change); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  useEffect(() => {
    if (!auto) return;
    const timer = window.setTimeout(() => go(current + 1), Math.max(3, seconds) * 1000);
    return () => window.clearTimeout(timer);
  }, [current, auto, seconds, slides.length]);
  const resolve = (href: string) => href.startsWith("/") ? path(href) : href;
  return <section className="gd-campaign" role="region" aria-roledescription="carrossel" aria-label="Campanhas da loja" onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)} onFocusCapture={() => setInteracting(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false); }} onTouchStart={event => { touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }} onTouchCancel={() => { touch.current = null; }} onTouchEnd={event => { if (!touch.current) return; const dx = event.changedTouches[0].clientX - touch.current.x, dy = event.changedTouches[0].clientY - touch.current.y; touch.current = null; if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(current + (dx < 0 ? 1 : -1)); }}>
    <div className="gd-campaign-stage">{slides.map((slide, i) => <article key={slide.id} className={`gd-campaign-slide${i === current ? " is-active" : ""}`} aria-hidden={i !== current} inert={i !== current} aria-roledescription="slide" aria-label={`${i + 1} de ${slides.length}`}>
      <picture>{slide.mobile && <source media="(max-width: 700px)" srcSet={slide.mobile}/>}<img src={slide.image} alt="" fetchPriority={i === 0 ? "high" : "auto"} loading={i === 0 ? "eager" : "lazy"}/></picture><div className="gd-campaign-shade"/>
      <div className="gd-wrap gd-campaign-inner"><div className="gd-campaign-copy"><span className="gd-campaign-label">{slide.eyebrow || tenant.name}</span>{slide.title && (i === 0 ? <h1>{slide.title}</h1> : <h2>{slide.title}</h2>)}{slide.subtitle && <p>{slide.subtitle}</p>}{slide.button_label && slide.button_url && (/^https?:\/\//i.test(slide.button_url) ? <a className="gd-campaign-button" href={slide.button_url} target="_blank" rel="noreferrer">{slide.button_label}<ArrowUpRight size={20}/></a> : <Link className="gd-campaign-button" to={resolve(slide.button_url)}>{slide.button_label}<ArrowUpRight size={20}/></Link>)}</div></div>
    </article>)}</div>
    <div className="gd-wrap gd-campaign-controls"><div className="gd-campaign-pagination" role="group" aria-label="Escolher campanha">{slides.map((slide, i) => <button key={slide.id} type="button" aria-label={`Ver campanha ${i + 1}`} aria-current={i === current ? "true" : undefined} onClick={() => go(i)}><span>{String(i + 1).padStart(2, "0")}</span><i/></button>)}</div><span className="gd-campaign-caption">{tenant.name} / CONECTE POSSIBILIDADES</span>{slides.length > 1 && <div className="gd-campaign-arrows"><button type="button" aria-label="Campanha anterior" onClick={() => go(current - 1)}><ChevronLeft size={19}/></button><button type="button" aria-label="Próxima campanha" onClick={() => go(current + 1)}><ChevronRight size={19}/></button>{!reduced && seconds > 0 && <button type="button" aria-label={paused ? "Retomar campanhas" : "Pausar campanhas"} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play size={14}/> : <Pause size={14}/>}</button>}</div>}</div>
  </section>;
}
