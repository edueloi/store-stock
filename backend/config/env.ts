import dotenv from "dotenv";

dotenv.config();

export const env = {
  jwtSecret: process.env.JWT_SECRET || "nexus-super-secret-key-123",
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
};
