import { useState } from "react";
import { Flame, Minus, Plus, X } from "lucide-react";
import type { MenuCategory, MenuProduct } from "../menuTypes";
import { catStyle, imageOf, money, unitPrice } from "../menuTypes";
import { Sheet } from "./parts";

/** Card do produto: linha com miniatura no celular, card com foto grande no tablet/computador. */
export function ProductCard({ product, available, style, onOpen }: {
  product: MenuProduct;
  available: boolean;
  style: ReturnType<typeof catStyle>;
  onOpen: () => void;
}) {
  const SI = style.icon;
  const promo = product.discount_price != null && Number(product.discount_price) < Number(product.price);
  const img = imageOf(product);
  return (
    <button type="button" className={`mnu-item ${available ? "" : "is-out"}`} disabled={!available} onClick={onOpen}>
      <div className="mnu-item-body">
        <strong>{product.name}</strong>
        {product.description ? <p>{product.description}</p> : null}
        <span className={`mnu-price ${promo ? "is-promo" : ""}`}>{money(unitPrice(product))}{promo && <s>{money(Number(product.price))}</s>}</span>
        {!available && <span className="mnu-badge">Esgotado</span>}
      </div>
      <div className="mnu-item-img">
        {img ? <img src={img} alt="" loading="lazy" /> : <div className="mnu-ph" style={{ background: style.tint, color: style.fg }}><SI size={34} strokeWidth={1.6} /></div>}
        {available && <span className="mnu-add"><Plus size={18} /></span>}
      </div>
    </button>
  );
}

/** Destaques: carrossel de itens mais pedidos ou marcados como destaque. */
export function FeaturedRail({ products, categories, onOpen }: { products: MenuProduct[]; categories: MenuCategory[]; onOpen: (p: MenuProduct) => void }) {
  return (
    <section className="mnu-section" id="mnu-featured">
      <div className="mnu-sec-head"><span className="ic" style={{ background: "#ffe6d3", color: "#ea580c" }}><Flame size={16} /></span><h2>Destaques</h2><hr /></div>
      <div className="mnu-rail">
        {products.map((p) => {
          const fs = catStyle(categories.find((c) => c.id === p.category_id)?.name);
          const FI = fs.icon;
          const img = imageOf(p);
          return (
            <button key={p.id} type="button" className="mnu-feat" onClick={() => onOpen(p)}>
              <div className="mnu-feat-img" style={img ? undefined : { background: fs.tint }}>
                {img ? <img src={img} alt="" loading="lazy" /> : <div className="mnu-ph big" style={{ color: fs.fg }}><FI size={46} strokeWidth={1.5} /></div>}
                <span className="mnu-feat-price" style={img ? undefined : { color: fs.fg, textShadow: "none" }}>{money(unitPrice(p))}</span>
              </div>
              <div className="mnu-feat-name">{p.name}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Folha do produto: foto, descrição, observação e quantidade. */
export function ProductSheet({ product, categories, onAdd, onClose }: {
  product: MenuProduct;
  categories: MenuCategory[];
  onAdd: (qty: number, note: string) => void;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const ps = catStyle(categories.find((c) => c.id === product.category_id)?.name);
  const PI = ps.icon;
  const img = imageOf(product);
  return (
    <Sheet label={product.name} onClose={onClose}>
      <div className="mnu-sheet-top">
        <button type="button" className="mnu-x" aria-label="Fechar" onClick={onClose}><X size={20} /></button>
        {img
          ? <div className="mnu-sheet-img"><img src={img} alt="" /></div>
          : <div className="mnu-sheet-img is-ph" style={{ background: ps.tint, color: ps.fg }}><PI size={58} strokeWidth={1.4} /></div>}
      </div>
      <div className="mnu-sheet-body">
        <h3>{product.name}</h3>
        {product.description && <p>{product.description}</p>}
        <span className="mnu-price lg">{money(unitPrice(product))}</span>
        <label className="mnu-label">Alguma observação?
          <textarea className="mnu-textarea" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: sem gelo, bem gelada…" />
        </label>
      </div>
      <div className="mnu-foot" style={{ marginTop: 16 }}>
        <div className="mnu-qty">
          <button type="button" aria-label="Menos" onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus size={16} /></button>
          <b>{qty}</b>
          <button type="button" aria-label="Mais" onClick={() => setQty((q) => Math.min(50, q + 1))}><Plus size={16} /></button>
        </div>
        <button type="button" className="mnu-cta" onClick={() => onAdd(qty, note)}>
          <span>Adicionar</span><span>{money(unitPrice(product) * qty)}</span>
        </button>
      </div>
    </Sheet>
  );
}
