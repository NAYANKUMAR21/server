import { mainRouter } from "./routes/authRoutes";
import { logger } from "./utils/logger";
import { closePool } from "./config/db";

const PORT = parseInt(process.env.PORT || "9000");

const server = mainRouter.listen(PORT);

logger.info(`🚀 Server running on http://localhost:${PORT}`);
logger.info(`🔧 Environment: ${process.env.NODE_ENV || "development"}`);
logger.info(`⚡ Bun version: ${Bun.version}`);

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down gracefully...");
  await closePool();
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down...");
  await closePool();
  server.stop();
  process.exit(0);
});

// No default export to prevent Bun from starting a second server instance
