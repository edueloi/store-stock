CREATE TABLE `services` (
  `id`          INT            NOT NULL AUTO_INCREMENT,
  `tenant_id`   INT            NOT NULL,
  `name`        VARCHAR(191)   NOT NULL,
  `description` TEXT           NULL,
  `price`       DECIMAL(10,2)  NOT NULL,
  `is_active`   TINYINT(1)     NOT NULL DEFAULT 1,
  `created_at`  DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`  DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `services_tenant_id_idx` (`tenant_id`),
  CONSTRAINT `services_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
