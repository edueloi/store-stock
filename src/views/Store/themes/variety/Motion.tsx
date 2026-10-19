import { useEffect, useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { gsap } from "gsap";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Entrada em cascata dos filhos diretos do hero padrão. */
export function HeroCascade({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!ref.current || reduced()) return;
    const ctx = gsap.context(() => {
      gsap.from(ref.current!.children, { opacity: 0, y: 24, scale: 0.97, duration: 0.7, stagger: 0.12, ease: "power3.out", clearProps: "all" });
    }, ref);
    return () => ctx.revert();
  }, []);
  return <section ref={ref} className={className}>{children}</section>;
}

/** Faixa contínua de selos de confiança (decorativa, fora do reveal global). */
export function Marquee({ items }: { items: string[] }) {
  const doubled = [...items, ...items];
  return (
    <div className="variety-marquee" data-no-fx aria-hidden="true">
      <div className="variety-marquee-track">
        {doubled.map((text, i) => <span key={`${text}-${i}`}>{text}</span>)}
      </div>
    </div>
  );
}

/** Faixa horizontal com scroll-snap e setas. */
export function SnapStrip({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduced() ? "auto" : "smooth" });
  };
  return (
    <div className="variety-snap">
      <button type="button" className="variety-snap-arrow variety-snap-prev" aria-label={`${label}: anterior`} onClick={() => scroll(-1)}><ChevronLeft size={20} /></button>
      <div ref={ref} className="variety-cat-strip" role="list" data-no-fx>{children}</div>
      <button type="button" className="variety-snap-arrow variety-snap-next" aria-label={`${label}: próximo`} onClick={() => scroll(1)}><ChevronRight size={20} /></button>
    </div>
  );
}
