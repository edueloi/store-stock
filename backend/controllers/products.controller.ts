import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import { Prisma } from "@prisma/client";
import { PIECE_KINDS } from "../utils/glassPieces";
import { deleteProductImage } from "./upload.controller";
import { getLowStockThreshold } from "../utils/low-stock-threshold";
import type { AuthenticatedRequest } from "../types/auth";
import { emitToTenant } from "../services/realtime.service";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}
// Peça de vidraçaria: só produto por m² pode ser peça, e o tipo precisa ser um dos conhecidos.
function glassPieceFields(saleUnit: string, kind: unknown, defaults: unknown) {
  const validKind = saleUnit === "m2" && PIECE_KINDS.some((k) => k.value === kind) ? String(kind) : null;
  if (!validKind) return { piece_kind: null, piece_defaults: Prisma.DbNull };
  const d = (defaults && typeof defaults === "object" ? defaults : {}) as Record<string, unknown>;
  const clean: Record<string, string | number> = {};
  if (typeof d.glass === "string" && d.glass.trim()) clean.glass = d.glass.trim().slice(0, 60);
  if (typeof d.finish === "string" && d.finish.trim()) clean.finish = d.finish.trim().slice(0, 60);
  const thickness = Math.round(Number(d.thickness_mm));
  if (thickness > 0 && thickness <= 30) clean.thickness_mm = thickness;
  return { piece_kind: validKind, piece_defaults: Object.keys(clean).length ? clean : Prisma.DbNull };
}

// Só mexe nos campos da peça quando o corpo traz piece_kind (formulário completo) ou troca a unidade de venda
// para algo que não seja m² (aí a marcação de peça deixa de valer). Atualizações parciais (estoque etc.) não tocam.
function pieceFieldsFor(body: Record<string, unknown>, currentSaleUnit?: string | null) {
  const hasUnit = typeof body.sale_unit === "string";
  const saleUnit = hasUnit ? String(body.sale_unit) : (currentSaleUnit ?? "unidade");
  if ("piece_kind" in body) return glassPieceFields(saleUnit, body.piece_kind, body.piece_defaults);
  if (hasUnit && saleUnit !== "m2") return { piece_kind: null, piece_defaults: Prisma.DbNull };
  return {};
}

function publicDetails(value: any) {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  const text = (v: unknown) => typeof v === "string" ? v.slice(0, 10000) : "";
  const m = value?.measurements;
  return { specifications: text(value?.specifications), delivery_installation: text(value?.delivery_installation), ...(m && typeof m === "object" ? { measurements: { ...(typeof m.enabled === "boolean" ? { enabled: m.enabled } : {}), kind: PIECE_KINDS.find(k => k.value === m.kind)?.value || "fixo", allow_measure_later: m.allow_measure_later !== false } } : {}) };
}

// Aviso preventivo (NÃO bloqueia salvar) sobre o caso mais comum de rejeição
// na SEFAZ ("CFOP não permitido para o CSOSN informado"): um CFOP de ENTRADA
// (série 1xxx/2xxx/3xxx, usado em compra/devolução de compra) cadastrado num
// produto que depois é vendido pela NFC-e, que sempre exige CFOP de SAÍDA
// (série 5xxx dentro do estado, 6xxx fora do estado, 7xxx exterior). Retorna
// o aviso junto da resposta de sucesso — o lojista decide se corrige, sem
// travar o cadastro (pode ter um motivo legítimo pra registrar assim mesmo).
// Não valida a combinação fina CFOP×CSOSN (exigiria uma tabela de regras
// fiscais completa), só o erro estrutural mais provável.
// NCM/CEST/CFOP têm limite no banco (8/7/4 dígitos): "8517.62.99" estourava a coluna e o cadastro falhava com erro genérico.
function cleanFiscalDigits(rest: Record<string, any>) {
  for (const [field, max] of [["ncm", 8], ["cest", 7], ["cfop", 4]] as const) {
    if (typeof rest[field] === "string") {
      const digits = rest[field].replace(/D/g, "").slice(0, max);
      rest[field] = digits === "" ? null : digits;
    }
  }
}


