/**
 * Các lớp bảo vệ khi đưa app lên internet:
 *  - Mã thiết lập (SETUP_TOKEN): trang /setup chỉ tạo được tài khoản chủ sở hữu khi nhập đúng mã.
 *    Trên server thật (production) bắt buộc phải đặt mã này, nếu không trang /setup bị khóa.
 *  - Giới hạn số lần thử sai (đăng nhập, mã thiết lập) theo IP và theo email.
 *
 * Bộ đếm lưu trong bộ nhớ của tiến trình: đủ cho một server (VPS), tự xóa khi khởi động lại.
 */
import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";

// ───────────────────────── Mã thiết lập ─────────────────────────

export type SetupGuard = "open" | "token" | "locked";

/** open: không cần mã (máy cá nhân) · token: cần nhập mã · locked: server thật mà chưa đặt mã */
export function setupGuard(): SetupGuard {
  if (process.env.SETUP_TOKEN) return "token";
  return process.env.NODE_ENV === "production" ? "locked" : "open";
}

const digest = (s: string) => createHash("sha256").update(s).digest();

export function checkSetupToken(given: unknown): boolean {
  const expected = process.env.SETUP_TOKEN;
  if (!expected) return setupGuard() === "open";
  if (typeof given !== "string" || !given) return false;
  // So sánh băm cùng độ dài, thời gian không đổi → không đoán được qua độ trễ
  return timingSafeEqual(digest(given.trim()), digest(expected));
}

// ───────────────────────── Giới hạn thử sai ─────────────────────────

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

type Entry = { failures: number; firstAt: number; lockedUntil: number };
const globalStore = globalThis as unknown as { __workhubAttempts?: Map<string, Entry> };
const store = (globalStore.__workhubAttempts ??= new Map());

function prune(now: number) {
  if (store.size < 1000) return;
  for (const [k, e] of store) if (e.lockedUntil < now && now - e.firstAt > WINDOW_MS) store.delete(k);
}

/** IP của người gửi request (sau reverse proxy như Caddy/Nginx thì lấy từ X-Forwarded-For) */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** Số phút còn bị khóa (0 = không khóa) */
export function lockedMinutes(keys: string[], now = Date.now()): number {
  let until = 0;
  for (const k of keys) until = Math.max(until, store.get(k)?.lockedUntil ?? 0);
  return until > now ? Math.ceil((until - now) / 60000) : 0;
}

export function recordFailure(keys: string[], now = Date.now()) {
  prune(now);
  for (const k of keys) {
    const e = store.get(k);
    if (!e || now - e.firstAt > WINDOW_MS) {
      store.set(k, { failures: 1, firstAt: now, lockedUntil: 0 });
    } else {
      e.failures += 1;
      if (e.failures >= MAX_FAILURES) e.lockedUntil = now + LOCK_MS;
    }
  }
}

export function clearFailures(keys: string[]) {
  for (const k of keys) store.delete(k);
}

/** Làm chậm phản hồi khi sai, để dò mật khẩu tốn thời gian hơn */
export const failureDelay = () => new Promise((r) => setTimeout(r, 400 + Math.random() * 300));
