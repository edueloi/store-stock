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
        ? Number(p.measure_stock_quantity ?? 0) <= Number(p.measure_min_stock ?? 0)
        : p.stock_quantity <= p.min_stock)
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
  } catch {
    res.status(500).json({ error: "Failed to create product" });
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
  } catch {
    res.status(500).json({ error: "Failed to update product" });
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
  const { productId, quantity, type, reason } = req.body;

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

    await prisma.$transaction([
      prisma.product.update({
        where: { id: productId },
        data: measured
          ? { measure_stock_quantity: { increment: adjustment } }
          : { stock_quantity: { increment: adjustment } },
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