// ── Normalização do payload de produto ────────────────────────────────────────────────────────
// O corpo da requisição ia direto para o Prisma: qualquer campo desconhecido, número como texto/decimal num campo
// inteiro, "" em número/data, valor grande demais para a coluna, categoria inexistente ou preço ausente (produto
// por medida) derrubava o cadastro com um erro genérico. Aqui tudo vira valor válido ou uma mensagem clara (400).
class ProductInputError extends Error {}
const PRODUCT_FIELDS = new Set<string>(Object.values(Prisma.ProductScalarFieldEnum));
const INT_FIELDS = ["stock_quantity", "min_stock", "weight_grams", "origem"];
// campo → limite (valor absoluto máximo, exclusivo) conforme a precisão da coluna Decimal
const DECIMAL_FIELDS: Record<string, number> = {
  price: 1e8, cost_price: 1e8, discount_price: 1e8, price_per_measure: 1e8, min_billable_quantity: 1e8,
  max_discount_pct: 1e3, icms_aliquota: 1e3, pis_aliquota: 1e3, cofins_aliquota: 1e3,
  package_length_cm: 1e6, package_width_cm: 1e6, package_height_cm: 1e6,
  measure_stock_quantity: 1e9, measure_min_stock: 1e9,
};
const NOT_NULL_DEFAULTED = ["type", "sale_unit", "unidade_comercial", "unidade_tributavel", "origem", "stock_quantity", "min_stock", "cost_price", "is_active", "is_featured", "track_stock", "hide_price_on_site"];
const FIELD_LABELS: Record<string, string> = {
  price: "Preço", cost_price: "Custo", discount_price: "Preço promocional", price_per_measure: "Preço por medida",
  min_billable_quantity: "Mínimo faturável", max_discount_pct: "Desconto máximo", stock_quantity: "Estoque", min_stock: "Estoque mínimo",
  weight_grams: "Peso", measure_stock_quantity: "Estoque por medida", measure_min_stock: "Estoque mínimo por medida",
  package_length_cm: "Comprimento da embalagem", package_width_cm: "Largura da embalagem", package_height_cm: "Altura da embalagem",
  icms_aliquota: "Alíquota ICMS", pis_aliquota: "Alíquota PIS", cofins_aliquota: "Alíquota COFINS", origem: "Origem",
};

// "1.234,56" → 1234.56 ; "12,5" → 12.5 ; 12.5 → 12.5
function parseProductNumber(v: unknown): number {
  if (typeof v === "number") return v;
  const t = String(v).trim();
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
}

async function normalizeProductInput(rest: Record<string, any>, tenantId: number, mode: "create" | "update") {
  // 1) só campos que existem no produto
  for (const key of Object.keys(rest)) if (!PRODUCT_FIELDS.has(key)) delete rest[key];

  // 2) texto
  if ("name" in rest) {
    const name = typeof rest.name === "string" ? rest.name.trim() : "";
    if (!name) throw new ProductInputError("Preencha o nome do produto.");
    rest.name = name.slice(0, 191);
  } else if (mode === "create") throw new ProductInputError("Preencha o nome do produto.");
  for (const [field, max] of [["sku", 191], ["barcode", 64], ["measure_unit", 10]] as const) {
    if (field in rest) {
      const v = rest[field] == null ? "" : String(rest[field]).trim();
      rest[field] = v === "" ? null : v.slice(0, max);
    }
  }
  if ("description" in rest && rest.description != null) rest.description = String(rest.description);

  // 3) números
  for (const field of INT_FIELDS) {
    if (!(field in rest)) continue;
    if (rest[field] === "" || rest[field] == null) { if (NOT_NULL_DEFAULTED.includes(field)) delete rest[field]; else rest[field] = null; continue; }
    const n = parseProductNumber(rest[field]);
    if (!Number.isFinite(n)) throw new ProductInputError(`${FIELD_LABELS[field]}: valor inválido.`);
    if (Math.abs(n) > 2147483647) throw new ProductInputError(`${FIELD_LABELS[field]}: valor grande demais.`);
    rest[field] = Math.round(n);
  }
  for (const [field, limit] of Object.entries(DECIMAL_FIELDS)) {
    if (!(field in rest)) continue;
    if (rest[field] === "" || rest[field] == null) { if (NOT_NULL_DEFAULTED.includes(field)) delete rest[field]; else rest[field] = null; continue; }
    const n = parseProductNumber(rest[field]);
    if (!Number.isFinite(n)) throw new ProductInputError(`${FIELD_LABELS[field]}: valor inválido.`);
    if (Math.abs(n) >= limit) throw new ProductInputError(`${FIELD_LABELS[field]}: valor grande demais.`);
    rest[field] = n;
  }

  // 4) preço é obrigatório no banco: produto por medida pode vir sem "price" — usa o preço por medida (ou 0)
  if (mode === "create" && (rest.price === undefined || rest.price === null)) {
    rest.price = Number(rest.price_per_measure) > 0 ? rest.price_per_measure : 0;
  }
  if (mode === "update" && "price" in rest && rest.price == null) delete rest.price;

  // 5) data de validade
  if ("expiry_date" in rest) {
    if (!rest.expiry_date) rest.expiry_date = null;
    else {
      const d = new Date(rest.expiry_date);
      if (Number.isNaN(d.getTime())) throw new ProductInputError("Data de validade inválida.");
      rest.expiry_date = d;
    }
  }

  // 6) campos que não aceitam null no banco: null/"" vira o padrão
  for (const field of NOT_NULL_DEFAULTED) if (field in rest && (rest[field] === null || rest[field] === "")) delete rest[field];
  for (const field of ["is_active", "is_featured", "track_stock", "hide_price_on_site"]) if (field in rest) rest[field] = Boolean(rest[field]);

  // 7) categoria precisa existir nesta loja (senão a chave estrangeira falha)
  if ("category_id" in rest) {
    const id = Number(rest.category_id);
    if (!rest.category_id || !Number.isInteger(id) || id <= 0) rest.category_id = null;
    else {
      const cat = await prisma.category.findFirst({ where: { id, tenant_id: tenantId }, select: { id: true } });
      if (!cat) throw new ProductInputError("Categoria inválida ou removida. Escolha a categoria de novo.");
      rest.category_id = id;
    }
  }
}

