import { useEffect, type RefObject } from "react";
import { gsap } from "gsap";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Entrada em cascata dos elementos `[data-hero]` e parallax suave de `[data-parallax]`
 * dentro do hero. Respeita prefers-reduced-motion e limpa tudo ao desmontar.
 */
export function useHeroMotion(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el || reduced()) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-hero]", { opacity: 0, y: 28, duration: 0.7, stagger: 0.1, ease: "power3.out" });
      gsap.from("[data-parallax]", { scale: 1.12, opacity: 0, duration: 1.1, ease: "power2.out" });
    }, el);
    const target = el.querySelector<HTMLElement>("[data-parallax]");
    const move = (e: PointerEvent) => {
      if (!target) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      gsap.to(target, { x: x * 16, y: y * 12, duration: 0.8, ease: "power2.out", overwrite: "auto" });
    };
    el.addEventListener("pointermove", move);
    return () => {
      el.removeEventListener("pointermove", move);
      ctx.revert();
    };
  }, [root]);
}

/** Setas que rolam um carrossel horizontal com scroll-snap. */
export function scrollByCard(el: HTMLElement | null, dir: 1 | -1) {
  if (!el) return;
  el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: reduced() ? "auto" : "smooth" });
}
