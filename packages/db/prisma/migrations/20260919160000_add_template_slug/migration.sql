-- Add templates.slug: the folder name a template is published from.
-- Added in three steps so it also works on a database that already has rows.

ALTER TABLE `templates` ADD COLUMN `slug` VARCHAR(100) NULL;

UPDATE `templates` SET `slug` = CONCAT('template-', `id`) WHERE `slug` IS NULL;

ALTER TABLE `templates` MODIFY `slug` VARCHAR(100) NOT NULL;

CREATE UNIQUE INDEX `templates_slug_key` ON `templates`(`slug`);
