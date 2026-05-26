-- CreateTable goals
CREATE TABLE `goals` (
    `id`          INTEGER      NOT NULL AUTO_INCREMENT,
    `tenant_id`   INTEGER      NOT NULL,
    `title`       VARCHAR(191) NOT NULL,
    `description` TEXT         NULL,
    `type`        VARCHAR(30)  NOT NULL,
    `period`      VARCHAR(20)  NOT NULL,
    `target_value` DECIMAL(14, 2) NOT NULL,
    `current_value` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `start_date`  DATE         NOT NULL,
    `end_date`    DATE         NOT NULL,
    `status`      VARCHAR(20)  NOT NULL DEFAULT 'active',
    `created_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at`  DATETIME(3)  NOT NULL,

    INDEX `goals_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey goals -> tenants
ALTER TABLE `goals`
  ADD CONSTRAINT `goals_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
