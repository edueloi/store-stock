import { useEffect, type RefObject } from "react";
import { gsap } from "gsap";

/** Entrada em cascata do hero, mosaico que flutua e parallax leve. Respeita prefers-reduced-motion. */
export function useHeroMotion(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.from(".garden-hero-copy > *", { opacity: 0, y: 26, duration: 0.7, stagger: 0.09, ease: "power3.out", clearProps: "all" });
      gsap.from(".garden-blob", { opacity: 0, scale: 0.85, duration: 1, stagger: 0.15, ease: "back.out(1.4)", clearProps: "opacity,scale" });
      gsap.to(".garden-blob-b", { y: -12, duration: 3.2, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(".garden-blob-c", { y: 12, duration: 3.8, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(".garden-leaf-float", { rotate: 8, y: -8, duration: 3, repeat: -1, yoyo: true, ease: "sine.inOut", stagger: 0.4 });
    }, el);
    return () => ctx.revert();
  }, [root]);
}
