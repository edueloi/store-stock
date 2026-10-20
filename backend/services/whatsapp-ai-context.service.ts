import { prisma } from "../config/prisma";
import { buildTenantAccessUrl } from "../utils/tenant-domain";

// Contexto real da loja entregue à IA do WhatsApp: dados da loja, horário e os produtos
// relacionados à pergunta do cliente (preço, variações e disponibilidade). A IA só pode
// afirmar o que estiver aqui — nada de preço ou estoque "de cabeça".

const DAY_LABELS: Record<string, string> = {
  seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta", sex: "Sexta", sab: "Sábado", dom: "Domingo",
};
const DAY_ORDER = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
const JS_DAY_KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "um", "uma", "uns", "umas", "o", "a", "os", "as", "e", "ou", "que", "com", "sem", "para", "pra", "por",
  "tem", "têm", "tenho", "voces", "vocês", "voce", "você", "vcs", "vc", "quero", "queria", "gostaria", "preciso", "sobre", "qual", "quais",
  "quanto", "quanta", "custa", "custam", "valor", "preco", "preço", "ainda", "tamanho", "cor", "disponivel", "disponível", "estoque",
  "loja", "ola", "olá", "oi", "bom", "boa", "dia", "tarde", "noite", "por", "favor", "pode", "poderia", "mais", "muito", "esse", "essa",
  "isso", "tem", "ter", "ver", "saber", "me", "mim", "meu", "minha", "aqui", "como", "onde", "quando", "esta", "está", "estao", "estão",
  "vende", "vendem", "venda", "comprar", "compra", "produto", "produtos", "algum", "alguma", "tudo", "obrigado", "obrigada",
]);

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function keywordsOf(text: string): string[] {
  const seen = new Set<string>();
  for (const raw of normalize(text).split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || STOPWORDS.has(raw)) continue;
    // singular simples: "camisetas" -> "camiseta"
    seen.add(raw.length > 4 && raw.endsWith("s") ? raw.slice(0, -1) : raw);
  }
  return [...seen].slice(0, 8);
}

type HoursEntry = { open?: string; close?: string; closed?: boolean };

