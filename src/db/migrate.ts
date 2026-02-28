import { runMigrations } from "./migrations";
import { query } from "../config/db";
import { logger } from "../utils/logger";

async function main() {
  try {
    logger.info("Starting database migration process...");

    // Check if users table is the old one
    const columns = await query<{ Field: string }[]>(
      "SHOW COLUMNS FROM users",
    ).catch(() => []);
    const hasUsername = columns.some((c) => c.Field === "username");

    if (columns.length > 0 && !hasUsername) {
      logger.warn(
        "Detected old 'users' table schema. Dropping table for clean migration...",
      );
      await query("DROP TABLE IF EXISTS users");
    }

    await runMigrations();

    logger.info("Migration successful!");
    process.exit(0);
  } catch (err) {
    logger.error("Migration failed", err);
    process.exit(1);
  }
}

main();
