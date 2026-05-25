import fs from "fs";
import path from "path";

import type { Request, Response } from "express";
import multer from "multer";

import type { AuthenticatedRequest } from "../types/auth";

const UPLOADS_DIR       = path.join(process.cwd(), "public", "uploads", "products");
const UPLOADS_LOGOS_DIR = path.join(process.cwd(), "public", "uploads", "logos");

fs.mkdirSync(UPLOADS_DIR,       { recursive: true });
fs.mkdirSync(UPLOADS_LOGOS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, unique);
  },
});

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_LOGOS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo-${Date.now()}${ext}`);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Apenas imagens são permitidas (jpg, png, webp, gif)"));
};

export const upload      = multer({ storage,      fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
export const uploadLogo  = multer({ storage: logoStorage, fileFilter, limits: { fileSize: 2 * 1024 * 1024 } });

export async function uploadProductImage(req: Request, res: Response) {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Nenhum arquivo enviado" });
      return;
    }
    const url = `/uploads/products/${req.file.filename}`;
    res.json({ url });
  } catch {
    res.status(500).json({ error: "Upload falhou" });
  }
}

export async function uploadProductImages(req: Request, res: Response) {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: "Nenhum arquivo enviado" });
      return;
    }
    const urls = files.map(f => `/uploads/products/${f.filename}`);
    res.json({ urls });
  } catch {
    res.status(500).json({ error: "Upload falhou" });
  }
}

export async function uploadLogoImage(req: Request, res: Response) {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Nenhum arquivo enviado" });
      return;
    }
    const url = `/uploads/logos/${req.file.filename}`;
    res.json({ url });
  } catch {
    res.status(500).json({ error: "Upload falhou" });
  }
}

export function deleteProductImage(imageUrl: string) {
  if (!imageUrl || !imageUrl.startsWith("/uploads/products/")) return;
  const filePath = path.join(process.cwd(), "public", imageUrl);
  fs.unlink(filePath, () => {});
}
