/**
 * Mã hóa dữ liệu nhạy cảm (token OAuth, API key của dịch vụ ngoài...) trước khi lưu DB.
 * AES-256-GCM, khóa sinh từ APP_SECRET. Đổi APP_SECRET = mất khả năng giải mã dữ liệu cũ.
 */
import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(): Buffer {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("APP_SECRET chưa được đặt hoặc quá ngắn (cần >= 32 ký tự). Xem .env.example");
  }
  return createHash("sha256").update(secret).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(".");
}

export function decrypt(payload: string): string {
  const [version, iv, tag, data] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Dữ liệu mã hóa không hợp lệ");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export function encryptJson(value: unknown): string {
  return encrypt(JSON.stringify(value));
}

export function decryptJson<T>(payload: string): T {
  return JSON.parse(decrypt(payload)) as T;
}
