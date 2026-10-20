import crypto from "node:crypto";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { getTenantAccessState } from "../utils/tenant-access";
import { buildTenantAccessUrl } from "../utils/tenant-domain";
import { storeSelectionLabel } from "../utils/store-selection";
import { checkoutAddress, checkoutContact, checkoutMoney, checkoutText, storeDelivery, StoreCheckoutError, validCheckoutEmail } from "../utils/store-checkout";

const fail = (message: string, status = 422): never => { throw new StoreCheckoutError(message,status); };
const hash = (text: string) => crypto.createHash("sha256").update(text).digest("hex");
const tokenFor = (key: string) => crypto.createHmac("sha256",env.jwtSecret).update(`store-receipt:${key}`).digest("hex");
const canonicalOptions = (raw: unknown): Record<string,string> => {
  if (raw == null) return {};
  if (typeof raw !== "object" || Array.isArray(raw) || Object.keys(raw).length > 12) fail("Confira as opções dos produtos.");
  return Object.fromEntries(Object.entries(raw as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[checkoutText(key,80,"Opção",true),checkoutText(value,key === "Observação" ? 500 : 120,"Opção",true)]));
};
function normalizeItems(input: unknown) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 100) fail("Sua sacola precisa ter de 1 a 100 itens.");
  const grouped = new Map<string,{id:number;quantity:number;selected_options:Record<string,string>}>();
  for (const raw of input as any[]) {
    if (!Number.isInteger(raw?.id) || raw.id < 1 || !Number.isInteger(raw.quantity) || raw.quantity < 1 || raw.quantity > 99) fail("Confira os produtos e as quantidades da sacola.");
    const selected_options = canonicalOptions(raw.selected_options);
    const key = `${raw.id}:${JSON.stringify(selected_options)}`;
    const previous = grouped.get(key);
    const quantity = (previous?.quantity || 0) + raw.quantity;
    if (quantity > 99) fail("O limite é de 99 unidades por item.");
    grouped.set(key,{id:raw.id,quantity,selected_options});
  }
  return [...grouped.values()].sort((a,b)=>a.id-b.id || JSON.stringify(a.selected_options).localeCompare(JSON.stringify(b.selected_options)));
}

