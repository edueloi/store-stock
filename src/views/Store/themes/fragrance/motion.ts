import { useEffect, type RefObject } from "react";
import { gsap } from "gsap";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Microinterações do hero: entrada em cascata dos elementos [data-in] e parallax leve
 * da imagem [data-parallax] ao mover o mouse. Respeita prefers-reduced-motion.
 */
export function useHeroMotion(root: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const el = root.current;
    if (!el || reduced()) return;
    const ctx = gsap.context(() => {
      const items = el.querySelectorAll("[data-in]");
      if (items.length) gsap.fromTo(items, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.12, ease: "power3.out", delay: 0.1 });
      const art = el.querySelector<HTMLElement>("[data-parallax]");
      if (art) gsap.fromTo(art, { scale: 1.06 }, { scale: 1, duration: 1.6, ease: "power2.out" });
    }, el);
    const art = el.querySelector<HTMLElement>("[data-parallax]");
    const move = (e: MouseEvent) => {
      if (!art) return;
      const r = el.getBoundingClientRect();
      gsap.to(art, { x: ((e.clientX - r.left) / r.width - 0.5) * -14, y: ((e.clientY - r.top) / r.height - 0.5) * -10, duration: 0.8, ease: "power2.out", overwrite: "auto" });
    };
    el.addEventListener("mousemove", move);
    return () => {
      el.removeEventListener("mousemove", move);
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Rola um carrossel horizontal (scroll-snap) em passos. */
export function scrollRail(el: HTMLElement | null, dir: 1 | -1) {
  el?.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: reduced() ? "auto" : "smooth" });
}
