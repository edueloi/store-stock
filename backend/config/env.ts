import dotenv from "dotenv";
import path from "path";

dotenv.config();

export const env = {
  jwtSecret: process.env.JWT_SECRET || "nexus-super-secret-key-123",
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  appBaseUrl: process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
  appDomain: process.env.APP_DOMAIN || "boxsys.com.br",
  primarySubdomain: process.env.PRIMARY_SUBDOMAIN || "store",
  superAdminUser: process.env.SUPER_ADMIN_USER || "Admin",
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || "Edu@06051992",
  inviteExpirationDays: Number(process.env.INVITE_EXPIRATION_DAYS || 7),
  smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
  smtpPort: Number(process.env.SMTP_PORT || 465),
  smtpSecure: process.env.SMTP_SECURE !== "false",
  smtpUser: process.env.SMTP_USER || "contato@boxsys.com.br",
  smtpPass: process.env.SMTP_PASS || "",
  nfceCertsDir: process.env.NFCE_CERTS_DIR || path.join(process.cwd(), "certs"),
  nfceXmlDir: process.env.NFCE_XML_DIR || path.join(process.cwd(), "public", "nfce"),
  nfceTimeoutMs: Number(process.env.NFCE_TIMEOUT_MS || 15000),
  baileysServiceUrl: process.env.BAILEYS_SERVICE_URL || "http://127.0.0.1:3002",
  baileysInternalToken: process.env.BAILEYS_INTERNAL_TOKEN || "",
};
