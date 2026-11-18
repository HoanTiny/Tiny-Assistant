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
      title="Đăng nhập"
      submitLabel="Đăng nhập"
      fields={[
        { name: "email", label: "Email", type: "email", autoComplete: "email" },
        { name: "password", label: "Mật khẩu", type: "password", autoComplete: "current-password" },
      ]}
    />
  );
}
