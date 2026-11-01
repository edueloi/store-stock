import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Headphones, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { availableUnits, storeTracksStock } from "../../../../utils/storeStock";
import { money, productImage, useKit } from "./kit";
import "./styles.css";
import "./upgrade.css";

type Props = { isOpen: boolean; checkout: ReactNode; onCheckout: () => void; busy: boolean; message?: string | null; checkoutMessage?: string | null };
export default function GadgetCart({ isOpen, checkout, onCheckout, busy, message, checkoutMessage }: Props) {
  const { tenant, cart, cartCount, closeCart, updateQuantity, removeFromCart, productPath, path, hidden, sf } = useKit();
  const dialog = useRef<HTMLElement>(null), mode = sf.checkout_mode || "whatsapp";
  const total = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
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
  useEffect(() => {
    if (!isOpen || !checkout) return;
    const frame = requestAnimationFrame(() => dialog.current?.querySelector<HTMLInputElement>("input")?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isOpen, Boolean(checkout)]);
  if (!isOpen) return null;
  return <div className="gd-cart-layer"><div className="gd-cart-backdrop" aria-hidden="true" onClick={closeCart}/><aside className="gd-cart-panel" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="gd-cart-title" tabIndex={-1}><header className="gd-cart-heading"><div><span>SEU PRÓXIMO UPGRADE</span><h2 id="gd-cart-title">Seu carrinho <small>{cartCount}</small></h2></div><button type="button" aria-label="Fechar carrinho" onClick={closeCart}><X size={22}/></button></header>
    {cart.length ? <><div className="gd-cart-scroll"><p className="gd-cart-intro"><ShoppingBag size={16}/>Confira os produtos da sua seleção.</p><div className="gd-cart-products">{cart.map(item => {
      const photo = productImage(item), units = storeTracksStock(tenant) ? availableUnits(item, item.selectedOptions) : null;
      return <article className="gd-cart-product" key={item.cartItemId}><Link className="gd-cart-photo" to={productPath(item)} onClick={closeCart} aria-label={`Ver ${item.name}`}>{photo ? <img src={photo} alt=""/> : <Headphones size={30}/>}</Link><div className="gd-cart-product-info"><Link to={productPath(item)} onClick={closeCart}><h3>{item.name}</h3></Link>{item.variationLabel && <p>{item.variationLabel}</p>}<strong>{hidden ? "Sob consulta" : money(Number(item.price))}</strong><div className="gd-cart-product-bottom"><div className="gd-cart-stepper" role="group" aria-label={`Quantidade de ${item.name}`}><button type="button" aria-label={`Diminuir ${item.name}`} disabled={item.quantity <= 1} onClick={() => updateQuantity(item.cartItemId, -1)}><Minus size={13}/></button><output aria-live="polite">{item.quantity}</output><button type="button" aria-label={`Aumentar ${item.name}`} disabled={units !== null && item.quantity >= units} onClick={() => updateQuantity(item.cartItemId, 1)}><Plus size={13}/></button></div><button className="gd-cart-remove" type="button" aria-label={`Remover ${item.name}`} onClick={() => removeFromCart(item.cartItemId)}><Trash2 size={14}/></button></div></div></article>;
    })}</div><button className="gd-cart-continue" type="button" onClick={closeCart}>Continuar explorando<ArrowRight size={15}/></button>{checkout && <div className="gd-cart-checkout">{checkout}</div>}{message && <p className="gd-cart-message" role="status">{message}</p>}{checkoutMessage && <p className="gd-cart-message" role="status">{checkoutMessage}</p>}</div><footer className="gd-cart-summary"><div><span>Subtotal</span><strong>{hidden ? "Sob consulta" : money(total)}</strong></div><p>Entrega e pagamento conforme as opções da loja.</p>{checkout ? <p>Preencha os dados acima para continuar seu pedido.</p> : <button type="button" className="gd-btn gd-btn-electric" disabled={busy || (mode === "whatsapp" && !tenant.whatsapp?.replace(/\D/g, ""))} onClick={onCheckout}>{busy ? "Aguarde..." : mode === "reservation" ? "Reservar meus produtos" : mode === "online" ? "Continuar para checkout" : mode === "order_request" ? "Solicitar meu pedido" : "Pedir pelo WhatsApp"}<ArrowRight size={18}/></button>}{mode === "whatsapp" && !tenant.whatsapp && <p role="status">O contato da loja ainda não foi configurado.</p>}</footer></> : <div className="gd-cart-empty"><div><ShoppingBag size={38} strokeWidth={1}/></div><span>AINDA HÁ MUITO PARA DESCOBRIR</span><h3>Seu próximo favorito<br/>está por aqui.</h3><p>Seu carrinho está vazio. Explore o catálogo para começar sua seleção.</p><Link className="gd-btn gd-btn-electric" to={path("/catalogo")} onClick={closeCart}>Explorar a loja<ArrowRight size={17}/></Link></div>}
    </aside></div>;
}
