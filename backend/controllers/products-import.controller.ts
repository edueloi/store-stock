import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";

import { prisma } from "../config/prisma";
import type { AuthenticatedRequest } from "../types/auth";

function getTenantId(req: Request) {
  return (req as AuthenticatedRequest).user.tenantId;
}

const normHeader = (h: unknown) =>
  String(h ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\(.*?\)/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Divide uma linha CSV respeitando aspas ("" = aspas literal). */
export function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/** CSV completo (aceita quebra de linha dentro de aspas) → matriz de textos. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const first = clean.split(/\r?\n/, 1)[0] ?? "";
  const delim = [";", ",", "\t"].map((d) => [d, splitCsvLine(first, d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const lines: string[] = [];
  let buf = "";
  for (const raw of clean.split(/\r?\n/)) {
    buf = buf ? `${buf}\n${raw}` : raw;
    if ((buf.match(/"/g) ?? []).length % 2 === 0) { lines.push(buf); buf = ""; }
  }
  if (buf) lines.push(buf);
  return lines.filter((l) => l.trim()).map((l) => splitCsvLine(l, delim));
}

export const brNumber = (v: unknown): number | null => {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim().replace(/[R$\s%]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/**
 * Importa produtos de CSV, XLS/XML do Excel ou XLSX. Casa por SKU ("Código do Produto"), código de
 * barras ou nome: quem já existe é atualizado, o resto é criado. Linhas ruins entram em `errors`.
 */
export async function importProducts(req: Request, res: Response) {
  try {
    const tenantId = getTenantId(req);
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });

    let rows: string[][];
    if (/\.csv$/i.test(req.file.originalname) || req.file.mimetype.includes("csv")) {
      const buf = req.file.buffer;
      const hasBom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
      const asUtf8 = buf.toString("utf8");
      rows = parseCsv(hasBom || !asUtf8.includes("�") ? asUtf8 : buf.toString("latin1"));
    } else {
      const wb = XLSX.read(req.file.buffer, { type: "buffer", cellDates: false });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) return res.status(422).json({ error: "Planilha vazia ou sem abas" });
      rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" }).map((r) => r.map((c) => String(c ?? "")));
      // Planilhas salvas com a linha CSV inteira numa única célula: separa de volta em colunas.
      if (rows.length && rows[0].filter((c) => c.trim()).length === 1 && rows[0].join("").includes(",")) {
        rows = rows.map((r) => splitCsvLine(r.find((c) => c.trim()) ?? "", ","));
      }
    }
    if (rows.length < 2) return res.status(422).json({ error: "O arquivo não tem produtos para importar." });

    const col: Record<string, number> = {};
    rows[0].forEach((h, i) => {
      const k = normHeader(h);
      if (k && !(k in col)) col[k] = i;
    });
    const get = (r: string[], ...keys: string[]) => {
      for (const k of keys) {
        const idx = col[k];
        if (idx != null && String(r[idx] ?? "").trim() !== "") return String(r[idx]).trim();
      }
      return "";
    };
    if (col["nome do produto"] == null && col["nome"] == null && col["produto"] == null) {
      return res.status(422).json({ error: 'Não achei a coluna "Nome do Produto" no cabeçalho do arquivo.' });
    }

    const [existing, cats] = await Promise.all([
      prisma.product.findMany({ where: { tenant_id: tenantId }, select: { id: true, sku: true, barcode: true, name: true } }),
      prisma.category.findMany({ where: { tenant_id: tenantId }, select: { id: true, name: true } }),
    ]);
    const bySku = new Map<string, number>();
    const byBarcode = new Map<string, number>();
    const byName = new Map<string, number>();
    for (const p of existing) {
      if (p.sku) bySku.set(p.sku.toLowerCase(), p.id);
      if (p.barcode) byBarcode.set(p.barcode, p.id);
      byName.set(p.name.trim().toLowerCase(), p.id);
    }
    const catByName = new Map(cats.map((c) => [c.name.trim().toLowerCase(), c.id]));
    const catId = async (name: string) => {
      const key = name.toLowerCase();
      if (!catByName.has(key)) {
        const c = await prisma.category.create({ data: { tenant_id: tenantId, name }, select: { id: true } });
        catByName.set(key, c.id);
      }
      return catByName.get(key)!;
    };

    // O arquivo só traz o ID da categoria do sistema antigo; o nome mais frequente do grupo (coluna
    // "Localização no Estoque") vira o nome da categoria, para não criar uma categoria por variação de texto.
    const groupNames = new Map<string, Map<string, { label: string; n: number }>>();
    for (let i = 1; i < rows.length; i++) {
      const gid = get(rows[i], "id categoria");
      const label = get(rows[i], "localizacao no estoque");
      if (!gid || gid === "0" || !label) continue;
      const g = groupNames.get(gid) ?? new Map();
      const k = label.toLowerCase();
      g.set(k, { label: g.get(k)?.label ?? label, n: (g.get(k)?.n ?? 0) + 1 });
      groupNames.set(gid, g);
    }
    const groupLabel = (gid: string) => {
      const g = groupNames.get(gid);
      return g ? [...g.values()].sort((a, b) => b.n - a.n)[0].label : "";
    };
    const cleanUnit = (u: string) => {
      const up = u.toUpperCase();
      if (["UNI", "UNID", "UNIDAD", "UNIDADE", "U"].includes(up)) return "UN";
      return /^[A-Z]{1,4}$/.test(up) && up !== "KIMAST" ? up : "UN";
    };
    const errors: { row: number; message: string }[] = [];
    const seenNew = new Map<string, number>(); // linhas repetidas dentro do próprio arquivo
    const creates: Prisma.ProductUncheckedCreateInput[] = [];
    const updates: { id: number; data: Prisma.ProductUncheckedUpdateInput }[] = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      try {
        const name = get(r, "nome do produto", "nome", "produto");
        if (!name || /^[.\-\s]+$/.test(name)) {
          errors.push({ row: i + 1, message: "Sem nome — linha ignorada" });
          continue;
        }
        const sku = get(r, "codigo do produto", "codigo", "sku");
        const barcode = get(r, "codigo de barras gtin 8 12 13 14", "codigo de barras", "gtin").replace(/\D/g, "");
        const price = brNumber(get(r, "valor venda tabela padrao", "valor venda", "preco"));
        const cost = brNumber(get(r, "valor custo", "custo"));
        const stock = brNumber(get(r, "estoque atual", "estoque"));
        const minStock = brNumber(get(r, "estoque minimo"));
        const weightKg = brNumber(get(r, "peso"));
        const icms = brNumber(get(r, "icms"));
        const pis = brNumber(get(r, "pis"));
        const cofins = brNumber(get(r, "cofins"));
        const origem = brNumber(get(r, "origem"));
        const ncm = get(r, "ncm").replace(/\D/g, "").slice(0, 8);
        const cest = get(r, "codigo cest", "cest").replace(/\D/g, "").slice(0, 7);
        const unit = get(r, "unidade") ? cleanUnit(get(r, "unidade")) : "";
        const unitTrib = get(r, "unidade tributavel") ? cleanUnit(get(r, "unidade tributavel")) : "";
        const brand = get(r, "marca");
        const obs = get(r, "observacoes");
        const place = groupLabel(get(r, "id categoria")) || get(r, "localizacao no estoque");
        const status = get(r, "situacao", "situacao ativo inativo").toLowerCase();

        const base = {
          name: name.slice(0, 191),
          sku: sku || null,
          barcode: barcode || null,
          description: [obs, brand ? `Marca: ${brand}` : ""].filter(Boolean).join("\n") || null,
          ...(price != null ? { price } : {}),
          ...(cost != null ? { cost_price: cost } : {}),
          ...(stock != null ? { stock_quantity: Math.max(0, Math.round(stock)) } : {}),
          ...(minStock != null ? { min_stock: Math.max(0, Math.round(minStock)) } : {}),
          ...(weightKg ? { weight_grams: Math.round(weightKg * 1000) } : {}),
          ...(ncm ? { ncm } : {}),
          ...(cest ? { cest } : {}),
          ...(origem != null && origem >= 0 && origem <= 8 ? { origem: Math.round(origem) } : {}),
          ...(unit ? { unidade_comercial: unit } : {}),
          ...(unitTrib ? { unidade_tributavel: unitTrib } : {}),
          ...(icms ? { icms_aliquota: icms } : {}),
          ...(pis ? { pis_aliquota: pis } : {}),
          ...(cofins ? { cofins_aliquota: cofins } : {}),
          ...(status ? { is_active: !status.startsWith("inat") } : {}),
          ...(place ? { category_id: await catId(place) } : {}),
        };

        const key = sku ? `s:${sku.toLowerCase()}` : barcode ? `b:${barcode}` : `n:${name.toLowerCase()}`;
        const existingId = sku ? bySku.get(sku.toLowerCase()) : barcode ? byBarcode.get(barcode) : byName.get(name.toLowerCase());
        const newRow = (extra: Prisma.ProductUncheckedCreateInput | null) =>
          ({ ...(extra ?? {}), ...base, tenant_id: tenantId, price: base.price ?? 0, type: "sale", is_active: base.is_active ?? true }) as Prisma.ProductUncheckedCreateInput;

        if (existingId) updates.push({ id: existingId, data: base });
        else if (seenNew.has(key)) creates[seenNew.get(key)!] = newRow(creates[seenNew.get(key)!]);
        else {
          seenNew.set(key, creates.length);
          creates.push(newRow(null));
        }
      } catch (e) {
        errors.push({ row: i + 1, message: e instanceof Error ? e.message : "Linha inválida" });
      }
    }

    for (let i = 0; i < creates.length; i += 500) await prisma.product.createMany({ data: creates.slice(i, i + 500) });
    for (let i = 0; i < updates.length; i += 25) {
      await Promise.all(updates.slice(i, i + 25).map((u) => prisma.product.update({ where: { id: u.id }, data: u.data })));
    }
    res.json({ created: creates.length, updated: updates.length, errors });
  } catch (err) {
    console.error("importProducts", err);
    res.status(500).json({ error: "Falha ao importar a planilha de produtos" });
  }
}
