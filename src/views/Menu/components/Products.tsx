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
    <button type="button" aria-label={`Ver ${product.name}`} className={`mnu-item ${img ? "has-photo" : "no-photo"} ${available ? "" : "is-out"}`} disabled={!available} onClick={onOpen}>
      <div className="mnu-item-body">
        <strong>{product.name}</strong>
        {product.description ? <p>{product.description}</p> : null}
        <span className={`mnu-price ${promo ? "is-promo" : ""}`}>{money(unitPrice(product))}{promo && <s>{money(Number(product.price))}</s>}</span>
        {!available && <span className="mnu-badge">Esgotado</span>}
      </div>
      <div className="mnu-item-img">
        {img ? <img src={img} alt="" loading="lazy" /> : <div className="mnu-ph"><SI size={26} strokeWidth={1.3} /></div>}
        {available && <span className="mnu-add"><Plus size={18} /></span>}
      </div>
    </button>
  );
}

/** Destaques: carrossel de itens mais pedidos ou marcados como destaque. */
export function FeaturedRail({ products, categories, onOpen }: { products: MenuProduct[]; categories: MenuCategory[]; onOpen: (p: MenuProduct) => void }) {
  return (
    <section className="mnu-section" id="mnu-featured">
      <div className="mnu-sec-head"><span className="ic"><Flame size={17} strokeWidth={1.5} /></span><h2>Vale a escolha</h2><hr /><span className="cnt">Destaques da casa</span></div>
      <div className="mnu-rail">
        {products.map((p) => {
          const fs = catStyle(categories.find((c) => c.id === p.category_id)?.name);
          const FI = fs.icon;
          const img = imageOf(p);
          return (
            <button key={p.id} type="button" className={`mnu-feat ${img ? "has-photo" : "no-photo"}`} onClick={() => onOpen(p)}>
              <div className="mnu-feat-img">
                {img ? <img src={img} alt="" loading="lazy" /> : <div className="mnu-ph"><FI size={27} strokeWidth={1.3} /></div>}
              </div>
              <div className="mnu-feat-name">{p.name}</div>
              <span className="mnu-feat-price">{money(unitPrice(p))}</span>
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
    <Sheet label={product.name} className="mnu-product-sheet" onClose={onClose}>
      <div className={`mnu-sheet-top ${img ? "has-photo" : "no-photo"}`}>
        <button type="button" className="mnu-x" aria-label="Fechar" onClick={onClose}><X size={20} /></button>
        {img
          ? <div className="mnu-sheet-img"><img src={img} alt="" /></div>
          : <div className="mnu-sheet-img is-ph"><PI size={29} strokeWidth={1.3} /></div>}
      </div>
      <div className="mnu-sheet-body">
        <span className="mnu-eyebrow">{categories.find((category) => category.id === product.category_id)?.name || "No cardápio"}</span>
        <h3>{product.name}</h3>
        {product.description && <p>{product.description}</p>}
        <span className="mnu-price lg">{money(unitPrice(product))}</span>
        <label className="mnu-label">Alguma observação?
          <textarea className="mnu-textarea" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: sem gelo, bem gelada…" />
        </label>
      </div>
      <div className="mnu-foot" style={{ marginTop: 16 }}>
        <div className="mnu-qty">
          <button type="button" aria-label="Menos" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus size={16} /></button>
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
