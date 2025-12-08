-- Add OAuth columns to accounts table
-- This migration adds support for OAuth authentication

ALTER TABLE accounts
ADD COLUMN oauth_provider VARCHAR(50) NULL COMMENT 'OAuth provider name (discord, google, steam, etc.)',
ADD COLUMN oauth_id VARCHAR(255) NULL COMMENT 'User ID from OAuth provider',
ADD COLUMN oauth_avatar VARCHAR(512) NULL COMMENT 'Avatar URL from OAuth provider',
ADD INDEX idx_oauth_lookup (oauth_provider, oauth_id);

-- Note: The password column in accounts table should remain nullable
-- so accounts can be created with either password OR OAuth (not both required)
