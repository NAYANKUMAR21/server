import { query, withTransaction, queryParallel } from "../config/db";
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from "../utils/crypto";
import { validateSignup, validateLogin } from "../utils/validators";
import { rateLimiter } from "../utils/rateLimiter";
import { logger } from "../utils/logger";

interface User {
  id: number;
  phone_number: string;
  full_name: string;
  username: string;
  password_hash: string;
  is_active: number;
}

// ─────────────────────────────────────────────
// SIGNUP
// ─────────────────────────────────────────────
export async function signup(req: Request): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for") || "unknown";

  // Rate limiting: 10 signups per IP per 15 minutes
  if (!rateLimiter.check(`signup:${ip}`, 10, 15 * 60)) {
    return Response.json(
      { success: false, message: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { success: false, message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { phone_number, full_name, username, password } = body;

  // Validate inputs
  const errors = validateSignup({
    phone_number,
    full_name,
    username,
    password,
  });
  if (errors.length > 0) {
    return Response.json({ success: false, errors }, { status: 422 });
  }

  try {
    // Run uniqueness checks in PARALLEL (concurrency)
    const [phoneRows, usernameRows] = await queryParallel<unknown[]>([
      {
        sql: "SELECT id FROM users WHERE phone_number = ? LIMIT 1",
        params: [phone_number],
      },
      {
        sql: "SELECT id FROM users WHERE username = ? LIMIT 1",
        params: [username.toLowerCase()],
      },
    ]);

    if ((phoneRows as unknown[]).length > 0) {
      return Response.json(
        { success: false, message: "Phone number already registered" },
        { status: 409 },
      );
    }
    if ((usernameRows as unknown[]).length > 0) {
      return Response.json(
        { success: false, message: "Username already taken" },
        { status: 409 },
      );
    }

    // Hash password using Bun's native crypto (bcrypt-compatible)
    const password_hash = await hashPassword(password);

    // Insert user in a transaction
    const result = await withTransaction(async (conn) => {
      const [insertResult] = await conn.execute(
        `INSERT INTO users (phone_number, full_name, username, password_hash)
         VALUES (?, ?, ?, ?)`,
        [phone_number, full_name, username.toLowerCase(), password_hash],
      );
      return insertResult as { insertId: number };
    });

    const userId = result.insertId;

    // Generate tokens in parallel
    const [accessToken, refreshTokenData] = await Promise.all([
      generateAccessToken({ userId, username: username.toLowerCase() }),
      generateRefreshToken(),
    ]);

    // Store hashed refresh token
    const tokenHash = hashToken(refreshTokenData.token);
    await query(
      "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
      [userId, tokenHash, refreshTokenData.expiresAt],
    );

    logger.info(`New user registered: ${username} (${phone_number})`);

    return Response.json(
      {
        success: true,
        message: "Account created successfully",
        data: {
          user: {
            id: userId,
            full_name,
            username: username.toLowerCase(),
            phone_number,
          },
          access_token: accessToken,
          refresh_token: refreshTokenData.token,
          token_type: "Bearer",
          expires_in: 900, // 15 minutes
        },
      },
      { status: 201 },
    );
  } catch (err) {
    logger.error("Signup error", err);
    return Response.json(
      { success: false, message: "Registration failed. Please try again." },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────
export async function login(req: Request): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for") || "unknown";

  // Rate limiting: 5 attempts per IP per 15 minutes (brute-force protection)
  if (!rateLimiter.check(`login:${ip}`, 5, 15 * 60)) {
    return Response.json(
      {
        success: false,
        message: "Too many login attempts. Please try again in 15 minutes.",
      },
      { status: 429 },
    );
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { success: false, message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { phone_number, password } = body;

  const errors = validateLogin({ phone_number, password });
  if (errors.length > 0) {
    return Response.json({ success: false, errors }, { status: 422 });
  }

  try {
    // Fetch user by phone
    const users = await query<User[]>(
      "SELECT id, phone_number, full_name, username, password_hash, is_active FROM users WHERE phone_number = ? LIMIT 1",
      [phone_number],
    );

    // Use constant-time comparison to avoid timing attacks
    const user = users[0];
    const dummyHash =
      "$2b$10$dummy.hash.to.prevent.timing.attacks.xxxxxxxxxxxxxxxxx";

    const [passwordValid] = await Promise.all([
      verifyPassword(password, user ? user.password_hash : dummyHash),
    ]);

    if (!user || !passwordValid) {
      return Response.json(
        { success: false, message: "Invalid phone number or password" },
        { status: 401 },
      );
    }

    if (!user.is_active) {
      return Response.json(
        { success: false, message: "Account is deactivated. Contact support." },
        { status: 403 },
      );
    }

    // Generate tokens and update last_login in PARALLEL
    const [accessToken, refreshTokenData] = await Promise.all([
      generateAccessToken({ userId: user.id, username: user.username }),
      generateRefreshToken(),
      query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [user.id]),
    ]);

    // Store refresh token (clean expired ones too, in parallel)
    const tokenHash = hashToken(refreshTokenData.token);
    await Promise.all([
      query(
        "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
        [user.id, tokenHash, refreshTokenData.expiresAt],
      ),
      query("DELETE FROM refresh_tokens WHERE expires_at < NOW()"), // cleanup expired
    ]);

    logger.info(`User logged in: ${user.username} from ${ip}`);

    return Response.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user.id,
          full_name: user.full_name,
          username: user.username,
          phone_number: user.phone_number,
        },
        access_token: accessToken,
        refresh_token: refreshTokenData.token,
        token_type: "Bearer",
        expires_in: 900,
      },
    });
  } catch (err) {
    logger.error("Login error", err);
    return Response.json(
      { success: false, message: "Login failed. Please try again." },
      { status: 500 },
    );
  }
}

export async function getAllUsers(req: Request) {
  const users = await query("SELECT * FROM users");
  return users;
}
