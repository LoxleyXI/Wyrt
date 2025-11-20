-- Party system tables
-- Replace {gameId} with actual game identifier

-- Parties table
CREATE TABLE IF NOT EXISTS `{gameId}_parties` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `leader_id` INT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_leader` (`leader_id`),
    FOREIGN KEY (`leader_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Party members table
CREATE TABLE IF NOT EXISTS `{gameId}_party_members` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `party_id` INT NOT NULL,
    `character_id` INT NOT NULL,
    `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `unique_membership` (`party_id`, `character_id`),
    KEY `idx_party` (`party_id`),
    KEY `idx_character` (`character_id`),
    FOREIGN KEY (`party_id`) REFERENCES `{gameId}_parties`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Party invites table
CREATE TABLE IF NOT EXISTS `{gameId}_party_invites` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `party_id` INT NOT NULL,
    `character_id` INT NOT NULL,
    `invited_by` INT NOT NULL,
    `status` ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_target` (`character_id`, `status`),
    KEY `idx_party` (`party_id`),
    FOREIGN KEY (`party_id`) REFERENCES `{gameId}_parties`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`invited_by`) REFERENCES `characters`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