function describeHours(hours: unknown): { text: string; openNow: boolean | null; today: string | null } {
  if (!hours || typeof hours !== "object") return { text: "não cadastrado", openNow: null, today: null };
  const map = hours as Record<string, HoursEntry>;
  const lines = DAY_ORDER.filter((d) => map[d]).map((d) => {
    const h = map[d];
    return `${DAY_LABELS[d]}: ${h.closed || !h.open || !h.close ? "fechado" : `${h.open} às ${h.close}`}`;
  });
  if (!lines.length) return { text: "não cadastrado", openNow: null, today: null };

  // "agora" no fuso de Brasília, independente do fuso do servidor
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const dayKey = JS_DAY_KEYS[["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday)];
  const nowMin = Number(parts.find((p) => p.type === "hour")?.value ?? 0) * 60 + Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const today = map[dayKey];
  let openNow: boolean | null = null;
  if (today) {
    if (today.closed || !today.open || !today.close) openNow = false;
    else {
      const toMin = (s: string) => Number(s.split(":")[0]) * 60 + Number(s.split(":")[1] ?? 0);
      openNow = nowMin >= toMin(today.open) && nowMin < toMin(today.close);
    }
  }
  const todayLabel = DAY_LABELS[dayKey] ?? "";
  const todayText = today
    ? `${todayLabel}: ${today.closed || !today.open || !today.close ? "fechado hoje" : `${today.open} às ${today.close}`}`
    : null;
  return { text: lines.join("; "), openNow, today: todayText };
}

export async function buildStoreContext(tenantId: number): Promise<string> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return "";
  const t = tenant as Record<string, any>;

  const url = buildTenantAccessUrl(t.subdomain || t.slug);
  const hours = describeHours(t.business_hours);
  const address = t.show_address === false ? null : [
    [t.address_street, t.address_number].filter(Boolean).join(", "),
    t.address_district, [t.address_city, t.address_state].filter(Boolean).join("/"),
  ].filter(Boolean).join(" - ") || t.address || null;

  const payments = t.payment_methods && typeof t.payment_methods === "object"
    ? Object.entries(t.payment_methods as Record<string, boolean>).filter(([, on]) => on === true).map(([k]) => ({
      pix: "Pix", credit_card: "Cartão de crédito", debit_card: "Cartão de débito", cash: "Dinheiro", boleto: "Boleto",
    } as Record<string, string>)[k] ?? k)
    : [];

  const policies = (t.policies && typeof t.policies === "object" ? t.policies : {}) as Record<string, unknown>;
  const policyLines = (["shipping", "returns", "exchange"] as const)
    .map((k) => (typeof policies[k] === "string" && policies[k] ? `${({ shipping: "Entrega/frete", returns: "Devolução", exchange: "Troca" })[k]}: ${String(policies[k]).slice(0, 300)}` : ""))
    .filter(Boolean);

  const categories = await prisma.category.findMany({ where: { tenant_id: tenantId }, select: { id: true, name: true }, take: 30, orderBy: { name: "asc" } });
  const services = await prisma.service.findMany({
    where: { tenant_id: tenantId, is_active: true },
    select: { name: true, description: true, price: true, category: true },
    take: 30,
    orderBy: { name: "asc" },
  });
  const serviceLines = services.map((sv) => {
    const cat = sv.category && sv.category !== "Geral" ? ` (${sv.category})` : "";
    const desc = sv.description ? ` | ${String(sv.description).replace(/\s+/g, " ").slice(0, 140)}` : "";
    return `- ${sv.name}${cat}: ${brl(Number(sv.price))}${desc}`;
  });

  return [
    `Loja: ${t.name}`,
    `Link da loja virtual: ${url}`,
    t.whatsapp ? `WhatsApp da loja: ${t.whatsapp}` : "",
    address ? `Endereço: ${address}` : "",
    `Horário de funcionamento: ${hours.text}`,
    hours.today ? `Horário de hoje (${hours.today})` : "",
    hours.openNow === null ? "" : `Agora a loja está: ${hours.openNow ? "ABERTA" : "FECHADA"} (horário de Brasília)`,
    payments.length ? `Formas de pagamento aceitas: ${payments.join(", ")}` : "",
    ...policyLines,
    `Padrão de links da loja virtual: busca por produto = ${url}/catalogo?q=TERMO (espaços viram +, ex.: ${url}/catalogo?q=bolo+de+chocolate); por categoria = ${url}/catalogo?cat=ID`,
    categories.length ? `Categorias (id): ${categories.map((c) => `${c.name} (${c.id})`).join(", ")}` : "",
    serviceLines.length ? `Serviços prestados:\n${serviceLines.join("\n")}` : "",
  ].filter(Boolean).join("\n");
}

type VariationLine = { label: string; stock: number };

function variationLines(product: { skus: unknown; variations: unknown; attributes: unknown }): VariationLine[] {
  if (Array.isArray(product.skus) && product.skus.length) {
    return (product.skus as Array<{ combo?: Record<string, string>; stock?: number }>)
      .filter((s) => s.combo)
      .map((s) => ({ label: Object.entries(s.combo!).map(([k, v]) => `${k}: ${v}`).join(" / "), stock: Number(s.stock ?? 0) }))
      .slice(0, 40);
  }
  if (Array.isArray(product.variations) && product.variations.length) {
    return (product.variations as Array<{ name?: string; options?: Array<{ value: string; stock?: number }> }>)
      .flatMap((v) => (v.options ?? []).map((o) => ({ label: `${v.name}: ${o.value}`, stock: Number(o.stock ?? 0) })))
      .slice(0, 40);
  }
  return [];
}

function availability(stock: number) {
  if (stock <= 0) return "sem estoque";
  if (stock <= 5) return `últimas ${stock} unidades`;
  return "disponível";
}

function formatProduct(p: any): string {
  const measured = p.sale_unit && p.sale_unit !== "unidade";
  const unit = ({ m2: "m²", linear: "metro linear", peso: "kg", volume: "litro" } as Record<string, string>)[p.sale_unit] ?? p.measure_unit ?? "";
  const base = measured && p.price_per_measure ? Number(p.price_per_measure) : Number(p.price);
  const promo = !measured && p.discount_price != null && Number(p.discount_price) > 0 && Number(p.discount_price) < base ? Number(p.discount_price) : null;
  const price = promo != null
    ? `${brl(promo)} (de ${brl(base)})`
    : `${brl(base)}${measured && unit ? ` por ${unit}` : ""}`;

  const vars = variationLines(p);
  const stockTotal = measured ? Number(p.measure_stock_quantity ?? 0) : Number(p.stock_quantity ?? 0);
  const stockText = vars.length
    ? ""
    : ` | ${availability(stockTotal)}`;
  const varText = vars.length
    ? ` | opções: ${vars.map((v) => `${v.label} (${availability(v.stock)})`).join("; ")}`
    : "";
  const desc = p.description ? ` | ${String(p.description).replace(/\s+/g, " ").slice(0, 160)}` : "";
  const store = p.is_active ? "" : " | SÓ NA LOJA FÍSICA (não está no site: não envie link dele)";
  return `- ${p.name} (id ${p.id})${p.sku ? ` [${p.sku}]` : ""}: ${price}${stockText}${varText}${store}${desc}`;
}

/** Produtos relacionados à pergunta (e ao que já foi conversado). Vazio se nada casar. */
export async function buildCatalogContext(tenantId: number, message: string, history: string[]): Promise<string> {
  const terms = keywordsOf([message, ...history.slice(-3)].join(" "));
  const base = { tenant_id: tenantId } as const; // PDV inteiro: "is_active" significa só "ativo no site"
  const select = {
    id: true, name: true, sku: true, description: true, price: true, discount_price: true, stock_quantity: true,
    skus: true, variations: true, attributes: true, sale_unit: true, price_per_measure: true,
    measure_stock_quantity: true, measure_unit: true, is_featured: true, is_active: true, category: { select: { name: true } },
  } as const;

  let products: any[] = [];
  if (terms.length) {
    const candidates = await prisma.product.findMany({
      where: {
        ...base,
        OR: terms.flatMap((term) => [
          { name: { contains: term } }, { description: { contains: term } }, { sku: { contains: term } },
          { category: { name: { contains: term } } },
        ]),
      },
      select,
      take: 60,
    });
    const score = (p: any) => {
      const name = normalize(p.name);
      const rest = normalize(`${p.description ?? ""} ${p.category?.name ?? ""}`);
      return terms.reduce((acc, t) => acc + (name.includes(t) ? 3 : 0) + (rest.includes(t) ? 1 : 0), 0);
    };
    products = candidates.sort((a, b) => score(b) - score(a)).slice(0, 8);
  }

  // Pergunta genérica ("o que vocês vendem?"): amostra de destaques para a IA ter o que mostrar.
  if (!products.length) {
    products = await prisma.product.findMany({ where: base, select, take: 6, orderBy: [{ is_featured: "desc" }, { id: "desc" }] });
    if (!products.length) return "Catálogo: nenhum produto ativo cadastrado.";
    return `Catálogo (amostra — a busca não encontrou nada específico para a pergunta):\n${products.map(formatProduct).join("\n")}`;
  }
  return `Produtos encontrados para a pergunta:\n${products.map(formatProduct).join("\n")}\nSugestão de termo para o link filtrado: ${terms.slice(0, 3).join("+")} (ajuste para o nome do produto como o cliente falou)`;
}

/** Últimas mensagens da conversa (cliente x assistente) para a IA manter o fio da conversa. */
export async function loadConversationHistory(conversationId: number, limit = 8): Promise<Array<{ role: "customer" | "assistant"; text: string }>> {
  const rows = await prisma.whatsappMessageLog.findMany({
    where: { conversation_id: conversationId, direction: { in: ["customer", "bot", "agent"] }, body: { not: null } },
    orderBy: { created_at: "desc" },
    take: limit,
    select: { direction: true, body: true },
  });
  return rows.reverse().map((r) => ({
    role: r.direction === "customer" ? "customer" as const : "assistant" as const,
    text: String(r.body).slice(0, 500),
  }));
}

/** Setores de atendimento ativos da loja (chave usada em [[TRANSFERIR:chave]]). */
export async function loadActiveSectors(tenantId: number): Promise<Array<{ key: string; name: string; description: string | null }>> {
  const sectors = await prisma.whatsappSector.findMany({
    where: { is_active: true, workspace: { tenant_id: tenantId } },
    orderBy: [{ sort_order: "asc" }, { id: "asc" }],
    select: { key: true, name: true, description: true },
  });
  return sectors;
}