/** Preços, frete, variações e estoque são conferidos novamente no servidor. */
export async function createStoreCheckout(input: any, database = prisma) {
  const tenantId = Number(input?.tenantId);
  if (!Number.isInteger(tenantId) || tenantId < 1) fail("Loja não encontrada.",404);
  const requestId = checkoutText(input.requestId,80,"Identificador do pedido",true);
  if (!/^[a-zA-Z0-9_-]{20,80}$/.test(requestId)) fail("Atualize a página para iniciar um novo pedido.");
  const customer = checkoutContact(input.customerInfo), items = normalizeItems(input.items);
  const key = `storefront:${tenantId}:${requestId}`, token = tokenFor(key);
  const requestHash = hash(JSON.stringify({customer,items}));
  const tenant = await database.tenant.findUnique({where:{id:tenantId}});
  if (!tenant || !getTenantAccessState(tenant).allowed) fail("Loja não encontrada.",404);
  const settings = (tenant.policies as any)?.storefront || {};
  if (settings.checkout_mode !== "online" || settings.hide_prices === true) fail("A compra online não está disponível nesta loja.",409);
  const enabled = {pix:true,cash_on_delivery:false,card_on_delivery:false,...settings.checkout_payment_methods};
  if (!["pix","cash_on_delivery","card_on_delivery"].includes(customer.paymentMethod) || !enabled[customer.paymentMethod]) fail("Selecione uma forma de pagamento disponível.");
  const delivery = storeDelivery(settings,customer.cep);
  if (customer.deliveryType === "delivery" && !delivery.delivery_available) fail("Este CEP não está na área de entrega da loja.");
  if (customer.deliveryType === "pickup" && !delivery.pickup_available) fail("A retirada não está disponível nesta loja.");
  const configuredEmails = String(settings.order_notification_emails || "").split(/[,;\n]/).map(email=>email.trim().toLowerCase()).filter(validCheckoutEmail);
  const owner = configuredEmails.length ? null : await database.user.findFirst({where:{tenant_id:tenantId,role:"admin"},orderBy:{created_at:"asc"},select:{email:true}});
  const recipients = [...new Set(configuredEmails.length ? configuredEmails : owner?.email && validCheckoutEmail(owner.email) ? [owner.email] : [])].slice(0,10);
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await database.$transaction(async tx => {
        const previous = await tx.order.findUnique({where:{client_sale_id:key}});
        if (previous) {
          if (previous.tenant_id !== tenantId || (previous.storefront_details as any)?.request_hash !== requestHash) fail("Este pedido já foi registrado com outros dados. Confira a confirmação antes de tentar novamente.",409);
          return {order:previous,repeated:true};
        }
        const shippingCents = customer.deliveryType === "delivery" ? checkoutMoney(delivery.delivery_fee) : 0;
        let totalCents = shippingCents, grossCents = shippingCents;
        const orderItems: any[] = [], snapshotItems: any[] = [];
        for (const item of items) {
          const product = await tx.product.findFirst({where:{id:item.id,tenant_id:tenantId,is_active:true}});
          if (!product) fail("Um produto foi removido ou está indisponível. Revise sua sacola.",409);
          if (product.sale_unit && product.sale_unit !== "unidade") fail("Este produto precisa ser combinado diretamente com a loja.");
          const {Observação:note,...selected} = item.selected_options;
          const selection = storeSelectionLabel(product,selected);
          if (selection === false) fail(`Confira tamanho, cor e opções de ${product.name}.`);
          const base = checkoutMoney(product.price), discounted = checkoutMoney(product.discount_price);
          const unitCents = discounted > 0 ? discounted : base;
          if (!Number.isSafeInteger(unitCents) || unitCents < 0 || unitCents > 9999999999) fail("Um produto está com o preço indisponível.",409);
          const update: any = {};
          if (!tenant.sell_without_stock_control) {
            if (Number(product.stock_quantity) < item.quantity) fail(`Estoque insuficiente para ${product.name}.`,409);
            update.stock_quantity = {decrement:item.quantity};
            const skus = Array.isArray(product.skus) ? product.skus as any[] : [];
            const variations = Array.isArray(product.variations) ? product.variations as any[] : [];
            if (skus.length) {
              const index = skus.findIndex(sku=>Object.keys(sku.combo || {}).length === Object.keys(selected).length && Object.entries(selected).every(([name,value])=>sku.combo?.[name]===value));
              if (index < 0 || !Number.isFinite(Number(skus[index].stock)) || Number(skus[index].stock) < item.quantity) fail(`A opção escolhida de ${product.name} não tem essa quantidade disponível.`,409);
              update.skus = skus.map((sku,index2)=>index2===index ? {...sku,stock:Number(sku.stock)-item.quantity} : sku);
            } else if (variations.length) {
              if (variations.some(group=>!group.options?.some((option:any)=>option.value === selected[group.name] && Number(option.stock) >= item.quantity))) fail(`A opção escolhida de ${product.name} está indisponível.`,409);
              update.variations = variations.map(group=>({...group,options:group.options.map((option:any)=>option.value===selected[group.name] ? {...option,stock:Number(option.stock)-item.quantity} : option)}));
            }
            const claimed = await tx.product.updateMany({where:{id:product.id,tenant_id:tenantId,is_active:true,stock_quantity:{gte:item.quantity}},data:update});
            if (!claimed.count) fail(`O estoque de ${product.name} mudou. Revise a sacola.`,409);
          }
          totalCents += unitCents * item.quantity;
          grossCents += Math.max(base,unitCents) * item.quantity;
          const label = [selection,note ? `Observação: ${note}` : null].filter(Boolean).join(" · ");
          if (label.length > 2000) fail("Reduza a observação deste item para continuar.");
          orderItems.push({product_id:product.id,name:product.name,quantity:item.quantity,unit_price:unitCents/100,dimensions_label:label || null,selected_options:selected});
          snapshotItems.push({id:product.id,name:product.name,sku:product.sku,image:product.image_url || (product.images as string[] | null)?.[0] || "",quantity:item.quantity,unit_price:unitCents/100,options:label});
        }
        if (!Number.isSafeInteger(totalCents) || totalCents <= 0 || totalCents > 9999999999) fail("O total do pedido é inválido.");
        const details = {version:2,request_hash:requestHash,receipt_token_hash:hash(token),contact:customer,items:snapshotItems,stock_tracked:!tenant.sell_without_stock_control};
        const order = await tx.order.create({data:{tenant_id:tenantId,client_sale_id:key,customer_name:customer.name,customer_phone:customer.phone,customer_email:customer.email,customer_document:customer.document || null,customer_address:checkoutAddress(customer),storefront_details:details,total_amount:totalCents/100,gross_amount:grossCents/100,discount_amount:(grossCents-totalCents)/100,shipping_amount:shippingCents/100,sales_channel:"storefront",delivery_method:customer.deliveryType,payment_method:customer.paymentMethod,status:"pending",items:{create:orderItems}}});
        if (!tenant.sell_without_stock_control) for (const item of items) await tx.stockMovement.create({data:{tenant_id:tenantId,product_id:item.id,type:"sale",quantity:-item.quantity,reason:`Pedido online #${order.id}`}});
        const storeUrl = buildTenantAccessUrl(tenant.subdomain || tenant.slug);
        const payload = {store_name:tenant.name,store_whatsapp:tenant.whatsapp,order_id:order.id,created_at:order.created_at.toISOString(),contact:customer,address:order.customer_address,items:snapshotItems,shipping:shippingCents/100,total:totalCents/100,receipt_url:`${storeUrl.replace(/\/$/,"")}/checkout?order=${order.id}#${token}`};
        await tx.storeOrderEmail.createMany({data:[{tenant_id:tenantId,order_id:order.id,audience:"customer",recipient:customer.email,payload},...recipients.map(recipient=>({tenant_id:tenantId,order_id:order.id,audience:"owner",recipient,payload}))]});
        return {order,repeated:false};
      },{isolationLevel:"Serializable",timeout:15000});
      return {orderId:result.order.id,receiptToken:token,total:Number(result.order.total_amount),repeated:result.repeated};
    } catch(error) {
      if (attempt < 2 && ["P2034","P2002"].includes((error as any)?.code)) continue;
      throw error;
    }
  }
}

