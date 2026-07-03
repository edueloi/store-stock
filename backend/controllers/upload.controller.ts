import fs from "fs";
import path from "path";

import type { Request, Response } from "express";
import multer from "multer";

import type { AuthenticatedRequest } from "../types/auth";

const UPLOADS_BASE = path.join(process.cwd(), "public", "uploads");

function tenantDir(req: Request, sub: "products" | "logos" | "services" | "service-orders"): string {
  const tenantId = (req as AuthenticatedRequest).user?.tenantId ?? "shared";
  const dir = path.join(UPLOADS_BASE, sub, String(tenantId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Apenas imagens são permitidas (jpg, png, webp, gif)"));
};

const serviceFileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ["image/jpeg", "image/png"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Apenas JPG e PNG são permitidos para imagens de serviços"));
};

const makeStorage = (sub: "products" | "logos" | "services" | "service-orders") =>
  multer.diskStorage({
    destination: (req, _file, cb) => cb(null, tenantDir(req, sub)),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      cb(null, unique);
    },
  });

export const upload        = multer({ storage: makeStorage("products"), fileFilter,        limits: { fileSize: 5 * 1024 * 1024 } });
export const uploadLogo    = multer({ storage: makeStorage("logos"),    fileFilter,        limits: { fileSize: 2 * 1024 * 1024 } });
export const uploadService = multer({ storage: makeStorage("services"), fileFilter: serviceFileFilter, limits: { fileSize: 2 * 1024 * 1024 } });
export const uploadServiceOrderPhoto = multer({ storage: makeStorage("service-orders"), fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

export async function uploadProductImage(req: Request, res: Response) {
  try {
    if (!req.file) { res.status(400).json({ error: "Nenhum arquivo enviado" }); return; }
    const tenantId = (req as AuthenticatedRequest).user.tenantId;
    res.json({ url: `/uploads/products/${tenantId}/${req.file.filename}` });
  } catch {
    res.status(500).json({ error: "Upload falhou" });
  }
}

export async function uploadProductImages(req: Request, res: Response) {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) { res.status(400).json({ error: "Nenhum arquivo enviado" }); return; }
    const tenantId = (req as AuthenticatedRequest).user.tenantId;
    res.json({ urls: files.map(f => `/uploads/products/${tenantId}/${f.filename}`) });
  } catch {
    res.status(500).json({ error: "Upload falhou" });
  }
}

export async function uploadLogoImage(req: Request, res: Response) {
  try {
    if (!req.file) { res.status(400).json({ error: "Nenhum arquivo enviado" }); return; }
    const tenantId = (req as AuthenticatedRequest).user.tenantId;
    res.json({ url: `/uploads/logos/${tenantId}/${req.file.filename}` });
  } catch {
    res.status(500).json({ error: "Upload falhou" });
  }
}

export async function uploadServiceImage(req: Request, res: Response) {
  try {
    if (!req.file) { res.status(400).json({ error: "Nenhum arquivo enviado" }); return; }
    const tenantId = (req as AuthenticatedRequest).user.tenantId;
    res.json({ url: `/uploads/services/${tenantId}/${req.file.filename}` });
  } catch {
    res.status(500).json({ error: "Upload falhou" });
  }
}

export async function uploadServiceOrderPhotoImage(req: Request, res: Response) {
  try {
    if (!req.file) { res.status(400).json({ error: "Nenhum arquivo enviado" }); return; }
    const tenantId = (req as AuthenticatedRequest).user.tenantId;
    res.json({ url: `/uploads/service-orders/${tenantId}/${req.file.filename}` });
  } catch {
    res.status(500).json({ error: "Upload falhou" });
  }
}

export function deleteProductImage(imageUrl: string) {
  if (!imageUrl || !imageUrl.startsWith("/uploads/products/")) return;
  fs.unlink(path.join(process.cwd(), "public", imageUrl), () => {});
}

export function deleteServiceImage(imageUrl: string) {
  if (!imageUrl || !imageUrl.startsWith("/uploads/services/")) return;
  fs.unlink(path.join(process.cwd(), "public", imageUrl), () => {});
}

export function deleteServiceOrderPhoto(imageUrl: string) {
  if (!imageUrl || !imageUrl.startsWith("/uploads/service-orders/")) return;
  fs.unlink(path.join(process.cwd(), "public", imageUrl), () => {});
}
