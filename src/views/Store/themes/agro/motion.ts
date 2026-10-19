import { useEffect, type RefObject } from "react";
import { gsap } from "gsap";

/** Entrada em cascata do hero + zoom/parallax leve da imagem. Respeita prefers-reduced-motion. */
export function useHeroMotion(root: RefObject<HTMLElement | null>, copy = ".agro-hero-card > *", media = ".agro-hero-pic img") {
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from(copy, { opacity: 0, y: 26, duration: 0.7, stagger: 0.09, ease: "power3.out", clearProps: "all" });
      gsap.fromTo(media, { scale: 1.12 }, { scale: 1, duration: 1.6, ease: "power2.out" });
    }, el);
    const onScroll = () => {
      const img = el.querySelector<HTMLElement>(media);
      if (img) img.style.translate = `0 ${Math.min(window.scrollY, 600) * 0.06}px`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      ctx.revert();
    };
  }, [root, copy, media]);
}
