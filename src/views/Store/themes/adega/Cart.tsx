import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, MessageCircle, Minus, Moon, Plus, ShoppingBag, Trash2, Wine, X } from "lucide-react";
import { availableUnits } from "../../../../utils/storeStock";
import { money, productImage, useKit, whatsappLink } from "./kit";
import { productRouteSegment } from "../../store-routing";
import "./styles.css";

type Props = {
  isOpen: boolean;
  checkout: ReactNode;
  onCheckout: () => void;
  busy: boolean;
  message?: string | null;
  checkoutMessage?: string | null;
};

/** Carrinho exclusivo da Adega, mantendo as modalidades de pedido configuradas pela loja. */
export default function AdegaCart({ isOpen, checkout, onCheckout, busy, message, checkoutMessage }: Props) {
  const { tenant, cart, cartCount, closeCart, updateQuantity, removeFromCart, path, hidden, tracks, sf } = useKit();
  const dialog = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const total = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const mode = sf.checkout_mode || "whatsapp";
  const unavailableContact = mode === "whatsapp" && !tenant.whatsapp?.replace(/\D/g, "");
  const handleCheckout = () => {
    if (mode !== "whatsapp") { onCheckout(); return; }
    const items = cart.map((item) => `${item.quantity}x ${item.name}${item.variationLabel ? ` (${item.variationLabel})` : ""}${hidden ? "" : `\n${money(Number(item.price))} por unidade · ${money(Number(item.price) * item.quantity)}`}`);
    const text = `Olá, ${tenant.name}! Gostaria de fazer um pedido:\n\n${items.join("\n\n")}\n\n${hidden ? "Valores a confirmar com a loja." : `Subtotal: ${money(total)}`}\n\nPor favor, confirme disponibilidade, entrega e pagamento.`;
    const url = whatsappLink(tenant.whatsapp, text);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };
  useEffect(() => {
    if (!isOpen || !checkout) return;
    const frame = window.requestAnimationFrame(() => dialog.current?.querySelector<HTMLInputElement>(".adg-cart-checkout input")?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, Boolean(checkout)]);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => dialog.current?.focus());
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCart();
      if (event.key !== "Tab") return;
      const nodes = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []).filter((node) => node.getClientRects().length > 0);
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keyboard);
    return () => { window.cancelAnimationFrame(frame); document.removeEventListener("keydown", keyboard); previous?.focus(); };
  }, [isOpen]);

  return <AnimatePresence>{isOpen && <div className="adg-cart-shell">
    <motion.div className="adg-cart-overlay" aria-hidden="true" onClick={closeCart} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .2 }} />
    <motion.div ref={dialog} className="adg-cart-dialog" role="dialog" aria-modal="true" aria-labelledby="adg-cart-title" tabIndex={-1} initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={reduced ? { duration: 0 } : { type: "spring", damping: 32, stiffness: 320 }}>
      <header className="adg-cart-top"><div><span className="adg-kicker"><Moon size={12} /> A noite começa aqui</span><h2 id="adg-cart-title">{sf.cart_title || "Sua sacola de bons momentos"}</h2><p>{cartCount} {cartCount === 1 ? "item escolhido" : "itens escolhidos"}</p></div><button type="button" className="adg-round" onClick={closeCart} aria-label="Fechar sacola"><X size={19} /></button></header>
      <div className="adg-cart-body">
        {cart.length ? <>
          <p className="adg-cart-intro"><Check size={15} /> Boa escolha. Confira os detalhes do seu pedido.</p>
          <div className="adg-cart-items">{cart.map((item) => {
            const photo = productImage(item);
            const units = tracks ? availableUnits(item, item.selectedOptions) : null;
            return <article className="adg-cart-product" key={item.cartItemId}>
              <Link to={path(`/produto/${productRouteSegment(item)}`)} onClick={closeCart} className="adg-cart-photo" aria-label={`Ver ${item.name}`}>{photo ? <img src={photo} alt={item.name} /> : <Wine size={32} strokeWidth={1.2} />}</Link>
              <div className="adg-cart-product-info"><Link to={path(`/produto/${productRouteSegment(item)}`)} onClick={closeCart}>{item.name}</Link>{item.variationLabel && <p>{item.variationLabel}</p>}<span className="adg-cart-unit">{hidden ? "Valor a confirmar" : `${money(Number(item.price))} por unidade`}</span><div className="adg-cart-product-bottom"><div className="adg-cart-stepper" role="group" aria-label={`Quantidade de ${item.name}`}><button type="button" aria-label={`Diminuir ${item.name}`} onClick={() => updateQuantity(item.cartItemId, -1)} disabled={item.quantity <= 1}><Minus size={13} /></button><output aria-live="polite">{item.quantity}</output><button type="button" aria-label={`Aumentar ${item.name}`} onClick={() => updateQuantity(item.cartItemId, 1)} disabled={units !== null && item.quantity >= units}><Plus size={13} /></button></div>{!hidden && <strong>{money(Number(item.price) * item.quantity)}</strong>}</div></div>
              <button type="button" className="adg-cart-remove" aria-label={`Remover ${item.name}`} onClick={() => removeFromCart(item.cartItemId)}><Trash2 size={15} /></button>
            </article>;
          })}</div>
          <button type="button" className="adg-cart-continue" onClick={closeCart}><Plus size={15} /> Adicionar mais um brinde</button>
          <div className="adg-cart-checkout">{checkout}</div>
        </> : <div className="adg-cart-empty"><span><ShoppingBag size={39} strokeWidth={1.1} /></span><span className="adg-kicker">Um bom momento está por vir</span><h3>Falta só escolher<br />o primeiro brinde.</h3><p>Explore a nossa seleção e coloque seus favoritos na sacola.</p><Link to={path("/catalogo")} onClick={closeCart} className="adg-btn">Descobrir o cardápio <ArrowRight size={17} /></Link></div>}
        {message && <p className="adg-cart-message" role="status">{message}</p>}
        {checkoutMessage && <p className="adg-cart-message" role="status">{checkoutMessage}</p>}
      </div>
      {cart.length > 0 && <footer className="adg-cart-summary">
        <div><span>Subtotal <small>{cartCount} {cartCount === 1 ? "item" : "itens"}</small></span><strong>{hidden ? "Sob consulta" : money(total)}</strong></div>
        <p>{mode === "reservation" ? `Reserva por ${Math.max(5, Math.min(120, sf.reservation_minutes || 20))} minutos. Entrega e pagamento a combinar.` : "Entrega e pagamento confirmados com a adega."}</p>
        {checkout ? <p className="adg-cart-checkout-hint">Preencha os dados acima para confirmar o pedido.</p> : <button type="button" className="adg-btn" onClick={handleCheckout} disabled={busy || Boolean(unavailableContact)}>{mode === "whatsapp" ? <MessageCircle size={18} /> : <ShoppingBag size={18} />}{busy ? "Reservando..." : mode === "reservation" ? "Reservar minha seleção" : mode === "online" ? "Continuar meu pedido" : mode === "order_request" ? "Solicitar meu pedido" : "Pedir pelo WhatsApp"}<ArrowRight size={17} /></button>}
        {unavailableContact && <p role="status">O contato da loja ainda não foi configurado.</p>}
        <button type="button" className="adg-cart-back" onClick={closeCart}><ArrowLeft size={13} /> Continuar escolhendo</button>
        <span className="adg-cart-responsible">18+ · Bons momentos pedem responsabilidade.</span>
      </footer>}
    </motion.div>
  </div>}</AnimatePresence>;
}
