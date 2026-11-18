/**
 * Kết nối database.
 *
 * - Có DATABASE_URL  → dùng PostgreSQL thật (production / VPS / Supabase / Neon...).
 * - Không có         → dùng PGlite: Postgres nhúng, lưu ở thư mục .data/pglite (không cần cài gì).
 *
 * Migration trong thư mục /drizzle được tự động chạy ở lần kết nối đầu tiên.
 */
import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

/** Cả PGlite và postgres-js đều có chung API truy vấn của Drizzle */
export type AppDb = PostgresJsDatabase<typeof schema>;

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

async function connect(): Promise<AppDb> {
  const url = process.env.DATABASE_URL;

  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(url, { max: 10 });
    const db = drizzle({ client, schema });
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    return db;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dataDir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  mkdirSync(path.dirname(dataDir), { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db as unknown as AppDb;
}

// Giữ một kết nối duy nhất cho cả tiến trình (kể cả khi Next.js hot-reload module).
const globalForDb = globalThis as unknown as { __workhubDb?: Promise<AppDb> };

export function getDb(): Promise<AppDb> {
  if (!globalForDb.__workhubDb) {
    globalForDb.__workhubDb = connect().catch((err) => {
      globalForDb.__workhubDb = undefined;
      throw err;
    });
  }
  return globalForDb.__workhubDb;
}

export { schema };
