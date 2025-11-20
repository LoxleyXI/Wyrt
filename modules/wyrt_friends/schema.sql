-- Friend system tables
-- Replace {gameId} with actual game identifier

-- Friends table (bidirectional friendship)
CREATE TABLE IF NOT EXISTS `{gameId}_friends` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `character_id_1` INT NOT NULL,
    `character_id_2` INT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `unique_friendship` (`character_id_1`, `character_id_2`),
    KEY `idx_char1` (`character_id_1`),
    KEY `idx_char2` (`character_id_2`),
    FOREIGN KEY (`character_id_1`) REFERENCES `characters`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`character_id_2`) REFERENCES `characters`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Friend requests table
CREATE TABLE IF NOT EXISTS `{gameId}_friend_requests` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `from_character_id` INT NOT NULL,
    `to_character_id` INT NOT NULL,
    `status` ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_to_char` (`to_character_id`, `status`),
    KEY `idx_from_char` (`from_character_id`),
    FOREIGN KEY (`from_character_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`to_character_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Blocked users table
CREATE TABLE IF NOT EXISTS `{gameId}_blocked_users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `character_id` INT NOT NULL,
    `blocked_character_id` INT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `unique_block` (`character_id`, `blocked_character_id`),
    KEY `idx_blocker` (`character_id`),
    FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`blocked_character_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
