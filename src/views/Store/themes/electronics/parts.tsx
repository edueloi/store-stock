import { Link } from "react-router-dom";
import {
  Camera, Cable, Cpu, Gamepad2, Headphones, HardDrive, Laptop, Monitor, Package, Printer, ShoppingCart, Smartphone, Speaker, Tv, Wifi, Zap,
} from "lucide-react";
import type { ComponentType } from "react";
import type { Product, Tenant } from "../../../../types";
import { imageOf, inStock, money, priceInfo, productHref, useKit, variationGroups } from "./kit";
import { availableUnits } from "../../../../utils/storeStock";
import { StoreButton } from "../../../../components/store/StoreButton";

type Icon = ComponentType<{ size?: number; strokeWidth?: number }>;
const DEPT_ICONS: [string[], Icon][] = [
  [["celular", "smartphone", "telefone", "tablet", "iphone"], Smartphone],
  [["notebook", "laptop"], Laptop],
  [["computador", "pc", "desktop", "informática", "informatica", "gabinete", "placa"], Cpu],
  [["monitor", "projetor", "display"], Monitor],
  [["tv", "televis", "smart tv"], Tv],
  [["fone", "headphone", "audio", "áudio", "headset"], Headphones],
  [["caixa", "som", "speaker", "alexa", "receiver"], Speaker],
  [["camera", "câmera", "foto", "filmadora"], Camera],
  [["wifi", "rede", "roteador", "internet"], Wifi],
  [["hd", "ssd", "memória", "memoria", "pen", "armazen"], HardDrive],
  [["game", "gamer", "console", "ps5", "controle", "xbox"], Gamepad2],
  [["cabo", "carregador", "fonte", "adaptador", "energia"], Cable],
  [["impressora", "toner", "cartucho"], Printer],
];
export function deptIcon(name: string): Icon {
  const n = name.toLowerCase();
  for (const [keys, icon] of DEPT_ICONS) if (keys.some((k) => n.includes(k))) return icon;
  return Cpu;
}

/** Parcelamento derivado do preço e das regras da loja — nada inventado. */
export function installmentText(tenant: Tenant, price: number): string | null {
  let n = Math.min(Number(tenant.max_installments) || 0, 12);
  if (n < 2 || tenant.payment_methods?.credit_card === false || price <= 0) return null;
  while (n > 1 && price / n < 5) n--;
  if (n < 2) return null;
  if (tenant.pass_fee_to_customer) return `em até ${n}x no cartão`;
  return `ou até ${n}x de ${money(price / n)} no cartão`;
}

export function Card({ product, compare, list = false }: { product: Product; compare?: { on: boolean; disabled: boolean; toggle: () => void }; list?: boolean }) {
  const { tenant, addToCart, openCart, cart, path, hidePrices, tracks } = useKit();
  const info = priceInfo(product);
  const img = imageOf(product);
  const remaining = tracks ? availableUnits(product) : null;
  const already = cart.filter((item) => item.id === product.id).reduce((total, item) => total + item.quantity, 0);
  const has = inStock(product, tenant) && (remaining === null || remaining > already);
  const needsOptions = variationGroups(product).length > 0;
  const href = productHref(path, product);
  const inst = hidePrices ? null : installmentText(tenant, info.price);
  return (
    <article className={`elx-card${list ? " is-list" : ""}`}>
      <Link to={href} className="elx-card-img" aria-label={product.name} tabIndex={-1}>
        {img ? <img src={img} alt="" loading="lazy" /> : <Package size={38} strokeWidth={1.2} />}
        {info.hasDiscount && !hidePrices && <span className="elx-off">-{info.pct}%</span>}
        {!has && <span className="elx-out">Esgotado</span>}
      </Link>
      <div className="elx-card-body">
        <Link to={href} className="elx-card-name">{product.name}</Link>
        {product.sku && <span className="elx-card-sku">Cód. {product.sku}</span>}
        {hidePrices ? (
          <p className="elx-price-ask">Sob consulta</p>
        ) : (
          <div className="elx-price">
            {info.hasDiscount && <s>{money(info.full)}</s>}
            <strong>{money(info.price)}</strong>
            <small>à vista</small>
            {inst && <span className="elx-inst">{inst}</span>}
          </div>
        )}
        <div className="elx-card-actions">
          {needsOptions || !has ? (
            <StoreButton asChild variant="outline" size="sm" className="elx-btn elx-btn-ghost"><Link to={href}>{has ? "Escolher opções" : "Ver produto"}</Link></StoreButton>
          ) : (
            <StoreButton size="sm" className="elx-btn" onClick={() => { addToCart(product); openCart(); }}><ShoppingCart size={16} /> {hidePrices ? "Incluir no pedido" : "Adicionar"}</StoreButton>
          )}
        </div>
        {compare && (
          <label className={`elx-compare${compare.on ? " is-on" : ""}`}>
            <input type="checkbox" checked={compare.on} disabled={compare.disabled && !compare.on} onChange={compare.toggle} />
            <span>Comparar produtos</span>
          </label>
        )}
      </div>
    </article>
  );
}

export function Empty({ title, text, to, action }: { title: string; text: string; to?: string; action?: string }) {
  return (
    <div className="elx-empty">
      <Zap size={36} strokeWidth={1.4} />
      <h2>{title}</h2>
      <p>{text}</p>
      {to && action && <Link to={to} className="elx-btn elx-btn-inline">{action}</Link>}
    </div>
  );
}
