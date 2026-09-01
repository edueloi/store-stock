-- AlterTable
ALTER TABLE `users` ADD COLUMN `phone` VARCHAR(191) NULL,
    ADD COLUMN `nickname` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `users_nickname_key` ON `users`(`nickname`);
