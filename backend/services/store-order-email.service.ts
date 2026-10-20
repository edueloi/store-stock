import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { escapeHtml } from "../utils/html-escape";
import { sendPlatformEmail } from "./mailer.service";
import { createStoreOrderPdf } from "./store-order-pdf.service";

const money = (value: number) => Number(value).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const paymentNames: Record<string,string> = {pix:"PIX — aguardando confirmação da loja",cash_on_delivery:"Dinheiro na entrega ou retirada",card_on_delivery:"Cartão na entrega ou retirada"};
export function storeOrderEmailContent(payload: any, owner: boolean) {
  const code = `#${String(payload.order_id).padStart(6,"0")}`;
  const e = (value: unknown) => escapeHtml(String(value ?? ""));
  const itemRows = payload.items.map((item:any)=>`<tr><td style="padding:16px 0;border-bottom:1px solid #e7e7e7"><strong>${e(item.name)}</strong><br/><span style="font-size:12px;color:#666">${e(item.options)}${owner && item.sku ? `<br/>SKU: ${e(item.sku)}` : ""}<br/>${item.quantity} × ${money(item.unit_price)}</span></td><td align="right" style="border-bottom:1px solid #e7e7e7">${money(item.unit_price*item.quantity)}</td></tr>`).join("");
  const contact = owner ? `<p><strong>Cliente:</strong> ${e(payload.contact.name)}<br/>${e(payload.contact.phone)}<br/>${e(payload.contact.email)}</p>` : `<p>Olá, ${e(payload.contact.name.split(" ")[0])}. Recebemos seu pedido. Guarde este número para falar com a loja.</p>`;
  const href = owner ? `${env.appBaseUrl.replace(/\/$/,"")}/admin/minha-loja` : payload.receipt_url;
  return {
    subject:`${owner ? "Novo pedido" : "Recebemos seu pedido"} ${code} · ${payload.store_name}`,
    html:`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#f2f2ef;font-family:Arial,sans-serif;color:#171717"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" style="max-width:600px;background:white" cellpadding="24" cellspacing="0"><tr><td style="background:#171717;color:white;font-size:21px;font-weight:bold">${e(payload.store_name)}</td></tr><tr><td><p style="font-size:11px;letter-spacing:2px;color:#666">${owner ? "NOVO PEDIDO NA LOJA ONLINE" : "SEU PRÓXIMO MOVIMENTO COMEÇA AQUI"}</p><h1 style="font-size:30px">Pedido ${code}</h1>${contact}<p style="padding:14px;background:#f3f5ed;font-size:13px;line-height:1.7"><strong>Pedido recebido · pagamento pendente</strong><br/>${e(paymentNames[payload.contact.paymentMethod] || payload.contact.paymentMethod)}. O registro do pedido ainda não confirma o pagamento.</p><table width="100%" cellspacing="0" cellpadding="0">${itemRows}<tr><td style="padding-top:16px">${payload.contact.deliveryType === "pickup" ? "Retirada na loja" : "Entrega"}</td><td align="right" style="padding-top:16px">${payload.shipping ? money(payload.shipping) : payload.contact.deliveryType === "pickup" ? "Sem custo" : "Grátis"}</td></tr><tr><td style="padding-top:16px;font-weight:bold;font-size:19px">Total</td><td align="right" style="padding-top:16px;font-weight:bold;font-size:19px">${money(payload.total)}</td></tr></table><h2 style="font-size:16px;margin-top:28px">${payload.contact.deliveryType === "pickup" ? "Retirada" : "Endereço de entrega"}</h2><p style="font-size:14px;line-height:1.6">${e(payload.address)}</p>${payload.contact.notes ? `<p style="font-size:13px"><strong>Observações:</strong> ${e(payload.contact.notes)}</p>` : ""}<p style="margin:28px 0"><a href="${e(href)}" style="display:inline-block;background:#171717;color:white;text-decoration:none;padding:16px 22px;font-weight:bold">${owner ? "Conferir pedido no painel" : "Ver confirmação do pedido"} ↗</a></p><p style="font-size:12px;color:#666;line-height:1.6">${payload.store_whatsapp ? `Dúvidas sobre o pedido? Fale com a loja: ${e(payload.store_whatsapp)}.<br/>` : ""}${owner ? "Confira pagamento, opções dos produtos e endereço antes de separar o pedido." : "A loja confirmará o pagamento e combinará a entrega ou a retirada com você."}</p></td></tr><tr><td style="border-top:1px solid #eee;font-size:11px;color:#888">${e(payload.store_name)} · Envio automático pela BoxSys.</td></tr></table></td></tr></table></body></html>`
  };
}

let flushing = false;
export async function flushStoreOrderEmails(database = prisma, send = sendPlatformEmail) {
  if (flushing) return;
  flushing = true;
  try {
    const stale = new Date(Date.now()-10*60_000);
    await database.storeOrderEmail.updateMany({where:{status:"sending",updated_at:{lt:stale},attempts:{lt:5}},data:{status:"pending"}});
    await database.storeOrderEmail.updateMany({where:{status:"sending",updated_at:{lt:stale},attempts:{gte:5}},data:{status:"failed",last_error:"Envio interrompido após várias tentativas."}});
    const messages = await database.storeOrderEmail.findMany({where:{status:"pending",attempts:{lt:5},next_attempt_at:{lte:new Date()}},orderBy:{created_at:"asc"},take:10});
    for (const message of messages) {
      const claim = await database.storeOrderEmail.updateMany({where:{id:message.id,status:"pending",attempts:message.attempts},data:{status:"sending",attempts:{increment:1}}});
      if (!claim.count) continue;
      try {
        const payload = message.payload as any, owner = message.audience === "owner";
        const content = storeOrderEmailContent(payload,owner);
        const attachments = owner ? [{filename:`pedido-${payload.order_id}.pdf`,content:await createStoreOrderPdf({storeName:payload.store_name,orderNumber:payload.order_id,customerName:payload.contact.name,customerPhone:payload.contact.phone,customerEmail:payload.contact.email,createdAt:new Date(payload.created_at),items:payload.items.map((item:any)=>({name:[item.name,item.options].filter(Boolean).join(" · "),sku:item.sku,code:item.id,quantity:item.quantity,unitPrice:item.unit_price})),total:payload.total,title:"PEDIDO DA LOJA ONLINE",footer:`Pagamento pendente. ${payload.address}. Frete: ${money(payload.shipping)}.`}),contentType:"application/pdf"}] : undefined;
        await send({to:message.recipient,...content,attachments});
        await database.storeOrderEmail.update({where:{id:message.id},data:{status:"sent",last_error:null}});
      } catch {
        const attempts = message.attempts+1;
        await database.storeOrderEmail.update({where:{id:message.id},data:{status:attempts >= 5 ? "failed" : "pending",next_attempt_at:new Date(Date.now()+Math.min(60,2**attempts)*60_000),last_error:"Não foi possível entregar o e-mail. Confira a configuração de envio e o endereço do destinatário."}});
      }
    }
  } finally { flushing = false; }
}
export function startStoreOrderEmailsLoop() {
  const run = () => flushStoreOrderEmails().catch(()=>console.error("Não foi possível processar a fila de confirmações da loja."));
  void run();
  setInterval(run,60_000).unref();
}
