import { useEffect, type RefObject } from "react";
import { gsap } from "gsap";

/** Entrada em cascata do hero + zoom suave da imagem + parallax leve. Respeita prefers-reduced-motion. */
export function useHeroFx(ref: RefObject<HTMLElement | null>, key?: unknown) {
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-fx='copy'] > *", { opacity: 0, y: 26, duration: 0.7, stagger: 0.1, ease: "power3.out" });
      gsap.from("[data-fx='visual']", { opacity: 0, scale: 0.94, duration: 0.9, ease: "power3.out" });
      gsap.fromTo("[data-fx='visual'] img", { scale: 1.12 }, { scale: 1, duration: 1.6, ease: "power2.out" });
    }, el);
    const parallax = Array.from(el.querySelectorAll<HTMLElement>("[data-parallax]"));
    const onScroll = () => {
      const y = Math.min(window.scrollY, 600);
      parallax.forEach((n) => gsap.set(n, { y: y * 0.08 }));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      ctx.revert();
    };
  }, [ref, key]);
}
