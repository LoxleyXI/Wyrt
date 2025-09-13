-- Create Wyrt database
CREATE DATABASE IF NOT EXISTS wyrt CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wyrt;

-- Accounts table (shared across all games)
CREATE TABLE IF NOT EXISTS accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    status ENUM('active', 'suspended', 'banned') DEFAULT 'active',
    INDEX idx_username (username),
    INDEX idx_email (email)
) ENGINE=InnoDB;

-- Sessions table for authentication
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(128) PRIMARY KEY,
    account_id INT NOT NULL,
    token VARCHAR(512) NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    INDEX idx_account (account_id),
    INDEX idx_token (token),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB;

-- Characters table (base character data)
CREATE TABLE IF NOT EXISTS characters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT NOT NULL,
    game_id VARCHAR(50) NOT NULL, -- 'ironwood', 'demo_game', etc.
    name VARCHAR(50) NOT NULL,
    level INT DEFAULT 1,
    class VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_played TIMESTAMP NULL,
    deleted BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    UNIQUE KEY unique_char_name_game (name, game_id),
    INDEX idx_account_game (account_id, game_id),
    INDEX idx_name (name)
) ENGINE=InnoDB;

-- Character data storage (game-specific data)
CREATE TABLE IF NOT EXISTS character_data (
    character_id INT NOT NULL,
    data_key VARCHAR(100) NOT NULL,
    data_value JSON,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (character_id, data_key),
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==================================
-- Ironwood-specific tables
-- ==================================

-- Ironwood character stats
CREATE TABLE IF NOT EXISTS ironwood_stats (
    character_id INT PRIMARY KEY,
    hp INT DEFAULT 100,
    max_hp INT DEFAULT 100,
    mp INT DEFAULT 50,
    max_mp INT DEFAULT 50,
    strength INT DEFAULT 10,
    dexterity INT DEFAULT 10,
    intelligence INT DEFAULT 10,
    defense INT DEFAULT 10,
    agility INT DEFAULT 10,
    experience INT DEFAULT 0,
    gold INT DEFAULT 0,
    zone VARCHAR(100) DEFAULT 'maiden_wood',
    room VARCHAR(100) DEFAULT 'Green_Thicket',
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Ironwood inventory
CREATE TABLE IF NOT EXISTS ironwood_inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    character_id INT NOT NULL,
    item_id VARCHAR(100) NOT NULL,
    quantity INT DEFAULT 1,
    equipped BOOLEAN DEFAULT FALSE,
    slot VARCHAR(50),
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    INDEX idx_character (character_id),
    INDEX idx_item (item_id)
) ENGINE=InnoDB;

-- Ironwood skills
CREATE TABLE IF NOT EXISTS ironwood_skills (
    character_id INT NOT NULL,
    skill_name VARCHAR(100) NOT NULL,
    level INT DEFAULT 0,
    experience INT DEFAULT 0,
    PRIMARY KEY (character_id, skill_name),
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Ironwood quests
CREATE TABLE IF NOT EXISTS ironwood_quests (
    character_id INT NOT NULL,
    quest_id VARCHAR(100) NOT NULL,
    status ENUM('active', 'completed', 'failed') DEFAULT 'active',
    progress JSON,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    PRIMARY KEY (character_id, quest_id),
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Ironwood variables (quest flags, achievements, etc)
CREATE TABLE IF NOT EXISTS ironwood_variables (
    character_id INT NOT NULL,
    var_name VARCHAR(100) NOT NULL,
    var_value VARCHAR(255),
    PRIMARY KEY (character_id, var_name),
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==================================
-- Tile Game specific tables
-- ==================================

-- Tile game character stats
CREATE TABLE IF NOT EXISTS demo_game_stats (
    character_id INT PRIMARY KEY,
    hp INT DEFAULT 100,
    max_hp INT DEFAULT 100,
    mp INT DEFAULT 50,
    max_mp INT DEFAULT 50,
    strength INT DEFAULT 10,
    dexterity INT DEFAULT 10,
    intelligence INT DEFAULT 10,
    defense INT DEFAULT 10,
    agility INT DEFAULT 10,
    experience INT DEFAULT 0,
    gold INT DEFAULT 0,
    current_map VARCHAR(100) DEFAULT 'tutorial_island',
    position_x FLOAT DEFAULT 100,
    position_y FLOAT DEFAULT 100,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Tile game inventory
CREATE TABLE IF NOT EXISTS demo_game_inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    character_id INT NOT NULL,
    item_id VARCHAR(100) NOT NULL,
    quantity INT DEFAULT 1,
    slot_index INT,
    equipped BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    INDEX idx_character (character_id)
) ENGINE=InnoDB;

-- Tile game skills/abilities
CREATE TABLE IF NOT EXISTS demo_game_abilities (
    character_id INT NOT NULL,
    ability_id VARCHAR(100) NOT NULL,
    level INT DEFAULT 1,
    cooldown_until TIMESTAMP NULL,
    slot_number INT,
    PRIMARY KEY (character_id, ability_id),
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==================================
-- Shared tables for social features
-- ==================================

-- Friends list (shared across games)
CREATE TABLE IF NOT EXISTS friends (
    account_id INT NOT NULL,
    friend_account_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'blocked') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (account_id, friend_account_id),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    INDEX idx_friend (friend_account_id)
) ENGINE=InnoDB;

-- Chat messages (if needed for persistent chat)
CREATE TABLE IF NOT EXISTS chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_account_id INT NOT NULL,
    game_id VARCHAR(50),
    channel VARCHAR(50) DEFAULT 'general',
    message TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    INDEX idx_channel_time (channel, sent_at),
    INDEX idx_game (game_id)
) ENGINE=InnoDB;

-- Audit log for important actions
CREATE TABLE IF NOT EXISTS audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_id INT,
    action VARCHAR(100) NOT NULL,
    details JSON,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_account (account_id),
    INDEX idx_action (action),
    INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- Create default admin account (password: admin123 - CHANGE THIS!)
INSERT INTO accounts (username, email, password_hash, status) 
VALUES ('admin', 'admin@wyrt.local', '$2b$10$YourHashHere', 'active')
ON DUPLICATE KEY UPDATE username=username;

-- Grant privileges (adjust as needed)
-- GRANT ALL PRIVILEGES ON wyrt.* TO 'wyrt_user'@'localhost' IDENTIFIED BY 'your_password';
-- FLUSH PRIVILEGES;