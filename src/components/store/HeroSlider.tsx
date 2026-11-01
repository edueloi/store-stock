import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { gsap } from "gsap";
import type { HeroSlide } from "../../types";
import "./hero-slider.css";

type Props = {
  slides?: HeroSlide[];
  /** Hero padrão do tema, exibido quando a loja não cadastrou banners. */
  fallback: ReactNode;
  /** Resolve o link do botão (aceita caminho interno ou URL externa). */
  resolveUrl: (url: string) => string;
  autoplaySeconds?: number;
  /** Classe do tema; o CSS do tema pode sobrescrever as variáveis --hs-*. */
  className?: string;
  /** "banner": imagem de fundo com texto sobre ela. "split": texto ao lado da imagem. */
  layout?: "banner" | "split";
  /** Desliga a entrada animada para temas de apresentação estática. */
  animate?: boolean;
  /** Mostra o controle de pausa nos temas que reservam espaço para ele. */
  pauseControl?: boolean;
};

const isExternal = (url: string) => /^https?:\/\//i.test(url);

/**
 * Carrossel de banners das vitrines, editável pelo lojista (Configurações > Vitrine).
 * Sem slides cadastrados, renderiza o `fallback`. Visual neutro e redondo, ajustável
 * pelos temas via variáveis CSS (--hs-radius, --hs-accent, --hs-height, --hs-ink).
 */
export default function HeroSlider({ slides, fallback, resolveUrl, autoplaySeconds = 6, className = "", layout = "banner", animate = true, pauseControl = false }: Props) {
  const list = (slides || []).filter((s) => s.image);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const count = list.length;

  const go = useCallback((next: number) => setIndex(count ? (next + count) % count : 0), [count]);

  useEffect(() => {
    if (count < 2 || paused || userPaused || !autoplaySeconds) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => go(index + 1), autoplaySeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [count, index, paused, userPaused, autoplaySeconds, go]);

  useEffect(() => { setIndex(value => count ? value % count : 0); }, [count]);

  useEffect(() => {
    const el = root.current?.querySelector<HTMLElement>(`[data-slide="${index}"] .hs-copy`);
    if (!animate || !el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tween = gsap.fromTo(el.children, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.09, ease: "power3.out" });
    return () => {
      tween.kill();
    };
  }, [index, animate]);

  if (!count) return <>{fallback}</>;

  return (
    <div
      ref={root}
      className={`hs hs-${layout} ${className}`}
      role="region"
      aria-roledescription="carrossel"
      aria-label="Destaques da loja"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => {
        touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchEnd={(e) => {
        if (!touchStart.current) return;
        const dx = e.changedTouches[0].clientX - touchStart.current.x;
        const dy = e.changedTouches[0].clientY - touchStart.current.y;
        touchStart.current = null;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(index + (dx < 0 ? 1 : -1));
      }}
      onTouchCancel={() => { touchStart.current = null; }}
    >
      <div className="hs-track">
        {list.map((slide, i) => {
          const active = i === index;
          const url = slide.button_url ? resolveUrl(slide.button_url) : "";
          const button =
            slide.button_label && url ? (
              isExternal(url) ? (
                <a className="hs-btn" href={url} target="_blank" rel="noreferrer">{slide.button_label}</a>
              ) : (
                <Link className="hs-btn" to={url}>{slide.button_label}</Link>
              )
            ) : null;
          return (
            <div key={slide.id} data-slide={i} className={`hs-slide ${active ? "is-active" : ""}`} aria-hidden={!active} inert={!active} role="group" aria-label={`${i + 1} de ${count}`}>
              {slide.mobile_image ? <picture><source media="(max-width: 700px)" srcSet={slide.mobile_image}/><img className="hs-img" src={slide.image} alt={slide.title || ""} loading={i === 0 ? "eager" : "lazy"} fetchPriority={i === 0 ? "high" : "auto"}/></picture> : <img className="hs-img" src={slide.image} alt={slide.title || ""} loading={i === 0 ? "eager" : "lazy"} />}
              {(slide.title || slide.subtitle || button) && (
                <div className="hs-copy">
                  {slide.title && <h2>{slide.title}</h2>}
                  {slide.subtitle && <p>{slide.subtitle}</p>}
                  {button}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {count > 1 && (
        <>
          <button type="button" className="hs-arrow hs-prev" aria-label="Slide anterior" onClick={() => go(index - 1)}><ChevronLeft size={22} /></button>
          <button type="button" className="hs-arrow hs-next" aria-label="Próximo slide" onClick={() => go(index + 1)}><ChevronRight size={22} /></button>
          <div className="hs-dots">
            {list.map((slide, i) => (
              <button key={slide.id} type="button" aria-label={`Ir para o slide ${i + 1}`} aria-current={i === index} className={i === index ? "is-on" : ""} onClick={() => go(i)} />
            ))}
          </div>
          {pauseControl && autoplaySeconds > 0 && <button type="button" className="hs-pause" aria-label={userPaused ? "Retomar carrossel" : "Pausar carrossel"} aria-pressed={userPaused} onClick={() => setUserPaused(value => !value)}>{userPaused ? <Play size={14}/> : <Pause size={14}/>}</button>}
        </>
      )}
    </div>
  );
}
