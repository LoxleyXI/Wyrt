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
    game_id VARCHAR(50) NOT NULL, -- Game module identifier
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

-- ==================================
-- Core game systems (reusable)
-- ==================================

CREATE TABLE IF NOT EXISTS character_skills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    character_id INT NOT NULL,
    skill_name VARCHAR(50) NOT NULL,
    level INT DEFAULT 0,
    experience INT DEFAULT 0,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    UNIQUE KEY unique_character_skill (character_id, skill_name),
    INDEX idx_character (character_id)
) ENGINE=InnoDB;

-- Generic character variables table for all Wyrt modules
-- This table stores any character-specific data in a key-value format
-- Used by quest system, achievements, settings, etc.
CREATE TABLE IF NOT EXISTS wyrt_character_vars (
    character_id INT NOT NULL,
    var_key VARCHAR(255) NOT NULL,
    var_value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (character_id, var_key),
    INDEX idx_character (character_id),
    INDEX idx_key (var_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quest progress table for tracking character quest completion
-- This is game-agnostic and used by wyrt_quests module
CREATE TABLE IF NOT EXISTS wyrt_quest_progress (
    character_id INT NOT NULL,
    quest_id VARCHAR(255) NOT NULL,
    current_step INT DEFAULT 0,
    status ENUM('active', 'completed', 'abandoned') DEFAULT 'active',
    objective_progress TEXT,  -- JSON
    accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    last_completed TIMESTAMP NULL,
    completion_count INT DEFAULT 0,
    custom TEXT,  -- JSON for game-specific data
    PRIMARY KEY (character_id, quest_id),
    INDEX idx_character (character_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create default admin account (password: admin123 - CHANGE THIS!)
INSERT INTO accounts (username, email, password_hash, status)
VALUES ('admin', 'admin@wyrt.local', '$2b$10$YourHashHere', 'active')
ON DUPLICATE KEY UPDATE username=username;
