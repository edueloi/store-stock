import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Phone, ShoppingBag, Store, User, UtensilsCrossed } from "lucide-react";
import type { CartLine, MenuConfig, OrderMode, PayMethod, Receive, Route } from "../menuTypes";
import { money } from "../menuTypes";
import { Qty, SheetHead } from "./parts";

export interface BagForm { name: string; phone: string; cep: string; street: string; number: string; district: string; complement: string; reference: string; note: string }

export interface BagContext {
  route: Route;
  mode: OrderMode;
  mesa: string;
  gate: { name: string; phone: string; people: number } | null;
  cfg: MenuConfig;
  accepts: { mesa: boolean; balcao: boolean; delivery: boolean; pickup: boolean };
  cart: CartLine[];
  subtotal: number;
  fee: number;
  total: number;
  baseFee: number | null;
  quote: { status: "idle" | "loading" | "ok" | "error"; message?: string; distance?: number };
  minOrder: number;
  freeAbove: number;
  hoods: Array<{ name?: string; fee?: number }>;
  payAllowed: { pix: boolean; money: boolean; card: boolean };
  receiveNow: Receive;
  setReceive: (r: Receive) => void;
  form: BagForm;
  setForm: (patch: Partial<BagForm>) => void;
  pay: PayMethod;
  setPay: (p: PayMethod) => void;
  changeFor: string;
  setChangeFor: (v: string) => void;
  error: string | null;
  sending: boolean;
  canSubmit: boolean;
  submit: () => void;
  done: null | { title: string; text: string; wa?: string };
  resetDone: () => void;
  changeQty: (key: string, delta: number) => void;
}

