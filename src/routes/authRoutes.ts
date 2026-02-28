import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { signup, login } from "../controllers/authController";
import { authMiddleware } from "../utils/auth";
import { query } from "../config/db";
import { logger } from "../utils/logger";

export const authRoutes = new Elysia({ prefix: "/api" })
  .post("/auth/signup", ({ request }) => signup(request))
  .post("/auth/login", ({ request }) => login(request))
  .get("/me", async ({ request, set }) => {
    const user = await authMiddleware(request);
    if (!user) {
      set.status = 401;
      return { success: false, message: "Unauthorized" };
    }

    const rows = await query<
      {
        id: number;
        full_name: string;
        username: string;
        phone_number: string;
        created_at: string;
      }[]
    >(
      "SELECT id, full_name, username, phone_number, created_at FROM users WHERE id = ? LIMIT 1",
      [user.userId],
    );

    if (!rows[0]) {
      set.status = 404;
      return { success: false, message: "User not found" };
    }

    return { success: true, data: rows[0] };
  });

export const mainRouter = new Elysia()
  .use(cors())
  .use(
    swagger({
      path: "/docs",
      documentation: {
        info: {
          title: "Bun Auth API",
          version: "1.0.0",
        },
      },
    }),
  )
  .use(authRoutes)
  .get("/health", () => ({
    status: "ok",
    uptime: process.uptime(),
    ts: new Date().toISOString(),
  }))
  .onAfterHandle(({ request, set }) => {
    const url = new URL(request.url);
    logger.info(`${request.method} ${url.pathname} ${set.status || 200}`);
  });
