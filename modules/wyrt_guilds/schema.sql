-- Guild system tables
-- Replace {gameId} with actual game identifier

-- Guilds table
CREATE TABLE IF NOT EXISTS `{gameId}_guilds` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(32) NOT NULL UNIQUE,
    `leader_id` INT NOT NULL,
    `level` INT DEFAULT 1,
    `xp` INT DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_leader` (`leader_id`),
    KEY `idx_name` (`name`),
    FOREIGN KEY (`leader_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Guild members table
CREATE TABLE IF NOT EXISTS `{gameId}_guild_members` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `guild_id` INT NOT NULL,
    `character_id` INT NOT NULL,
    `rank` ENUM('leader', 'officer', 'member') DEFAULT 'member',
    `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `unique_membership` (`guild_id`, `character_id`),
    KEY `idx_guild` (`guild_id`),
    KEY `idx_character` (`character_id`),
    FOREIGN KEY (`guild_id`) REFERENCES `{gameId}_guilds`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Guild invites table
CREATE TABLE IF NOT EXISTS `{gameId}_guild_invites` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `guild_id` INT NOT NULL,
    `character_id` INT NOT NULL,
    `invited_by` INT NOT NULL,
    `status` ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_target` (`character_id`, `status`),
    KEY `idx_guild` (`guild_id`),
    FOREIGN KEY (`guild_id`) REFERENCES `{gameId}_guilds`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`invited_by`) REFERENCES `characters`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
