import { useEffect, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** Temas de tom infantil/divertido entram "saltitando"; os demais, com subida suave. */
const POP_THEMES = new Set(["toys", "baby", "pet", "doceria", "variety", "kids"]);

const INTRO = "h1, h1 + p, h1 ~ a";
const REVEAL = "article, h2, [data-fx]";

/**
 * Efeitos GSAP genéricos das vitrines: título do topo entra ao carregar, cards e
 * títulos de seção são revelados ao rolar. Funciona em qualquer tema (usa só tags
 * semânticas), respeita prefers-reduced-motion e limpa tudo ao trocar de página.
 * Marque um elemento com data-no-fx para ignorá-lo.
 */
export function useStoreFx(scope: RefObject<HTMLElement | null>, templateId: string, routeKey: string) {
  useEffect(() => {
    const root = scope.current;
    if (!root || ["urban", "fragrance", "beauty", "street", "streetwear", "tech", "books", "agro", "feed", "garden", "electric", "toys", "variety", "aura"].includes(templateId) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const pop = POP_THEMES.has(templateId);
    const from = pop ? { opacity: 0, y: 30, scale: 0.85 } : { opacity: 0, y: 24 };
    const ease = pop ? "back.out(1.7)" : "power3.out";
    let ctx: gsap.Context | undefined;
    let frame = 0;
    let tries = 0;
    const usable = (el: Element) => !el.closest("[data-no-fx]") && !(el as HTMLElement).style.transform;

    // As páginas são lazy: espera o conteúdo aparecer antes de animar.
    const start = () => {
      if (!root.querySelector("h1, article") && tries++ < 90) {
        frame = requestAnimationFrame(start);
        return;
      }
      ctx = gsap.context(() => {
        const intro = gsap.utils.toArray<HTMLElement>(INTRO, root).filter(usable).slice(0, 6);
        if (intro.length) gsap.from(intro, { ...from, duration: 0.7, stagger: 0.1, ease, clearProps: "transform,opacity" });
        const items = gsap.utils.toArray<HTMLElement>(REVEAL, root).filter(usable);
        if (!items.length) return;
        gsap.set(items, from);
        ScrollTrigger.batch(items, {
          start: "top 94%",
          once: true,
          onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.07, ease, overwrite: true, clearProps: "transform,opacity" }),
        });
      }, root);
      window.setTimeout(() => ScrollTrigger.refresh(), 300);
    };
    start();
    return () => {
      cancelAnimationFrame(frame);
      ctx?.revert();
    };
  }, [scope, templateId, routeKey]);
}
