import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Minus, Package, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useStore } from "../../StoreLayout";
import { productRouteSegment } from "../../store-routing";
import { availableUnits, storeTracksStock } from "../../../../utils/storeStock";
import { imageOf, money, pricesHidden, useTheme } from "./lib";
import "./mvs.css";

type Props = { isOpen: boolean; checkout: ReactNode; onCheckout: () => void; busy: boolean; message?: string | null; checkoutMessage?: string | null };
export default function MvsCart({ isOpen, checkout, onCheckout, busy, message, checkoutMessage }: Props) {
  const { tenant, cart, closeCart, updateQuantity, removeFromCart } = useStore(), { path } = useTheme();
  const dialog = useRef<HTMLElement>(null), sf = tenant.policies?.storefront || {}, mode = sf.checkout_mode || "whatsapp";
  const hidden = pricesHidden(tenant), count = cart.reduce((sum, item) => sum + item.quantity, 0), total = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => dialog.current?.focus());
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCart();
      if (event.key !== "Tab") return;
      const nodes = Array.from(dialog.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]') || []).filter(node => node.getClientRects().length > 0);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("keydown", key); if (previous?.isConnected) previous.focus(); };
  }, [isOpen]);
  useEffect(() => { if (!isOpen || !checkout) return; const frame = requestAnimationFrame(() => dialog.current?.querySelector<HTMLInputElement>("input")?.focus()); return () => cancelAnimationFrame(frame); }, [isOpen, Boolean(checkout)]);
  if (!isOpen) return null;
  return <div className="mvs-bag-layer"><div className="mvs-bag-backdrop" aria-hidden="true" onClick={closeCart}/><aside className="mvs-bag-panel" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="mvs-bag-title" tabIndex={-1}><header className="mvs-bag-heading"><div><span>BOAS ESCOLHAS, BEM AQUI.</span><h2 id="mvs-bag-title">Sua sacola <small>{count}</small></h2></div><button type="button" aria-label="Fechar sacola" onClick={closeCart}><X size={22}/></button></header>
    {cart.length ? <><div className="mvs-bag-scroll"><p className="mvs-bag-intro"><ShoppingBag size={16}/>Confira sua seleção antes de continuar.</p>{cart.map(item => {
      const image = imageOf(item), units = storeTracksStock(tenant) ? availableUnits(item, item.selectedOptions) : null, href = path(`/produto/${productRouteSegment(item)}`);
      return <article className="mvs-bag-item" key={item.cartItemId}><Link className="mvs-bag-photo" to={href} onClick={closeCart} aria-label={`Ver ${item.name}`}>{image ? <img src={image} alt=""/> : <Package size={32}/>}</Link><div className="mvs-bag-item-info"><Link to={href} onClick={closeCart}><h3>{item.name}</h3></Link>{item.variationLabel && <p>{item.variationLabel}</p>}<strong>{hidden ? "Sob consulta" : money(Number(item.price))}</strong><div className="mvs-bag-item-actions"><div className="mvs-bag-quantity" role="group" aria-label={`Quantidade de ${item.name}`}><button type="button" aria-label={`Diminuir ${item.name}`} disabled={item.quantity <= 1} onClick={() => updateQuantity(item.cartItemId, -1)}><Minus size={13}/></button><output aria-live="polite">{item.quantity}</output><button type="button" aria-label={`Aumentar ${item.name}`} disabled={units !== null && item.quantity >= units} onClick={() => updateQuantity(item.cartItemId, 1)}><Plus size={13}/></button></div><button type="button" className="mvs-bag-remove" aria-label={`Remover ${item.name}`} onClick={() => removeFromCart(item.cartItemId)}><Trash2 size={14}/></button></div></div></article>;
    })}<button type="button" className="mvs-bag-continue" onClick={closeCart}>Continuar escolhendo<ArrowRight size={15}/></button>{checkout && <div className="mvs-bag-checkout">{checkout}</div>}{message && <p className="mvs-bag-message" role="status">{message}</p>}{checkoutMessage && <p className="mvs-bag-message" role="status">{checkoutMessage}</p>}</div><footer className="mvs-bag-summary"><div><span>Subtotal</span><strong>{hidden ? "Sob consulta" : money(total)}</strong></div><p>Entrega e pagamento conforme as opções da loja.</p>{checkout ? <p>Preencha seus dados acima para continuar o pedido.</p> : <button type="button" className="mvs-solid-button" disabled={busy || mode === "whatsapp" && !tenant.whatsapp?.replace(/\D/g, "")} onClick={onCheckout}>{busy ? "Aguarde..." : mode === "reservation" ? "Reservar meus produtos" : mode === "online" ? "Continuar para checkout" : mode === "order_request" ? "Solicitar meu pedido" : "Pedir pelo WhatsApp"}<ArrowRight size={18}/></button>}{mode === "whatsapp" && !tenant.whatsapp && <p role="status">O contato da loja ainda não foi configurado.</p>}</footer></> : <div className="mvs-bag-empty"><span><ShoppingBag size={38} strokeWidth={1}/></span><small>ENCONTRE SUA PRÓXIMA SOLUÇÃO</small><h3>Tem muita coisa boa<br/>esperando por você.</h3><p>Sua sacola ainda está vazia. Explore o catálogo para começar sua seleção.</p><Link className="mvs-solid-button" to={path("/catalogo")} onClick={closeCart}>Explorar a loja<ArrowRight size={17}/></Link></div>}
    </aside></div>;
}
