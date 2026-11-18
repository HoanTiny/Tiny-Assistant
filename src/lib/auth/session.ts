/**
 * Phiên đăng nhập dạng token ngẫu nhiên trong cookie httpOnly.
 * DB chỉ lưu sha256(token), có thể thu hồi từng phiên (đăng xuất, đổi mật khẩu...).
 */
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export const SESSION_COOKIE = "wh_session";
const SESSION_DAYS = 30;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string): Promise<void> {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(schema.sessions).values({ id: hashToken(token), userId, expiresAt });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Trả về userId nếu phiên hợp lệ */
export async function readSession(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = await getDb();
  const [row] = await db
    .select({ userId: schema.sessions.userId, expiresAt: schema.sessions.expiresAt })
    .from(schema.sessions)
    .where(eq(schema.sessions.id, hashToken(token)))
    .limit(1);

  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  return row.userId;
}

export async function deleteSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token)));
  }
  store.delete(SESSION_COOKIE);
}