// Erros do banco (Prisma) → mensagem clara em português.
function productDbErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ProductInputError) return e.message;
  const code = (e as { code?: string })?.code;
  if (code === "P2000") return "Algum campo está com texto grande demais. Confira NCM (8 dígitos), CEST (7), CFOP (4) e a unidade de medida.";
  if (code === "P2002") return "Já existe um produto com esse código (SKU/código de barras).";
  if (code === "P2003") return "Categoria ou vínculo inválido. Escolha a categoria de novo.";
  if (code === "P2025") return "Produto não encontrado.";
  if (e instanceof Prisma.PrismaClientValidationError) return "Algum campo do produto está com valor inválido. Confira preços, estoque e datas.";
  return fallback;
}

function validateCfop(cfop: unknown): string | null {
  if (cfop === undefined || cfop === null || cfop === "") return null;
  const value = String(cfop);
  if (!/^\d{4}$/.test(value)) {
    return "CFOP inválido — precisa ter exatamente 4 dígitos.";
  }
  const firstDigit = value[0];
  if (firstDigit === "1" || firstDigit === "2" || firstDigit === "3") {
    return `CFOP ${value} é de ENTRADA (compra/devolução) — produtos vendidos pela NFC-e precisam de um CFOP de SAÍDA (começando com 5, 6 ou 7). Ex.: 5102 para venda dentro do estado.`;
  }
  return null;
}

export async function getLowStockCount(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);

    // Loja vende por encomenda/sem controle de estoque — não decrementa
    // stock_quantity no PDV, então o conceito de "estoque crítico/esgotado"
    // não se aplica. Retorna vazio pra não gerar badge/alerta na sidebar.
    const tenantFlag = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { sell_without_stock_control: true },
    });
    if (tenantFlag?.sell_without_stock_control) {
      res.json({ count: 0, products: [], threshold: 0 });
      return;
    }

    // min_stock é um valor POR PRODUTO agora (cadastro do produto) — sempre manda sobre
    // o threshold global antigo (preferência por usuário), que fica só como o valor
    // default sugerido no formulário de um produto novo (ver Product model, default 5).
    const active = await prisma.product.findMany({
      where: { tenant_id: tenantId, is_active: true, track_stock: true },
      select: {
        id: true, name: true, stock_quantity: true, min_stock: true,
        sale_unit: true, measure_stock_quantity: true, measure_min_stock: true,
      },
    });
    const products = active
      .filter((p) => p.sale_unit !== "unidade"
        ? Number(p.measure_min_stock ?? 0) > 0 && Number(p.measure_stock_quantity ?? 0) <= Number(p.measure_min_stock ?? 0)
        : p.min_stock > 0 && p.stock_quantity <= p.min_stock)
      .sort((a, b) => {
        const stockA = a.sale_unit !== "unidade" ? Number(a.measure_stock_quantity ?? 0) : a.stock_quantity;
        const stockB = b.sale_unit !== "unidade" ? Number(b.measure_stock_quantity ?? 0) : b.stock_quantity;
        return stockA - stockB;
      });
    // threshold retornado só por compatibilidade com quem já consome esse endpoint
    // (ex.: exibir "abaixo de X unidades" em algum lugar do frontend).
    const threshold = await getLowStockThreshold((req as AuthenticatedRequest).user.userId);
    res.json({ count: products.length, products, threshold });
  } catch {
    res.status(500).json({ error: "Failed to fetch low stock count" });
  }
}

