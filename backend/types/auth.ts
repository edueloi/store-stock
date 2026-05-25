import type { Request } from "express";

export interface AuthTokenPayload {
  userId: number;
  tenantId?: number;
  role: string;
  superAdmin?: boolean;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user: AuthTokenPayload;
}
