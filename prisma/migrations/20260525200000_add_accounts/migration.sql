-- CreateTable accounts_receivable
CREATE TABLE `accounts_receivable` (
    `id`           INT          NOT NULL AUTO_INCREMENT,
    `tenant_id`    INT          NOT NULL,
    `description`  VARCHAR(255) NOT NULL,
    `amount`       DECIMAL(10,2) NOT NULL,
    `due_date`     DATE         NOT NULL,
    `received_date` DATE        NULL,
    `status`       VARCHAR(50)  NOT NULL DEFAULT 'pending',
    `category`     VARCHAR(100) NULL,
    `customer_name` VARCHAR(255) NULL,
    `notes`        TEXT         NULL,
    `created_at`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    INDEX `accounts_receivable_tenant_id_idx` (`tenant_id`),
    CONSTRAINT `accounts_receivable_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable accounts_payable
CREATE TABLE `accounts_payable` (
    `id`           INT          NOT NULL AUTO_INCREMENT,
    `tenant_id`    INT          NOT NULL,
    `description`  VARCHAR(255) NOT NULL,
    `amount`       DECIMAL(10,2) NOT NULL,
    `due_date`     DATE         NOT NULL,
    `paid_date`    DATE         NULL,
    `status`       VARCHAR(50)  NOT NULL DEFAULT 'pending',
    `category`     VARCHAR(100) NULL,
    `supplier_name` VARCHAR(255) NULL,
    `notes`        TEXT         NULL,
    `created_at`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    INDEX `accounts_payable_tenant_id_idx` (`tenant_id`),
    CONSTRAINT `accounts_payable_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