export async function listProducts(req: Request, res: Response) {
  try {
    const onlyActive = req.query.active === "true";

    // Consulta paginada (PDV/catálogo grandes): só ativa quando o front manda page, limit
    // ou search. Sem esses parâmetros o comportamento antigo (lista completa) continua
    // igual, para não quebrar telas e o cache offline do desktop.
    if (req.query.page !== undefined || req.query.limit !== undefined || req.query.search !== undefined) {
      const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
      const limit = Math.min(200, Math.max(1, Math.floor(Number(req.query.limit)) || 60));
      const search = String(req.query.search ?? "").trim();
      const categoryId = Number(req.query.category_id);
      const where: Record<string, unknown> = {
        tenant_id: getTenantId(req),
        ...(onlyActive ? { is_active: true } : {}),
        ...(Number.isFinite(categoryId) && categoryId > 0 ? { category_id: categoryId } : {}),
        ...(search
          ? { OR: [{ name: { contains: search } }, { sku: { contains: search } }, { barcode: { contains: search } }] }
          : {}),
      };
      const [total, rows] = await Promise.all([
        prisma.product.count({ where }),
        prisma.product.findMany({
          where,
          include: { category: { select: { name: true } } },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);
      res.json({
        items: rows.map((product) => ({ ...product, category_name: product.category?.name ?? null })),
        total,
        page,
        limit,
        hasMore: page * limit < total,
      });
      return;
    }

    const products = await prisma.product.findMany({
      where: {
        tenant_id: getTenantId(req),
        ...(onlyActive ? { is_active: true } : {}),
      },
      include: {
        category: {
          select: { name: true },
        },
      },
    });

    res.json(
      products.map((product) => ({
        ...product,
        category_name: product.category?.name ?? null,
      }))
    );
  } catch {
    res.status(500).json({ error: "Failed to fetch products" });
  }
}

export async function getProduct(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const tenantId = getTenantId(req);
    const product = await prisma.product.findFirst({
      where: { id, tenant_id: tenantId },
      include: { category: { select: { name: true } } },
    });
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json({ ...product, category_name: product.category?.name ?? null });
  } catch {
    res.status(500).json({ error: "Failed to fetch product" });
  }
}

export async function getProductByBarcode(req: Request, res: Response) {
  try {
    const code = req.params.code;
    const tenantId = getTenantId(req);
    const product = await prisma.product.findFirst({
      where: { barcode: code, tenant_id: tenantId },
      include: { category: { select: { name: true } } },
    });
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json({ ...product, category_name: product.category?.name ?? null });
  } catch {
    res.status(500).json({ error: "Failed to fetch product" });
  }
}

export async function createProduct(req: Request, res: Response) {
  try {
    const {
      images, variations, attributes, skus, storefront_details,
      tenant_id: _tid, id: _id, category, category_name,
      created_at, updated_at, piece_kind: _pk, piece_defaults: _pd,
      ...rest
    } = req.body;

    cleanFiscalDigits(rest);
    await normalizeProductInput(rest, getTenantId(req), "create");
    const cfopWarning = validateCfop(rest.cfop);

    const product = await prisma.product.create({
      data: {
        ...rest,
        ...pieceFieldsFor(req.body),
        // Nome do produto sempre em caixa alta — padroniza o catálogo (evita mistura
        // de maiúsculas/minúsculas entre produtos cadastrados por vias diferentes).
        ...(typeof rest.name === "string" ? { name: rest.name.toUpperCase() } : {}),
        tenant_id: getTenantId(req),
        images: Array.isArray(images) ? images : undefined,
        variations: Array.isArray(variations) ? variations : undefined,
        attributes: Array.isArray(attributes) ? attributes : undefined,
        skus: Array.isArray(skus) ? skus : undefined,
        storefront_details: publicDetails(storefront_details),
      },
    });

    emitToTenant(getTenantId(req), "product:changed", { productId: product.id });

    res.json({ id: product.id, ...(cfopWarning ? { warning: cfopWarning } : {}) });
  } catch (e) {
    if (!(e instanceof ProductInputError)) console.error("[createProduct] tenant=" + getTenantId(req) + ":", e instanceof Error ? e.message.slice(-600) : e);
    res.status(e instanceof ProductInputError ? 400 : 500).json({ error: productDbErrorMessage(e, "Não foi possível cadastrar o produto. Tente novamente; se continuar, avise o suporte.") });
  }
}

// Fields we track in history with human-readable labels
const TRACKED_FIELDS: Record<string, string> = {
  name:           "Nome",
  price:          "Preço de venda",
  cost_price:     "Custo unitário",
  discount_price: "Promoção",
  max_discount_pct: "Desconto máximo no PDV",
  stock_quantity: "Estoque",
  min_stock:      "Estoque mínimo",
  sku:            "SKU",
  barcode:        "Código de barras",
  description:    "Descrição",
  is_active:      "Status ativo",
  is_featured:    "Destaque na home",
  category_id:    "Categoria",
  ncm:            "NCM",
  cfop:           "CFOP",
  csosn:          "CSOSN",
  cst_icms:       "CST ICMS",
};

function fmtHistoryVal(field: string, val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (field === "price" || field === "cost_price" || field === "discount_price") {
    return `R$ ${Number(val).toFixed(2)}`;
  }
  if (field === "max_discount_pct") return `${Number(val).toFixed(0)}%`;
  if (field === "is_active")   return val ? "Ativo" : "Inativo";
  if (field === "is_featured") return val ? "Sim" : "Não";
  return String(val);
}

/** Ativa/inativa um produto sem reenviar o cadastro todo (usado na tela de duplicados). */
export async function setProductActive(req: Request, res: Response) {
  try {
    const r = await prisma.product.updateMany({ where: { id: Number(req.params.id), tenant_id: getTenantId(req) }, data: { is_active: !!req.body?.is_active } });
    if (!r.count) { res.status(404).json({ error: "Produto não encontrado." }); return; }
    res.json({ ok: true, is_active: !!req.body?.is_active });
  } catch (e) { console.error("setProductActive:", e); res.status(500).json({ error: "Falha ao alterar o produto." }); }
}

export async function updateProduct(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const tenantId = getTenantId(req);

    // Load full existing record for diff
    const existing = await prisma.product.findFirst({
      where: { id, tenant_id: tenantId },
      select: {
        image_url: true, images: true,
        name: true, price: true, cost_price: true, discount_price: true, max_discount_pct: true,
        stock_quantity: true, min_stock: true, measure_stock_quantity: true, measure_min_stock: true,
        sku: true, barcode: true, description: true,
        is_active: true, is_featured: true, category_id: true,
        ncm: true, cfop: true, csosn: true, cst_icms: true, sale_unit: true,
      },
    });

    if (existing) {
      // Handle removed images from disk
      if (req.body.image_url !== undefined && existing.image_url && existing.image_url !== req.body.image_url) {
        deleteProductImage(existing.image_url);
      }
      if (req.body.images !== undefined) {
        const oldImages = Array.isArray(existing.images) ? (existing.images as string[]) : [];
        const newImages: string[] = Array.isArray(req.body.images) ? req.body.images : [];
        oldImages.filter(u => !newImages.includes(u)).forEach(u => deleteProductImage(u));
      }
    }

    const {
      images, variations, attributes, skus, storefront_details,
      tenant_id: _tid, id: _id, category, category_name,
      created_at, updated_at, piece_kind: _pk, piece_defaults: _pd,
      ...rest
    } = req.body;

    cleanFiscalDigits(rest);
    await normalizeProductInput(rest, tenantId, "update");
    const cfopWarning = validateCfop(rest.cfop);

    await prisma.product.updateMany({
      where: { id, tenant_id: tenantId },
      data: {
        ...rest,
        ...pieceFieldsFor(req.body, existing?.sale_unit),
        // Nome do produto sempre em caixa alta — padroniza o catálogo (evita mistura
        // de maiúsculas/minúsculas entre produtos cadastrados por vias diferentes).
        ...(typeof rest.name === "string" ? { name: rest.name.toUpperCase() } : {}),
        images: Array.isArray(images) ? images : undefined,
        variations: Array.isArray(variations) ? variations : undefined,
        attributes: Array.isArray(attributes) ? attributes : undefined,
        skus: Array.isArray(skus) ? skus : undefined,
        storefront_details: publicDetails(storefront_details),
      },
    });

    // Record history for changed tracked fields
    if (existing) {
      const historyRows: { tenant_id: number; product_id: number; field: string; old_value: string | null; new_value: string | null }[] = [];
      for (const field of Object.keys(TRACKED_FIELDS)) {
        const inBody = field in rest ? rest[field] : undefined;
        if (inBody === undefined) continue;
        const oldRaw = (existing as Record<string, unknown>)[field];
        const newRaw = inBody;
        const oldStr = fmtHistoryVal(field, oldRaw);
        const newStr = fmtHistoryVal(field, newRaw);
        if (oldStr !== newStr) {
          historyRows.push({
            tenant_id:  tenantId,
            product_id: id,
            field:      TRACKED_FIELDS[field],
            old_value:  oldStr,
            new_value:  newStr,
          });
        }
      }
      if (historyRows.length > 0) {
        await prisma.productHistory.createMany({ data: historyRows });
      }
    }

    emitToTenant(tenantId, "product:changed", { productId: id });
    emitToTenant(tenantId, "stock:changed", { productId: id });

    res.json({ success: true, ...(cfopWarning ? { warning: cfopWarning } : {}) });
  } catch (e) {
    if (!(e instanceof ProductInputError)) console.error("[updateProduct] tenant=" + getTenantId(req) + ":", e instanceof Error ? e.message.slice(-600) : e);
    res.status(e instanceof ProductInputError ? 400 : 500).json({ error: productDbErrorMessage(e, "Não foi possível salvar o produto. Tente novamente; se continuar, avise o suporte.") });
  }
}

export async function getProductHistory(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const tenantId = getTenantId(req);
    const history = await prisma.productHistory.findMany({
      where: { product_id: id, tenant_id: tenantId },
      orderBy: { created_at: "desc" },
      take: 100,
    });
    res.json(history);
  } catch {
    res.status(500).json({ error: "Failed to fetch product history" });
  }
}

