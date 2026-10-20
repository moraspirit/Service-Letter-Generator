-- AlterTable
ALTER TABLE `templates` ADD COLUMN `layout_defaults` JSON NULL;

-- AlterTable
ALTER TABLE `certificates` ADD COLUMN `layout` JSON NULL;

-- AlterTable
ALTER TABLE `certificate_audit` ADD COLUMN `old_layout` JSON NULL,
    ADD COLUMN `new_layout` JSON NULL;
