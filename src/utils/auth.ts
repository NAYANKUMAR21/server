import { verifyAccessToken } from "../utils/crypto";

export async function authMiddleware(req: Request): Promise<{ userId: number; username: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const payload = await verifyAccessToken(token);
  if (!payload) return null;

  return { userId: payload.userId as number, username: payload.username as string };
}