export async function deleteProduct(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const tenantId = getTenantId(req);

    const existing = await prisma.product.findFirst({ where: { id, tenant_id: tenantId }, select: { image_url: true, images: true } });
    if (existing?.image_url) deleteProductImage(existing.image_url);
    const extraImages = Array.isArray(existing?.images) ? (existing.images as string[]) : [];
    extraImages.forEach(url => deleteProductImage(url));

    await prisma.product.deleteMany({ where: { id, tenant_id: tenantId } });

    emitToTenant(tenantId, "product:changed", { productId: id });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete product" });
  }
}

export async function adjustProductStock(req: Request, res: Response) {
  const { productId, quantity, type } = req.body;
  let reason: string | undefined = req.body.reason;
  // Variação (combinação de atributos) cujo saldo deve ser ajustado. Ex.: {"Cor":"Azul","Tamanho":"M"}
  const combo: Record<string, string> | null =
    req.body.combo && typeof req.body.combo === "object" && Object.keys(req.body.combo).length > 0
      ? req.body.combo
      : null;

  try {
    const tenantId = getTenantId(req);
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        tenant_id: tenantId,
      },
    });

    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const measured = product.sale_unit !== "unidade";
    const adjustment = Number(quantity);
    if (!Number.isFinite(adjustment) || adjustment === 0) {
      res.status(400).json({ error: "Quantidade de ajuste inválida" });
      return;
    }

    let skusUpdate: { skus?: any; variations?: any } | null = null;
    const legacy = Array.isArray(product.variations) ? (product.variations as { name: string; options: { value: string; stock: number }[] }[]) : [];
    const hasSkus = Array.isArray(product.skus) && (product.skus as unknown[]).length > 0;
    if (combo && !hasSkus && legacy.length) {
      skusUpdate = {
        variations: legacy.map((v) => ({
          ...v,
          options: v.options.map((o) =>
            combo[v.name] === o.value ? { ...o, stock: Math.max(0, Number(o.stock || 0) + adjustment) } : o,
          ),
        })),
      };
      const label = Object.values(combo).join(" / ");
      reason = reason ? `[${label}] ${reason}` : `[${label}]`;
    } else if (combo) {
      const skus = Array.isArray(product.skus) ? (product.skus as { combo: Record<string, string>; stock: number }[]) : [];
      const sameCombo = (c: Record<string, string>) => {
        const keys = Object.keys(combo);
        return keys.length === Object.keys(c || {}).length && keys.every((k) => c?.[k] === combo[k]);
      };
      const idx = skus.findIndex((s) => sameCombo(s.combo));
      if (idx < 0) {
        res.status(400).json({ error: "Variação não encontrada neste produto" });
        return;
      }
      skusUpdate = {
        skus: skus.map((s, i) => (i === idx ? { ...s, stock: Math.max(0, Number(s.stock || 0) + adjustment) } : s)),
      };
      const label = Object.values(combo).join(" / ");
      reason = reason ? `[${label}] ${reason}` : `[${label}]`;
    }

    await prisma.$transaction([
      prisma.product.update({
        where: { id: productId },
        data: {
          ...(measured
            ? { measure_stock_quantity: { increment: adjustment } }
            : { stock_quantity: { increment: adjustment } }),
          ...(skusUpdate ?? {}),
        },
      }),
      prisma.stockMovement.create({
        data: {
          tenant_id: tenantId,
          product_id: productId,
          quantity: measured ? 0 : adjustment,
          measured_quantity: measured ? adjustment : null,
          type,
          reason,
        },
      }),
    ]);

    emitToTenant(tenantId, "stock:changed", { productId });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Stock adjustment failed" });
  }
}

