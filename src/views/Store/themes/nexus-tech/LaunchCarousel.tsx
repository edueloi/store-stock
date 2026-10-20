import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Product } from "../../../../types";
import { Card } from "./parts";

/** Avança um produto por vez; leitura, interação e movimento reduzido pausam o automático. */
export default function LaunchCarousel({ products }: { products: Product[] }) {
  const rail = useRef<HTMLDivElement>(null);
  const region = useRef<HTMLDivElement>(null);
  const interactedUntil = useRef(0);
  const [overflow, setOverflow] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const update = () => setOverflow(element.scrollWidth > element.clientWidth + 2);
    const observer = new ResizeObserver(update);
    observer.observe(element); update();
    return () => observer.disconnect();
  }, [products.length]);
  useEffect(() => {
    const element = region.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .2 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const move = useCallback((direction: number, manual = false) => {
    const element = rail.current;
    const first = element?.firstElementChild as HTMLElement | null;
    if (!element || !first) return;
    if (manual) interactedUntil.current = Date.now() + 8000;
    const step = first.getBoundingClientRect().width + (parseFloat(getComputedStyle(element).columnGap) || 0);
    const max = element.scrollWidth - element.clientWidth;
    const next = direction > 0
      ? element.scrollLeft >= max - 2 ? 0 : Math.min(element.scrollLeft + step, max)
      : element.scrollLeft <= 2 ? max : Math.max(element.scrollLeft - step, 0);
    element.scrollTo({ left: next, behavior: reduced ? "auto" : "smooth" });
  }, [reduced]);

  useEffect(() => {
    if (reduced || !overflow || !visible || hovered || focused) return;
    const timer = window.setInterval(() => {
      if (!document.hidden && Date.now() >= interactedUntil.current) move(1);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [reduced, overflow, visible, hovered, focused, move]);

  return (
    <div className="nx-launch-carousel" ref={region} role="region" aria-roledescription="carrossel" aria-label="Lançamentos"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}
      onPointerDown={() => { interactedUntil.current = Date.now() + 8000; }}>
      {overflow && <button className="nx-launch-arrow nx-launch-prev" type="button" aria-label="Lançamento anterior" onClick={() => move(-1, true)}><ChevronLeft size={20} /></button>}
      <div className="nx-rail" ref={rail} data-no-fx>
        {products.map((product, index) => <div key={product.id} className="nx-rail-item" role="group" aria-roledescription="slide" aria-label={`${index + 1} de ${products.length}`}><Card product={product} /></div>)}
      </div>
      {overflow && <button className="nx-launch-arrow nx-launch-next" type="button" aria-label="Próximo lançamento" onClick={() => move(1, true)}><ChevronRight size={20} /></button>}
    </div>
  );
}
