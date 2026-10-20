export class StoreCheckoutError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}
export const checkoutDigits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
export const checkoutText = (value: unknown, max: number, label: string, required = false) => {
  if (value != null && typeof value !== "string") throw new StoreCheckoutError(`${label}: confira o preenchimento.`);
  const text = String(value ?? "").trim();
  if ((required && !text) || text.length > max) throw new StoreCheckoutError(`${label}: confira o preenchimento.`);
  return text;
};
export const validCheckoutEmail = (email: string) => email.length <= 191 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email);
export const checkoutMoney = (value: unknown) => Math.round(Number(value) * 100);
export type StoreDelivery = { pickup_available: boolean; delivery_enabled: boolean; delivery_available: boolean; delivery_fee: number | null; delivery_zone: string | null };
export function storeDelivery(settings: any, rawCep: unknown): StoreDelivery {
  const delivery = settings?.delivery || {};
  const cep = checkoutDigits(rawCep);
  const zone = delivery.delivery_enabled && cep.length === 8 && (Array.isArray(delivery.cep_zones) ? delivery.cep_zones : []).find((zone: any) => {
    const from = checkoutDigits(zone.from), to = checkoutDigits(zone.to);
    return from.length === 8 && to.length === 8 && from <= cep && cep <= to && Number.isFinite(Number(zone.fee ?? 0)) && Number(zone.fee ?? 0) >= 0;
  });
  return { pickup_available: delivery.pickup_enabled !== false, delivery_enabled: delivery.delivery_enabled === true, delivery_available: !!zone, delivery_fee: zone ? checkoutMoney(zone.fee || 0) / 100 : null, delivery_zone: zone?.name || null };
}
export type CheckoutContact = { name: string; email: string; phone: string; document: string; deliveryType: "pickup" | "delivery"; paymentMethod: string; cep: string; street: string; number: string; complement: string; district: string; city: string; state: string; notes: string };
export function checkoutContact(input: any): CheckoutContact {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new StoreCheckoutError("Preencha seus dados para continuar.");
  const field = (key: string, max: number, label: string, required = false) => checkoutText(input[key],max,label,required);
  const name = field("name",120,"Nome completo",true), email = field("email",191,"E-mail",true).toLowerCase();
  const phone = checkoutDigits(field("phone",24,"Telefone",true));
  if (name.length < 3 || !validCheckoutEmail(email) || !/^(55)?\d{10,11}$/.test(phone)) throw new StoreCheckoutError("Confira seu nome, e-mail e telefone com DDD.");
  if (!["pickup","delivery"].includes(input.deliveryType)) throw new StoreCheckoutError("Escolha entrega ou retirada.");
  const contact: CheckoutContact = { name,email,phone,document:checkoutDigits(field("document",24,"CPF/CNPJ")),deliveryType:input.deliveryType,paymentMethod:field("paymentMethod",32,"Pagamento",true),cep:checkoutDigits(field("cep",10,"CEP")),street:field("street",120,"Rua"),number:field("number",20,"Número"),complement:field("complement",80,"Complemento"),district:field("district",80,"Bairro"),city:field("city",80,"Cidade"),state:field("state",2,"UF").toUpperCase(),notes:field("notes",1000,"Observações") };
  if (contact.document && ![11,14].includes(contact.document.length)) throw new StoreCheckoutError("Confira o CPF ou CNPJ informado.");
  if (contact.deliveryType === "delivery" && (!/^\d{8}$/.test(contact.cep) || !contact.street || !contact.number || !contact.district || !contact.city || !/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(contact.state))) throw new StoreCheckoutError("Complete o endereço de entrega, incluindo número, bairro, cidade e UF.");
  return contact;
}
export function checkoutAddress(contact: CheckoutContact) {
  return contact.deliveryType === "pickup" ? "Retirada na loja" : `${contact.street}, ${contact.number}${contact.complement ? ` · ${contact.complement}` : ""} · ${contact.district} · ${contact.city}/${contact.state} · CEP ${contact.cep}`;
}