export async function listProductMovements(req: Request, res: Response) {
  try {
    const movements = await prisma.stockMovement.findMany({
      where: { tenant_id: getTenantId(req) },
      include: {
        product: {
          select: { name: true },
        },
      },
      orderBy: { created_at: "desc" },
      take: 50,
    });

    res.json(
      movements.map((movement) => ({
        ...movement,
        product_name: movement.product.name,
      }))
    );
  } catch {
    res.status(500).json({ error: "Failed to fetch movements" });
  }
}

// ── Exportação completa do catálogo (Excel/CSV) ──
const num = (v: unknown) => (v == null || v === "" ? "" : Number(v));
const dateBR = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10).split("-").reverse().join("/") : "");
const yesNo = (v: boolean) => (v ? "Sim" : "Não");
const SALE_UNIT_LABEL: Record<string, string> = { unidade: "Unidade", m2: "m²", linear: "Metro linear", peso: "Peso", volume: "Volume" };
const TYPE_LABEL: Record<string, string> = { sale: "Venda", supply: "Insumo", service: "Serviço" };

export async function exportProducts(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    const format = String(req.query.format ?? "xlsx").toLowerCase() === "csv" ? "csv" : "xlsx";
    const products = await prisma.product.findMany({
      where: { tenant_id: tenantId },
      include: { category: { select: { name: true } } },
      orderBy: { name: "asc" },
    });

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = "BoxSys Store";
    wb.created = new Date();

    const addSheet = (name: string, columns: { header: string; width: number }[], rows: unknown[][]) => {
      const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
      ws.columns = columns.map((c) => ({ header: c.header, width: c.width }));
      const head = ws.getRow(1);
      head.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      });
      head.height = 22;
      rows.forEach((r) => ws.addRow(r));
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
      return ws;
    };

    const produtos = addSheet(
      "Produtos",
      [
        ["Código", 9], ["Nome", 38], ["SKU", 18], ["Código de barras", 16], ["Categoria", 20], ["Tipo", 10],
        ["Descrição", 40], ["Preço de venda", 13], ["Preço promocional", 13], ["Custo", 11], ["Margem %", 10],
        ["Desconto máx. PDV %", 12], ["Estoque", 9], ["Estoque mínimo", 10], ["Controla estoque", 11],
        ["Unidade de venda", 14], ["Preço por medida", 13], ["Unidade de medida", 11], ["Estoque (medida)", 12],
        ["Faturável mínimo", 12], ["Validade", 11], ["Ativo", 7], ["Destaque", 9], ["Preço oculto na loja", 12],
        ["Peso (g)", 9], ["Comprimento (cm)", 11], ["Largura (cm)", 10], ["Altura (cm)", 10], ["Imagem", 40],
        ["Cadastrado em", 12], ["Atualizado em", 12],
      ].map(([header, width]) => ({ header: header as string, width: width as number })),
      products.map((p) => {
        const price = Number(p.price), cost = Number(p.cost_price);
        return [
          p.id, p.name, p.sku ?? "", p.barcode ?? "", p.category?.name ?? "", TYPE_LABEL[p.type] ?? p.type,
          p.description ?? "", price, num(p.discount_price), cost, cost > 0 && price > 0 ? Math.round(((price - cost) / cost) * 1000) / 10 : "",
          num(p.max_discount_pct), p.stock_quantity, p.min_stock, yesNo(p.track_stock),
          SALE_UNIT_LABEL[p.sale_unit] ?? p.sale_unit, num(p.price_per_measure), p.measure_unit ?? "", num(p.measure_stock_quantity),
          num(p.min_billable_quantity), dateBR(p.expiry_date), yesNo(p.is_active), yesNo(p.is_featured), yesNo(p.hide_price_on_site),
          p.weight_grams ?? "", num(p.package_length_cm), num(p.package_width_cm), num(p.package_height_cm), p.image_url ?? "",
          dateBR(p.created_at), dateBR(p.updated_at),
        ];
      }),
    );
    for (const col of [8, 9, 10, 17]) produtos.getColumn(col).numFmt = '"R$" #,##0.00';

    addSheet(
      "Fiscal",
      [["Código", 9], ["Produto", 38], ["NCM", 11], ["CEST", 9], ["CFOP", 7], ["Origem", 8], ["Unid. comercial", 10], ["Unid. tributável", 10],
        ["CSOSN", 8], ["CST ICMS", 9], ["Alíq. ICMS %", 10], ["CST PIS", 8], ["Alíq. PIS %", 10], ["CST COFINS", 10], ["Alíq. COFINS %", 11]]
        .map(([header, width]) => ({ header: header as string, width: width as number })),
      products.map((p) => [
        p.id, p.name, p.ncm ?? "", p.cest ?? "", p.cfop ?? "", p.origem, p.unidade_comercial, p.unidade_tributavel,
        p.csosn ?? "", p.cst_icms ?? "", num(p.icms_aliquota), p.pis_cst ?? "", num(p.pis_aliquota), p.cofins_cst ?? "", num(p.cofins_aliquota),
      ]),
    );

    const attrNames = new Set<string>();
    type Sku = { combo?: Record<string, string>; stock?: number };
    const skuRows: { p: (typeof products)[number]; combo: Record<string, string>; stock: number }[] = [];
    for (const p of products) {
      const skus = Array.isArray(p.skus) ? (p.skus as Sku[]) : [];
      if (skus.length) {
        for (const s of skus) {
          const combo = s.combo && typeof s.combo === "object" ? s.combo : {};
          Object.keys(combo).forEach((k) => attrNames.add(k));
          skuRows.push({ p, combo, stock: Number(s.stock ?? 0) });
        }
      } else if (Array.isArray(p.variations)) {
        // formato antigo: uma variação por opção
        for (const v of p.variations as { name?: string; options?: { value: string; stock: number }[] }[]) {
          for (const o of v.options ?? []) {
            if (v.name) attrNames.add(v.name);
            skuRows.push({ p, combo: v.name ? { [v.name]: o.value } : {}, stock: Number(o.stock ?? 0) });
          }
        }
      }
    }
    const attrCols = [...attrNames];
    addSheet(
      "Variações",
      [{ header: "Código", width: 9 }, { header: "Produto", width: 38 }, { header: "Combinação", width: 28 },
        ...attrCols.map((a) => ({ header: a, width: 14 })), { header: "Estoque", width: 9 }],
      skuRows.map(({ p, combo, stock }) => [p.id, p.name, Object.values(combo).join(" / "), ...attrCols.map((a) => combo[a] ?? ""), stock]),
    );

    const today = new Date().toISOString().split("T")[0];
    if (format === "csv") {
      // CSV só leva a primeira aba (Produtos); BOM para o Excel reconhecer UTF-8.
      wb.worksheets.slice(1).forEach((w) => wb.removeWorksheet(w.id));
      const buf = await wb.csv.writeBuffer({ formatterOptions: { delimiter: ";" } });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="produtos_${today}.csv"`);
      res.send(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(buf)]));
    } else {
      const buf = await wb.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="produtos_${today}.xlsx"`);
      res.send(Buffer.from(buf));
    }
  } catch (err) {
    console.error("exportProducts", err);
    res.status(500).json({ error: "Falha ao exportar produtos" });
  }
}
