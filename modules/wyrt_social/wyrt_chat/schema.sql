-- Chat system tables
-- Replace {gameId} with actual game identifier

-- Chat messages table
CREATE TABLE IF NOT EXISTS `{gameId}_chat_messages` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `channel_type` ENUM('global', 'guild', 'party', 'whisper', 'trade', 'system') NOT NULL,
    `channel_id` INT DEFAULT NULL,
    `from_character_id` INT NOT NULL,
    `to_character_id` INT DEFAULT NULL,
    `message` TEXT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_channel` (`channel_type`, `channel_id`, `created_at`),
    KEY `idx_from` (`from_character_id`),
    KEY `idx_to` (`to_character_id`),
    KEY `idx_created` (`created_at`),
    FOREIGN KEY (`from_character_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`to_character_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chat subscriptions table
CREATE TABLE IF NOT EXISTS `{gameId}_chat_subscriptions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `character_id` INT NOT NULL,
    `channel_type` ENUM('global', 'guild', 'party', 'whisper', 'trade', 'system') NOT NULL,
    `channel_id` INT DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `unique_subscription` (`character_id`, `channel_type`, `channel_id`),
    KEY `idx_character` (`character_id`),
    FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
