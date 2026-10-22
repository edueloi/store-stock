import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { Product } from "../../../../types";
import Card from "./Card";

const columnsForViewport = () => window.innerWidth <= 640 ? 2 : window.innerWidth <= 1100 ? 3 : 4;
const AUTOPLAY_MS = 5000;

export default function ProductCarousel({ products, label, ranked = false }: { products: Product[]; label: string; ranked?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(columnsForViewport);
  const visible = Math.min(columns, products.length);
  const count = products.length;
  const [position, setPosition] = useState(visible);
  const [transition, setTransition] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const moving = useRef(false);
  const frame = useRef(0);
  const secondFrame = useRef(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const current = count ? ((position - visible) % count + count) % count : 0;

  const enableTransition = () => {
    cancelAnimationFrame(frame.current);
    cancelAnimationFrame(secondFrame.current);
    frame.current = requestAnimationFrame(() => {
      secondFrame.current = requestAnimationFrame(() => setTransition(true));
    });
  };

  useLayoutEffect(() => {
    moving.current = false;
    setTransition(false);
    setPosition(visible);
    enableTransition();
    return () => { cancelAnimationFrame(frame.current); cancelAnimationFrame(secondFrame.current); };
  }, [visible, count, reduced]);

  useEffect(() => {
    const resize = () => setColumns(columnsForViewport());
    const visibility = () => setHidden(document.hidden);
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motionChange = () => setReduced(preference.matches);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", visibility);
    preference.addEventListener("change", motionChange);
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: .15 });
    if (root.current) observer.observe(root.current);
    return () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibility);
      preference.removeEventListener("change", motionChange);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (count < 2 || reduced || paused || hovered || focused || hidden || !inView) return;
    const timer = window.setTimeout(() => {
      moving.current = true;
      setPosition((value) => value + 1);
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [current, count, reduced, paused, hovered, focused, hidden, inView]);

  const go = (next: number) => {
    if (moving.current || count < 2) return;
    moving.current = !reduced;
    setPosition(reduced ? visible + ((next - visible) % count + count) % count : next);
  };

  if (!count) return null;
  const items = count > 1 ? [
    ...products.slice(-visible).map((product, i) => ({ product, rank: count - visible + i + 1 })),
    ...products.map((product, i) => ({ product, rank: i + 1 })),
    ...products.slice(0, visible).map((product, i) => ({ product, rank: i + 1 })),
  ] : [{ product: products[0], rank: 1 }];
  const offset = count > 1 ? position : 0;

  return <div ref={root} className="gd-carousel" role="region" aria-roledescription="carrossel" aria-label={label}
    style={{ "--gd-carousel-columns": visible, "--gd-carousel-position": offset } as CSSProperties}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}>
    <div className="gd-carousel-viewport"
      onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => {
        if (!touch.current) return;
        const dx = e.changedTouches[0].clientX - touch.current.x;
        const dy = e.changedTouches[0].clientY - touch.current.y;
        touch.current = null;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(position + (dx < 0 ? 1 : -1));
      }} onTouchCancel={() => { touch.current = null; }}>
      <div className={`gd-carousel-track${transition && !reduced ? " gd-carousel-animated" : ""}`}
        onTransitionEnd={(e) => {
          if (e.target !== e.currentTarget || e.propertyName !== "transform") return;
          moving.current = false;
          if (position >= count + visible || position < visible) {
            setTransition(false);
            setPosition(visible + current);
            enableTransition();
          }
        }}>
        {items.map(({ product, rank }, i) => {
          const active = i >= offset && i < offset + visible;
          return <div key={`${i}-${product.id}`} className="gd-carousel-item" aria-hidden={!active} inert={!active}>
            <Card product={product} rank={ranked ? rank : undefined} />
          </div>;
        })}
      </div>
    </div>
    {count > 1 && <div className="gd-carousel-controls">
      <button type="button" className="gd-carousel-arrow" aria-label={`Produto anterior em ${label}`} onClick={() => go(position - 1)}><ChevronLeft size={17} /></button>
      <div className="gd-carousel-dots" role="group" aria-label={`Posições de ${label}`}>
        {products.map((product, i) => <button key={product.id} type="button" aria-label={`Mostrar a partir do produto ${i + 1} em ${label}`} aria-current={current === i ? "true" : undefined} onClick={() => { if (i !== current) go(visible + i); }}><span /></button>)}
      </div>
      <button type="button" className="gd-carousel-arrow" aria-label={`Próximo produto em ${label}`} onClick={() => go(position + 1)}><ChevronRight size={17} /></button>
      {!reduced && <button type="button" className="gd-carousel-play" aria-label={`${paused ? "Retomar" : "Pausar"} rotação automática em ${label}`} aria-pressed={paused} onClick={() => setPaused((value) => !value)}>{paused ? <Play size={13} /> : <Pause size={13} />}</button>}
    </div>}
  </div>;
}
