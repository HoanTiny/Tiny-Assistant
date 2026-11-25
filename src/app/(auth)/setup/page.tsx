import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { getCurrentUser, hasAnyUser } from "@/lib/auth/dal";
import { setupGuard } from "@/lib/auth/guards";
import { setupOwner } from "../actions";
import { AuthForm } from "../auth-form";
import Loading from "../loading";

export const metadata: Metadata = { title: "Thiết lập" };

async function SetupContent() {
  if (await getCurrentUser()) redirect("/");
  if (await hasAnyUser()) redirect("/login");

  const guard = setupGuard();

  if (guard === "locked") {
    return (
      <div>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-neutral-900">
          <Lock size={22} />
        </span>
        <h1 className="mt-5 text-3xl font-bold">Trang thiết lập đang khóa</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Để không ai khác chiếm được tài khoản chủ sở hữu, hãy đặt biến <code className="rounded bg-field px-1">SETUP_TOKEN</code>{" "}
          trong file <code className="rounded bg-field px-1">.env</code> trên server, khởi động lại app, rồi quay lại trang này
          và nhập mã đó.
        </p>
      </div>
    );
  }

  return (
    <AuthForm
      action={setupOwner}
      title="Thiết lập WorkHub"
      description="Tạo tài khoản chủ sở hữu. Bước này chỉ làm một lần, sau đó trang sẽ tự khóa."
      submitLabel="Tạo tài khoản"
      fields={[
        ...(guard === "token"
          ? [{ name: "setupToken", label: "Mã thiết lập (SETUP_TOKEN trong .env)", type: "password", autoComplete: "off" }]
          : []),
        { name: "name", label: "Tên của bạn", autoComplete: "name" },
        { name: "email", label: "Email", type: "email", autoComplete: "email" },
        { name: "password", label: "Mật khẩu (tối thiểu 8 ký tự)", type: "password", autoComplete: "new-password" },
      ]}
    />
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SetupContent />
    </Suspense>
  );
}
