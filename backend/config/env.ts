import dotenv from "dotenv";

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
};
