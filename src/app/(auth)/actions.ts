"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { hasAnyUser } from "@/lib/auth/dal";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, deleteSession } from "@/lib/auth/session";
import {
  checkSetupToken,
  clearFailures,
  clientIp,
  failureDelay,
  lockedMinutes,
  recordFailure,
  setupGuard,
} from "@/lib/auth/guards";

export type FormState = { error?: string } | undefined;

const setupSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên của bạn"),
  email: z.email("Email không hợp lệ").trim().toLowerCase(),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
});

/** Tạo tài khoản chủ sở hữu đầu tiên. Chỉ chạy được khi app chưa có user nào và nhập đúng mã thiết lập. */
export async function setupOwner(_prev: FormState, formData: FormData): Promise<FormState> {
  if (await hasAnyUser()) return { error: "App đã được thiết lập. Hãy đăng nhập." };

  const guard = setupGuard();
  if (guard === "locked") {
    return { error: "Trang thiết lập đang khóa. Đặt SETUP_TOKEN trong file .env rồi khởi động lại app." };
  }
  if (guard === "token") {
    const keys = [`setup:${await clientIp()}`];
    const wait = lockedMinutes(keys);
    if (wait) return { error: `Nhập sai quá nhiều lần. Thử lại sau ${wait} phút.` };
    if (!checkSetupToken(formData.get("setupToken"))) {
      recordFailure(keys);
      await failureDelay();
      return { error: "Mã thiết lập không đúng." };
    }
    clearFailures(keys);
  }

  const parsed = setupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { name, email, password } = parsed.data;

  const db = await getDb();
  const passwordHash = await hashPassword(password);
  const userId = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(schema.users)
      .values({ name, email, passwordHash })
      .returning({ id: schema.users.id });
    const [ws] = await tx
      .insert(schema.workspaces)
      .values({ name: "Cá nhân" })
      .returning({ id: schema.workspaces.id });
    await tx
      .insert(schema.workspaceMembers)
      .values({ workspaceId: ws.id, userId: user.id, role: "owner" });
    return user.id;
  });

  await createSession(userId);
  redirect("/");
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string().min(1),
});

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Nhập email và mật khẩu" };

  // Khóa tạm sau 5 lần sai trong 15 phút, tính riêng theo IP và theo email
  const keys = [`login-ip:${await clientIp()}`, `login-email:${parsed.data.email}`];
  const wait = lockedMinutes(keys);
  if (wait) return { error: `Đăng nhập sai quá nhiều lần. Thử lại sau ${wait} phút.` };

  const db = await getDb();
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, parsed.data.email))
    .limit(1);

  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    recordFailure(keys);
    await failureDelay();
    return { error: "Email hoặc mật khẩu không đúng" };
  }

  clearFailures(keys);
  await createSession(user.id);
  redirect("/");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
