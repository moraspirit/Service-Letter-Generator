-- CreateTable
CREATE TABLE `templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `current_version_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `templates_current_version_id_idx`(`current_version_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `template_versions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `template_id` INTEGER NOT NULL,
    `version_number` INTEGER NOT NULL,
    `html_content` LONGTEXT NOT NULL,
    `field_schema` JSON NOT NULL,
    `content_hash` CHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `template_versions_template_id_idx`(`template_id`),
    UNIQUE INDEX `template_versions_template_id_version_number_key`(`template_id`, `version_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `certificates` (
    `id` CHAR(36) NOT NULL,
    `template_version_id` INTEGER NOT NULL,
    `data` JSON NOT NULL,
    `import_batch_id` INTEGER NULL,
    `dedupe_key` CHAR(64) NOT NULL,
    `status` ENUM('active', 'revoked') NOT NULL DEFAULT 'active',
    `revoked_at` DATETIME(3) NULL,
    `revocation_reason` VARCHAR(500) NULL,
    `issued_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `certificates_template_version_id_idx`(`template_version_id`),
    INDEX `certificates_dedupe_key_idx`(`dedupe_key`),
    INDEX `certificates_import_batch_id_idx`(`import_batch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `certificate_audit` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `certificate_id` CHAR(36) NOT NULL,
    `action` ENUM('created', 'edited', 'revoked', 'restored') NOT NULL,
    `old_data` JSON NULL,
    `new_data` JSON NULL,
    `reason` VARCHAR(500) NULL,
    `admin_user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `certificate_audit_certificate_id_created_at_idx`(`certificate_id`, `created_at`),
    INDEX `certificate_audit_admin_user_id_idx`(`admin_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `import_batches` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `template_version_id` INTEGER NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_type` ENUM('xlsx', 'csv') NOT NULL,
    `sheet_name` VARCHAR(255) NULL,
    `file_hash` CHAR(64) NOT NULL,
    `row_count` INTEGER NOT NULL,
    `inserted_count` INTEGER NOT NULL DEFAULT 0,
    `skipped_count` INTEGER NOT NULL DEFAULT 0,
    `zip_status` ENUM('none', 'queued', 'generating', 'ready', 'failed', 'expired') NOT NULL DEFAULT 'none',
    `zip_rendered_count` INTEGER NOT NULL DEFAULT 0,
    `zip_path` VARCHAR(500) NULL,
    `zip_expires_at` DATETIME(3) NULL,
    `admin_user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `import_batches_file_hash_idx`(`file_hash`),
    INDEX `import_batches_template_version_id_idx`(`template_version_id`),
    INDEX `import_batches_admin_user_id_idx`(`admin_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `admin_users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_attempts` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `ip_address` VARCHAR(45) NOT NULL,
    `attempted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_attempts_email_ip_address_attempted_at_idx`(`email`, `ip_address`, `attempted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `templates` ADD CONSTRAINT `templates_current_version_id_fkey` FOREIGN KEY (`current_version_id`) REFERENCES `template_versions`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `template_versions` ADD CONSTRAINT `template_versions_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_template_version_id_fkey` FOREIGN KEY (`template_version_id`) REFERENCES `template_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_import_batch_id_fkey` FOREIGN KEY (`import_batch_id`) REFERENCES `import_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificate_audit` ADD CONSTRAINT `certificate_audit_certificate_id_fkey` FOREIGN KEY (`certificate_id`) REFERENCES `certificates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificate_audit` ADD CONSTRAINT `certificate_audit_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `import_batches` ADD CONSTRAINT `import_batches_template_version_id_fkey` FOREIGN KEY (`template_version_id`) REFERENCES `template_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `import_batches` ADD CONSTRAINT `import_batches_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
