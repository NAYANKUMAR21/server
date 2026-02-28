import { serve } from "bun";
import { router } from "./routes/authRoutes";
import { logger } from "./utils/logger";
import { closePool } from "./config/db";

const PORT = parseInt(process.env.PORT || "9000");

const server = serve({
  port: PORT,

  // Bun's built-in request handling with concurrency
  async fetch(req: Request): Promise<Response> {
    try {
      return await router(req);
    } catch (err) {
      logger.error("Unhandled error", err);
      return Response.json(
        { success: false, message: "Internal server error" },
        { status: 500 },
      );
    }
  },

  // Bun uses worker threads under the hood for I/O
  // idleTimeout ensures connections don't hang
  idleTimeout: 30,
});

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

export default server;
