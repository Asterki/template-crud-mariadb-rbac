-- CreateTable
CREATE TABLE `Metadata` (
    `id` VARCHAR(191) NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `deletedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Metadata_deleted_idx`(`deleted`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Account` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('admin', 'manager', 'staff', 'viewer') NOT NULL DEFAULT 'viewer',
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
    `lastLogin` DATETIME(3) NULL,
    `metadataId` VARCHAR(191) NULL,

    UNIQUE INDEX `Account_email_key`(`email`),
    UNIQUE INDEX `Account_metadataId_key`(`metadataId`),
    INDEX `Account_role_idx`(`role`),
    INDEX `Account_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Item` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('active', 'archived') NOT NULL DEFAULT 'active',
    `metadataId` VARCHAR(191) NULL,

    UNIQUE INDEX `Item_metadataId_key`(`metadataId`),
    INDEX `Item_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MetadataUpdateHistory` (
    `id` VARCHAR(191) NOT NULL,
    `metadataId` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedById` VARCHAR(191) NULL,
    `changes` JSON NOT NULL,

    INDEX `MetadataUpdateHistory_metadataId_idx`(`metadataId`),
    INDEX `MetadataUpdateHistory_updatedAt_idx`(`updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` VARCHAR(191) NOT NULL,
    `sid` VARCHAR(191) NOT NULL,
    `data` TEXT NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sessions_sid_key`(`sid`),
    INDEX `sessions_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Account` ADD CONSTRAINT `Account_metadataId_fkey` FOREIGN KEY (`metadataId`) REFERENCES `Metadata`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Item` ADD CONSTRAINT `Item_metadataId_fkey` FOREIGN KEY (`metadataId`) REFERENCES `Metadata`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MetadataUpdateHistory` ADD CONSTRAINT `MetadataUpdateHistory_metadataId_fkey` FOREIGN KEY (`metadataId`) REFERENCES `Metadata`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

