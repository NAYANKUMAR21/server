import { signup, login } from "../controllers/authController";
import { authMiddleware } from "../utils/auth";
import { query } from "../config/db";
import { logger } from "../utils/logger";
import { openApiSpec, scalarHtml } from "../config/swagger";

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",");

function corsHeaders(origin: string | null): HeadersInit {
  const allowed =
    ALLOWED_ORIGINS.includes("*") ||
    (origin && ALLOWED_ORIGINS.includes(origin))
      ? origin || "*"
      : "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export async function router(req: Request): Promise<Response> {
  const start = Date.now();
  // Provide a fallback base for robust parsing in all environments
  const url = new URL(
    req.url,
    `http://${req.headers.get("host") || "localhost"}`,
  );
  const method = req.method;
  const path = url.pathname;
  const origin = req.headers.get("origin");

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  const addCors = (res: Response): Response => {
    // Clone headers to avoid mutation issues
    const headers = new Headers(res.headers);
    Object.entries(corsHeaders(origin)).forEach(([k, v]) => headers.set(k, v));
    headers.set("X-Response-Time", `${Date.now() - start}ms`);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");

    // Return a new response with the same body and status but updated headers
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  };

  // ─── Routes ──────────────────────────────────────────────────────────────
  let response: Response;

  // Auth routes
  if (path === "/api/auth/signup" && method === "POST") {
    response = await signup(req);
  } else if (path === "/api/auth/login" && method === "POST") {
    response = await login(req);

    // Protected: get own profile
  } else if (path === "/api/me" && method === "GET") {
    const user = await authMiddleware(req);
    if (!user) {
      response = Response.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    } else {
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
      response = rows[0]
        ? Response.json({ success: true, data: rows[0] })
        : Response.json(
            { success: false, message: "User not found" },
            { status: 404 },
          );
    }

    // Health check
  } else if (path === "/health" && method === "GET") {
    response = Response.json({
      status: "ok",
      uptime: process.uptime(),
      ts: new Date().toISOString(),
    });

    // Scalar Documentation
  } else if (path === "/docs" && method === "GET") {
    response = new Response(scalarHtml("/openapi.json"), {
      headers: { "Content-Type": "text/html" },
    });
  } else if (path === "/openapi.json" && method === "GET") {
    response = new Response(JSON.stringify(openApiSpec), {
      headers: { "Content-Type": "application/json" },
    });

    // 404
  } else {
    response = Response.json(
      { success: false, message: `Cannot ${method} ${path}` },
      { status: 404 },
    );
  }

  logger.info(`${method} ${path} ${response.status} ${Date.now() - start}ms`);
  return addCors(response);
}
