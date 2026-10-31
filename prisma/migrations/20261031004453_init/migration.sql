-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'CLIENT') NOT NULL DEFAULT 'CLIENT',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Site` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `niche` ENUM('CLUB', 'BAR', 'RESTAURANT', 'CAFE', 'GYM', 'BARBERSHOP', 'OTHER') NOT NULL DEFAULT 'CLUB',
    `status` ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `tagline` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `logoUrl` VARCHAR(191) NULL,
    `coverUrl` VARCHAR(191) NULL,
    `primaryColor` VARCHAR(191) NOT NULL DEFAULT '#7c3aed',
    `secondaryColor` VARCHAR(191) NOT NULL DEFAULT '#0f172a',
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `mapsUrl` TEXT NULL,
    `instagram` VARCHAR(191) NULL,
    `facebook` VARCHAR(191) NULL,
    `tiktok` VARCHAR(191) NULL,
    `whatsapp` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'COP',
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'America/Bogota',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Site_slug_key`(`slug`),
    INDEX `Site_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SiteModule` (
    `id` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `module` ENUM('MUSIC', 'BOOKING', 'REVIEWS') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SiteModule_siteId_module_key`(`siteId`, `module`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SitePhoto` (
    `id` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `caption` VARCHAR(191) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SitePhoto_siteId_position_idx`(`siteId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CatalogCategory` (
    `id` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,

    INDEX `CatalogCategory_siteId_position_idx`(`siteId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CatalogItem` (
    `id` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `imageUrl` TEXT NULL,
    `isAvailable` BOOLEAN NOT NULL DEFAULT true,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CatalogItem_siteId_categoryId_position_idx`(`siteId`, `categoryId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Event` (
    `id` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `type` ENUM('EVENT', 'PROMOTION') NOT NULL DEFAULT 'EVENT',
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `imageUrl` TEXT NULL,
    `startsAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Event_siteId_isActive_startsAt_idx`(`siteId`, `isActive`, `startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SongRequest` (
    `id` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `provider` ENUM('SPOTIFY', 'YOUTUBE', 'DEEZER', 'ITUNES') NOT NULL,
    `providerTrackId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `artist` VARCHAR(255) NOT NULL,
    `coverUrl` TEXT NULL,
    `durationMs` INTEGER NULL,
    `status` ENUM('PENDING', 'PLAYED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `upvotes` INTEGER NOT NULL DEFAULT 0,
    `downvotes` INTEGER NOT NULL DEFAULT 0,
    `score` INTEGER NOT NULL DEFAULT 0,
    `pendingKey` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `playedAt` DATETIME(3) NULL,

    UNIQUE INDEX `SongRequest_pendingKey_key`(`pendingKey`),
    INDEX `SongRequest_siteId_status_score_idx`(`siteId`, `status`, `score`),
    INDEX `SongRequest_siteId_status_playedAt_idx`(`siteId`, `status`, `playedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Vote` (
    `id` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `voterHash` VARCHAR(191) NOT NULL,
    `value` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Vote_voterHash_idx`(`voterHash`),
    UNIQUE INDEX `Vote_requestId_voterHash_key`(`requestId`, `voterHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActivityLog` (
    `id` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NOT NULL,
    `type` ENUM('VISIT', 'SEARCH', 'REQUEST', 'VOTE', 'PLAYED', 'REJECTED') NOT NULL,
    `voterHash` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ActivityLog_siteId_createdAt_idx`(`siteId`, `createdAt`),
    INDEX `ActivityLog_siteId_type_createdAt_idx`(`siteId`, `type`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Site` ADD CONSTRAINT `Site_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SiteModule` ADD CONSTRAINT `SiteModule_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SitePhoto` ADD CONSTRAINT `SitePhoto_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CatalogCategory` ADD CONSTRAINT `CatalogCategory_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CatalogItem` ADD CONSTRAINT `CatalogItem_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CatalogItem` ADD CONSTRAINT `CatalogItem_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `CatalogCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SongRequest` ADD CONSTRAINT `SongRequest_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vote` ADD CONSTRAINT `Vote_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `SongRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityLog` ADD CONSTRAINT `ActivityLog_siteId_fkey` FOREIGN KEY (`siteId`) REFERENCES `Site`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
