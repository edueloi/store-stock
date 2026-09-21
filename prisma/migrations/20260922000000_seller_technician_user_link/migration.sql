ALTER TABLE `sellers` ADD COLUMN `user_id` INTEGER NULL;
ALTER TABLE `technicians` ADD COLUMN `user_id` INTEGER NULL;

CREATE UNIQUE INDEX `sellers_user_id_key` ON `sellers`(`user_id`);
CREATE UNIQUE INDEX `technicians_user_id_key` ON `technicians`(`user_id`);

ALTER TABLE `sellers` ADD CONSTRAINT `sellers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `technicians` ADD CONSTRAINT `technicians_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
