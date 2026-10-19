import { useEffect, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type FxOptions = {
  /** Seletores revelados ao rolar a página (cada grupo entra em cascata). */
  reveal: string[];
  /** Seletores do topo da página que entram de uma vez, ao carregar. */
  intro?: string[];
  /** Deslocamento/estilo da entrada: "up" suave ou "pop" saltitante (tema infantil). */
  style?: "up" | "pop";
};

/** Efeitos GSAP das vitrines. Respeita prefers-reduced-motion e limpa tudo ao sair. */
export function useStoreFx(scope: RefObject<HTMLElement | null>, { reveal, intro = [], style = "up" }: FxOptions) {
  useEffect(() => {
    const root = scope.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const from = style === "pop" ? { opacity: 0, y: 30, scale: 0.85 } : { opacity: 0, y: 26 };
    const ease = style === "pop" ? "back.out(1.7)" : "power3.out";
    const ctx = gsap.context(() => {
      intro.forEach((selector) => {
        const items = gsap.utils.toArray<HTMLElement>(selector);
        if (items.length) gsap.from(items, { ...from, duration: 0.7, stagger: 0.1, ease, clearProps: "all" });
      });
      reveal.forEach((selector) => {
        const items = gsap.utils.toArray<HTMLElement>(selector);
        if (!items.length) return;
        gsap.set(items, from);
        ScrollTrigger.batch(items, {
          start: "top 92%",
          once: true,
          onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.08, ease, overwrite: true, clearProps: "transform,opacity" }),
        });
      });
    }, root);
    const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 400);
    return () => {
      window.clearTimeout(refresh);
      ctx.revert();
    };
  }, [scope]);
}