/** Sacola + fechamento do pedido. Em folha (celular/tablet) ou fixa na lateral (computador). */
export function Bag({ ctx, onClose, inline }: { ctx: BagContext; onClose?: () => void; inline?: boolean }) {
  const { mode, route, cfg, form, setForm } = ctx;
  const delivery = cfg.delivery || {};
  const [details, setDetails] = useState(false);
  useEffect(() => { if (!ctx.cart.length) setDetails(false); }, [ctx.cart.length]);
  const title = route === "mesa" ? `Pedido da mesa ${ctx.mesa}` : route === "balcao" ? "Pedido do balcão" : "Seu pedido";

  if (ctx.done) {
    return (
      <div className="mnu-done">
        <div className="ok"><Check size={34} /></div>
        <h3>{ctx.done.title}</h3>
        <p>{ctx.done.text}</p>
        {ctx.done.wa && <a className="mnu-btn" href={ctx.done.wa} target="_blank" rel="noreferrer"><Phone size={16} />Falar com a loja</a>}
        <button type="button" className="mnu-btn is-ghost" onClick={() => { ctx.resetDone(); onClose?.(); }}>{inline ? "Fazer novo pedido" : "Voltar ao cardápio"}</button>
      </div>
    );
  }

  return (
    <div className={inline ? "mnu-bag is-inline" : "mnu-bag"}>
      {inline
        ? <div className="mnu-bag-head"><div><span className="mnu-eyebrow">{route === "balcao" ? "Confira antes de enviar" : "Sua seleção"}</span><h3><ShoppingBag size={18} />{title}</h3></div></div>
        : <SheetHead title={title} onClose={onClose || (() => {})} />}

      <div className="mnu-bag-scroll">
        <div className="mnu-sheet-body" style={{ paddingTop: 0 }}>
          {ctx.cart.length === 0 && <div className="mnu-empty-bag"><span className="mnu-empty-icon">{route === "mesa" ? <UtensilsCrossed size={27} strokeWidth={1.3} /> : route === "balcao" ? <Store size={27} strokeWidth={1.3} /> : <ShoppingBag size={27} strokeWidth={1.3} />}</span><h4>{route === "mesa" ? "O que vai à mesa?" : route === "balcao" ? "Vamos começar?" : "Seu próximo pedido começa aqui"}</h4><p>Escolha um item no cardápio para ver os detalhes e adicionar ao pedido.</p></div>}
          <div>
            {ctx.cart.map((l) => (
              <div key={l.key} className="mnu-line">
                <div><strong>{l.name}</strong>{l.note && <small>Obs.: {l.note}</small>}<small>{money(l.price * l.qty)}</small></div>
                <Qty value={l.qty} trash onMinus={() => ctx.changeQty(l.key, -1)} onPlus={() => ctx.changeQty(l.key, 1)} />
              </div>
            ))}
          </div>

          {ctx.cart.length > 0 && (
            <>
              {route !== "delivery" && ctx.gate && (
                <div className="mnu-note"><User size={13} style={{ verticalAlign: "-2px" }} /> {ctx.gate.name}{route === "mesa" ? ` · Mesa ${ctx.mesa} · ${ctx.gate.people} ${ctx.gate.people === 1 ? "pessoa" : "pessoas"}` : " · balcão"}</div>
              )}

              {route === "delivery" && !details && <div className="mnu-checkout-preview"><Check size={16} /><p>Boa escolha.<strong>Na próxima etapa, confira como receber e a forma de pagamento.</strong></p></div>}
              <div className="mnu-checkout-details" hidden={route === "delivery" && !details}>
              {route === "delivery" && details && <div className="mnu-checkout-heading"><button type="button" className="mnu-checkout-back" onClick={() => setDetails(false)}><ArrowLeft size={14} /> Revisar itens</button><h4>{mode === "delivery" ? "Dados para entrega" : "Dados para retirada"}</h4></div>}
              {route === "delivery" && (
                <>
                  {ctx.accepts.delivery && ctx.accepts.pickup && (
                    <div className="mnu-seg">
                      <button type="button" className={ctx.receiveNow === "delivery" ? "is-on" : ""} onClick={() => ctx.setReceive("delivery")}>Entrega</button>
                      <button type="button" className={ctx.receiveNow === "pickup" ? "is-on" : ""} onClick={() => ctx.setReceive("pickup")}>Retirar na loja</button>
                    </div>
                  )}
                  {ctx.receiveNow === "delivery" && (
                    <div className="mnu-note">
                      {delivery.fee_mode === "distance" ? "Taxa de entrega pela distância (informe o CEP)" : delivery.fee_mode === "neighborhood" ? "Taxa de entrega por bairro" : `Taxa de entrega ${money(Math.max(0, Number(delivery.fixed_fee) || 0))}`}
                      {ctx.minOrder > 0 && <> · pedido mínimo <b>{money(ctx.minOrder)}</b></>}
                      {ctx.freeAbove > 0 && <> · <b>frete grátis</b> acima de {money(ctx.freeAbove)}</>}
                      {delivery.eta && <> · tempo estimado <b>{delivery.eta}</b></>}
                    </div>
                  )}
                  <label className="mnu-label">Seu nome<input className="mnu-input" value={form.name} onChange={(e) => setForm({ name: e.target.value })} autoComplete="name" /></label>
                  <label className="mnu-label">WhatsApp<input className="mnu-input" inputMode="tel" value={form.phone} onChange={(e) => setForm({ phone: e.target.value })} placeholder="(00) 90000-0000" autoComplete="tel" /></label>
                </>
              )}

              {mode === "delivery" && (
                <>
                  {delivery.fee_mode === "distance" && (
                    <div className="mnu-label">CEP de entrega
                      <input className="mnu-input" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" maxLength={9} value={form.cep}
                        onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 8); setForm({ cep: d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d }); }} />
                      {ctx.quote.status === "loading" && <span>Calculando a entrega…</span>}
                      {ctx.quote.status === "ok" && <span style={{ color: "var(--mnu-ok)", fontWeight: 700 }}>✓ {ctx.quote.distance !== undefined ? `${String(ctx.quote.distance.toFixed(1)).replace(".", ",")} km · ` : ""}entregamos no seu endereço</span>}
                      {ctx.quote.status === "error" && <span style={{ color: "var(--mnu-danger)", fontWeight: 700 }}>{ctx.quote.message}</span>}
                    </div>
                  )}
                  <div className="mnu-row">
                    <label className="mnu-label">Rua<input className="mnu-input" value={form.street} onChange={(e) => setForm({ street: e.target.value })} autoComplete="address-line1" /></label>
                    <label className="mnu-label">Número<input className="mnu-input" value={form.number} onChange={(e) => setForm({ number: e.target.value })} /></label>
                  </div>
                  <div className="mnu-row">
                    <label className="mnu-label">Bairro
                      {delivery.fee_mode === "neighborhood" && ctx.hoods.length > 0 ? (
                        <select className="mnu-select" value={form.district} onChange={(e) => setForm({ district: e.target.value })}>
                          <option value="">Escolha…</option>
                          {ctx.hoods.map((n) => <option key={n.name} value={n.name}>{n.name} — {money(Math.max(0, Number(n.fee) || 0))}</option>)}
                        </select>
                      ) : (
                        <input className="mnu-input" value={form.district} onChange={(e) => setForm({ district: e.target.value })} />
                      )}
                    </label>
                    <label className="mnu-label">Complemento<input className="mnu-input" value={form.complement} onChange={(e) => setForm({ complement: e.target.value })} /></label>
                  </div>
                  <label className="mnu-label">Ponto de referência <span>(opcional)</span><input className="mnu-input" value={form.reference} onChange={(e) => setForm({ reference: e.target.value })} /></label>
                </>
              )}

              {(mode === "delivery" || mode === "pickup") && (
                <div className="mnu-label">Pagamento <span>na {mode === "delivery" ? "entrega" : "retirada"}</span>
                  <div className="mnu-pay">
                    {ctx.payAllowed.pix && <button type="button" className={ctx.pay === "pix" ? "is-on" : ""} onClick={() => ctx.setPay("pix")}>PIX</button>}
                    {ctx.payAllowed.money && <button type="button" className={ctx.pay === "money" ? "is-on" : ""} onClick={() => ctx.setPay("money")}>Dinheiro</button>}
                    {ctx.payAllowed.card && <button type="button" className={ctx.pay === "card" ? "is-on" : ""} onClick={() => ctx.setPay("card")}>Cartão</button>}
                  </div>
                  {ctx.pay === "money" && <input className="mnu-input" inputMode="decimal" value={ctx.changeFor} onChange={(e) => ctx.setChangeFor(e.target.value)} placeholder="Troco para quanto? (opcional)" style={{ marginTop: 8 }} />}
                  {ctx.pay === "pix" && <span style={{ marginTop: 6 }}>A loja envia a chave PIX ao confirmar o pedido.</span>}
                </div>
              )}

              <label className="mnu-label">Observações do pedido <span>(opcional)</span><textarea className="mnu-textarea" maxLength={200} value={form.note} onChange={(e) => setForm({ note: e.target.value })} /></label>
              </div>

              <div className="mnu-sum">
                <div><span>Subtotal</span><span>{money(ctx.subtotal)}</span></div>
                {mode === "delivery" && <div><span>Entrega</span><span>{ctx.baseFee === null ? (delivery.fee_mode === "distance" ? "informe o CEP" : "escolha o bairro") : ctx.fee === 0 ? "Grátis" : money(ctx.fee)}</span></div>}
                <div className="is-total"><span>Total</span><span>{money(ctx.total)}</span></div>
              </div>
              {mode === "delivery" && ctx.minOrder > 0 && ctx.subtotal < ctx.minOrder && <div className="mnu-err">Faltam {money(ctx.minOrder - ctx.subtotal)} para o pedido mínimo de entrega.</div>}
              {ctx.error && <div className="mnu-err">{ctx.error}</div>}
            </>
          )}
        </div>
      </div>

      {ctx.cart.length > 0 && <div className="mnu-foot mnu-bag-foot">
        <button type="button" className="mnu-cta" disabled={!ctx.canSubmit} onClick={route === "delivery" && !details ? () => setDetails(true) : ctx.submit}>
          <span>{ctx.sending ? "Enviando…" : route === "delivery" && !details ? "Continuar pedido" : mode === "mesa" ? `Enviar para a mesa ${ctx.mesa}` : mode === "balcao" ? "Confirmar no balcão" : mode === "delivery" ? "Confirmar entrega" : "Confirmar retirada"}</span><ArrowRight size={17} />
        </button>
      </div>}
    </div>
  );
}
