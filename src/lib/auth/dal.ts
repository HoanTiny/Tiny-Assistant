/**
 * Data Access Layer cho xác thực: mọi trang / action / API đều lấy user qua đây.
 */
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { asc, count, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { readSession } from "./session";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  /** Workspace đang dùng (hiện tại: workspace đầu tiên của user) */
  workspaceId: string;
  workspaceName: string;
  role: schema.WorkspaceRole;
};

/** Lấy user hiện tại, null nếu chưa đăng nhập. Được cache trong 1 request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Dữ liệu người dùng luôn đọc lúc có request thật, không bao giờ prerender
  await connection();
  const userId = await readSession();
  if (!userId) return null;

  const db = await getDb();
  const [row] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      workspaceId: schema.workspaces.id,
      workspaceName: schema.workspaces.name,
      role: schema.workspaceMembers.role,
    })
    .from(schema.users)
    .innerJoin(schema.workspaceMembers, eq(schema.workspaceMembers.userId, schema.users.id))
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.workspaceMembers.workspaceId))
    .where(eq(schema.users.id, userId))
    .orderBy(asc(schema.workspaceMembers.createdAt))
    .limit(1);

  return row ?? null;
});

/** Dùng trong trang: chưa đăng nhập thì chuyển về /login */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** App đã có tài khoản nào chưa (chưa có → hiện trang /setup) */
export async function hasAnyUser(): Promise<boolean> {
  await connection();
  const db = await getDb();
  const [row] = await db.select({ n: count() }).from(schema.users);
  return (row?.n ?? 0) > 0;
}
