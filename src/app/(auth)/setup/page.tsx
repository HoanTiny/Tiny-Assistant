import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, hasAnyUser } from "@/lib/auth/dal";
import { setupOwner } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Thiết lập" };

export default async function SetupPage() {
  if (await getCurrentUser()) redirect("/");
  if (await hasAnyUser()) redirect("/login");

  return (
    <AuthForm
      action={setupOwner}
      title="Chào mừng đến WorkHub"
      description="Tạo tài khoản chủ sở hữu. Chỉ làm một lần, sau đó trang này sẽ bị khóa."
      submitLabel="Tạo tài khoản"
      fields={[
        { name: "name", label: "Tên của bạn", autoComplete: "name" },
        { name: "email", label: "Email", type: "email", autoComplete: "email" },
        { name: "password", label: "Mật khẩu (tối thiểu 8 ký tự)", type: "password", autoComplete: "new-password" },
      ]}
    />
  );
}
