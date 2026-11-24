import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, hasAnyUser } from "@/lib/auth/dal";
import { login } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Đăng nhập" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  if (!(await hasAnyUser())) redirect("/setup");

  return (
    <AuthForm
      action={login}
      title="Chào mừng trở lại"
      description="Đăng nhập để tiếp tục công việc của bạn."
      submitLabel="Đăng nhập"
      fields={[
        { name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "ban@congty.vn" },
        { name: "password", label: "Mật khẩu", type: "password", autoComplete: "current-password" },
      ]}
    />
  );
}
