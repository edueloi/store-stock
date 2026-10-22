ALTER TABLE `whatsapp_conversations` ADD COLUMN `attendance_started_at` DATETIME(3) NULL;

CREATE TABLE `whatsapp_attendances` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `workspace_id` INTEGER NOT NULL,
  `conversation_id` INTEGER NOT NULL,
  `phone` VARCHAR(191) NOT NULL,
  `customer_name` VARCHAR(191) NULL,
  `department` VARCHAR(191) NULL,
  `department_label` VARCHAR(191) NULL,
  `agent_id` INTEGER NULL,
  `agent_name` VARCHAR(191) NULL,
  `subject` TEXT NULL,
  `started_at` DATETIME(3) NOT NULL,
  `closed_at` DATETIME(3) NOT NULL,
  `close_reason` VARCHAR(191) NOT NULL,
  `start_message_id` INTEGER NULL,
  `end_message_id` INTEGER NULL,
  `message_count` INTEGER NOT NULL DEFAULT 0,
  `legacy_import` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `whatsapp_attendances_conversation_id_end_message_id_key` (`conversation_id`, `end_message_id`),
  INDEX `whatsapp_attendances_workspace_id_closed_at_id_idx` (`workspace_id`, `closed_at`, `id`),
  INDEX `whatsapp_attendances_workspace_id_phone_closed_at_idx` (`workspace_id`, `phone`, `closed_at`),
  INDEX `whatsapp_attendances_workspace_id_agent_id_closed_at_idx` (`workspace_id`, `agent_id`, `closed_at`),
  CONSTRAINT `whatsapp_attendances_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `whatsapp_conversations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- O sistema anterior mantinha uma conversa por contato, sem episódios separados.
-- Preserva cada conversa já encerrada como um registro anterior, sem inventar o responsável.
INSERT INTO `whatsapp_attendances`
  (`workspace_id`, `conversation_id`, `phone`, `customer_name`, `department`, `department_label`, `subject`, `started_at`, `closed_at`, `close_reason`, `start_message_id`, `end_message_id`, `message_count`, `legacy_import`)
SELECT c.`workspace_id`, c.`id`, c.`phone`, c.`customer_name`, c.`department`, s.`name`,
  (SELECT LEFT(TRIM(m2.`body`), 180) FROM `whatsapp_message_logs` m2
    WHERE m2.`conversation_id` = c.`id` AND m2.`direction` = 'customer'
      AND CHAR_LENGTH(TRIM(m2.`body`)) > 5
      AND LOWER(TRIM(m2.`body`)) NOT IN ('bom dia', 'boa tarde', 'boa noite', 'olá', 'ola', 'obrigado', 'obrigada', 'tudo bem', 'menu')
    ORDER BY m2.`id` ASC LIMIT 1),
  COALESCE(MIN(m.`created_at`), c.`created_at`), c.`updated_at`, COALESCE(c.`closed_reason`, 'legacy'),
  MIN(m.`id`), MAX(m.`id`), COUNT(m.`id`), true
FROM `whatsapp_conversations` c
LEFT JOIN `whatsapp_message_logs` m ON m.`conversation_id` = c.`id`
LEFT JOIN `whatsapp_sectors` s ON s.`workspace_id` = c.`workspace_id` AND s.`key` = c.`department`
WHERE c.`status` = 'closed'
GROUP BY c.`id`, c.`workspace_id`, c.`phone`, c.`customer_name`, c.`department`, s.`name`, c.`created_at`, c.`updated_at`, c.`closed_reason`;
