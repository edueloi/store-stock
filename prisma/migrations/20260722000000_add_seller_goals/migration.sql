-- AlterTable goals: add seller_id
ALTER TABLE `goals`
  ADD COLUMN `seller_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `goals_seller_id_idx` ON `goals`(`seller_id`);

-- AddForeignKey goals -> sellers
ALTER TABLE `goals`
  ADD CONSTRAINT `goals_seller_id_fkey`
  FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
