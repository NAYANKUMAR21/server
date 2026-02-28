import { createHash, randomBytes } from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-super-secret-key-in-production";
const ACCESS_TOKEN_EXPIRY = 15 * 60;      // 15 minutes (seconds)
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days (seconds)

// ─── Password hashing via Bun's built-in bcrypt ─────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: 12, // Work factor (production: 12)
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await Bun.password.verify(password, hash);
  } catch {
    return false;
  }
}

// ─── JWT (manual implementation using Bun's crypto) ────────────────────────
function base64url(input: string | Uint8Array): string {
  const str = typeof input === "string" ? input : Buffer.from(input).toString("binary");
  return Buffer.from(str, "binary")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function sign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return base64url(new Uint8Array(signature));
}

export async function generateAccessToken(payload: Record<string, unknown>): Promise<string> {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRY,
      iss: "auth-api",
    })
  );
  const signature = await sign(`${header}.${claims}`);
  return `${header}.${claims}.${signature}`;
}

export async function verifyAccessToken(token: string): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, claims, sig] = parts;
    const expectedSig = await sign(`${header}.${claims}`);
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(claims, "base64url").toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Refresh token ──────────────────────────────────────────────────────────
export async function generateRefreshToken(): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000);
  return { token, expiresAt };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