export async function getStoreCheckoutReceipt(tenantId: number, orderId: number, token: string, database = prisma) {
  if (!Number.isInteger(tenantId) || !Number.isInteger(orderId) || !/^[a-f0-9]{64}$/.test(token)) fail("Confirmação não encontrada.",404);
  const order = await database.order.findFirst({where:{id:orderId,tenant_id:tenantId,sales_channel:"storefront"},include:{store_emails:{select:{audience:true,status:true}},items:{include:{product:{select:{image_url:true}}}}}});
  const details = order?.storefront_details as any;
  const actual = hash(token), expected = String(details?.receipt_token_hash || "");
  if (!order || expected.length !== actual.length || !crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(actual))) fail("Confirmação não encontrada.",404);
  const receiptItems = Array.isArray(order.items) ? order.items.map(item=>({id:item.product_id,name:item.name || "Produto",quantity:item.quantity,unit_price:Number(item.unit_price),options:item.dimensions_label || "",image:item.product?.image_url || details.items?.find((previous:any)=>previous.id === item.product_id)?.image || ""})) : details.items;
  return {id:order.id,status:order.status,created_at:order.created_at,total:Number(order.total_amount),shipping:Number(order.shipping_amount || 0),payment_method:order.payment_method,delivery_method:order.delivery_method,address:order.customer_address,customer_name:order.customer_name,customer_email:order.customer_email,items:receiptItems,customer_email_status:order.store_emails.find(message=>message.audience === "customer")?.status || "pending"};
}
