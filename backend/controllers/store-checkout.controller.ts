import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { getTenantAccessState } from "../utils/tenant-access";
import { storeDelivery, StoreCheckoutError } from "../utils/store-checkout";
import { createStoreCheckout, getStoreCheckoutReceipt } from "../services/store-checkout.service";
import { flushStoreOrderEmails } from "../services/store-order-email.service";
import { emitToTenant } from "../services/realtime.service";

const limits = new Map<string,{count:number;until:number}>();
export function limitStoreCheckout(req: Request,res: Response,next: NextFunction) {
  const key = `${req.ip}:${req.body?.tenantId || ""}`, now = Date.now(), entry = limits.get(key);
  if (entry && entry.until > now && entry.count >= 30) { res.status(429).json({error:"Aguarde alguns minutos antes de tentar novamente."}); return; }
  if (!entry || entry.until <= now) {
    if (limits.size >= 10000) limits.delete(limits.keys().next().value!);
    limits.set(key,{count:1,until:now+10*60_000});
  } else entry.count++;
  next();
}
function checkoutError(error: unknown,res: Response) {
  if (error instanceof StoreCheckoutError) { res.status(error.status).json({error:error.message}); return; }
  console.error("Falha no checkout da loja",{code:(error as any)?.code});
  res.status(500).json({error:"Não foi possível concluir agora. Tente novamente: o mesmo pedido não será duplicado."});
}
export async function completeStoreCheckout(req: Request,res: Response) {
  res.setHeader("Cache-Control","no-store");
  try {
    const result = await createStoreCheckout(req.body);
    if (!result.repeated) {
      emitToTenant(Number(req.body.tenantId),"order:created",{orderId:result.orderId});
      emitToTenant(Number(req.body.tenantId),"stock:changed",{orderId:result.orderId});
      void flushStoreOrderEmails().catch(()=>undefined);
    }
    res.status(result.repeated ? 200 : 201).json(result);
  } catch(error) { checkoutError(error,res); }
}
export async function storeCheckoutReceipt(req: Request,res: Response) {
  res.setHeader("Cache-Control","no-store");
  try { res.json(await getStoreCheckoutReceipt(Number(req.body?.tenantId),Number(req.body?.orderId),String(req.body?.token || ""))); }
  catch(error) { checkoutError(error,res); }
}
export async function storeCheckoutDetails(req: Request,res: Response) {
  res.setHeader("Cache-Control","no-store");
  try {
    const id = Number(req.body?.tenantId);
    if (!Number.isInteger(id) || id < 1) throw new StoreCheckoutError("Loja não encontrada.",404);
    const tenant = await prisma.tenant.findUnique({where:{id}});
    if (!tenant || !getTenantAccessState(tenant).allowed) throw new StoreCheckoutError("Loja não encontrada.",404);
    const settings = (tenant.policies as any)?.storefront || {};
    const configured = {pix:true,cash_on_delivery:false,card_on_delivery:false,...settings.checkout_payment_methods};
    res.json({checkout_enabled:settings.checkout_mode === "online" && settings.hide_prices !== true,payment_methods:{pix:!!configured.pix,cash_on_delivery:!!configured.cash_on_delivery,card_on_delivery:!!configured.card_on_delivery},delivery:storeDelivery(settings,req.body?.cep)});
  } catch(error) { checkoutError(error,res); }
}
const cepCache = new Map<string,{until:number;value:object}>();
export async function storePostalAddress(req: Request,res: Response) {
  const cep = String(req.params.cep || "");
  if (!/^\d{8}$/.test(cep)) { res.status(422).json({error:"Informe um CEP com 8 números."}); return; }
  const cached = cepCache.get(cep);
  if (cached && cached.until > Date.now()) { res.json(cached.value); return; }
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`,{signal:AbortSignal.timeout(5000)});
    if (!response.ok) throw new Error("CEP indisponível");
    const data = await response.json() as any;
    if (data.erro) { res.status(404).json({error:"CEP não encontrado. Confira os números ou preencha o endereço."}); return; }
    const value = {cep,street:String(data.logradouro || ""),district:String(data.bairro || ""),city:String(data.localidade || ""),state:String(data.uf || "")};
    if (cepCache.size >= 500) cepCache.delete(cepCache.keys().next().value!);
    cepCache.set(cep,{until:Date.now()+24*60*60_000,value});
    res.json(value);
  } catch { res.status(503).json({error:"A busca por CEP está indisponível. Você pode preencher o endereço manualmente."}); }
}
