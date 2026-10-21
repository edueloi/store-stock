// Sinal enviado pela API pública para produto com "ocultar preço no site": o preço vem como -1 e
// os temas da vitrine mostram "Sob consulta". Nunca entra em conta nem no carrinho.
export const HIDDEN_PRICE = -1;

export const isPriceHidden = (product: { price?: number | string | null; price_hidden?: boolean }): boolean =>
  product.price_hidden === true || Number(product.price) === HIDDEN_PRICE;
