import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env";
import type { AuthenticatedRequest, AuthTokenPayload } from "../types/auth";

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];

  if (!token) {
    res.sendStatus(401);
    return;
  }

  try {
    const user = jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
    (req as AuthenticatedRequest).user = user;
    next();
  } catch {
    res.sendStatus(403);
  }
}
