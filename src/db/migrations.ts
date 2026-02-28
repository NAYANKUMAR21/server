import { query } from "../config/db";
import { logger } from "../utils/logger";

export async function runMigrations(): Promise<void> {
  logger.info("Running database migrations...");

  // Create users table
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      phone_number  VARCHAR(20)  NOT NULL UNIQUE,
      full_name     VARCHAR(150) NOT NULL,
      username      VARCHAR(50)  NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      is_active     TINYINT(1)   NOT NULL DEFAULT 1,
      last_login_at DATETIME     NULL,
      created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_phone (phone_number),
      INDEX idx_username (username),
      INDEX idx_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Refresh tokens table for JWT rotation
  await query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id    BIGINT UNSIGNED NOT NULL,
      token_hash VARCHAR(255) NOT NULL UNIQUE,
      expires_at DATETIME    NOT NULL,
      created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  logger.info("✅ Migrations complete");
}
