import { Suspense } from "react";
import { Sidebar } from "@/components/sidebar";
import { CommandPalette } from "@/components/command-palette";
import { TopBar, UserDropdown } from "@/components/top-bar";
import { requireUser } from "@/lib/auth/dal";
import { logout } from "../(auth)/actions";

// Mọi trang ở đây phụ thuộc phiên đăng nhập nên luôn render lúc có request
// (loading.tsx hiển thị khung chờ). Tắt kiểm tra "instant navigation" của Next.js cho nhóm trang này.
export const instant = false;

async function UserMenu() {
  const user = await requireUser();
  return (
    <UserDropdown
      user={{ name: user.name, email: user.email, workspaceName: user.workspaceName }}
      logoutAction={logout}
    />
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          userSlot={
            <Suspense fallback={<div className="h-11 w-11 animate-pulse rounded-full bg-muted" />}>
              <UserMenu />
            </Suspense>
          }
        />
        <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6 md:px-8">
          <div className="mx-auto max-w-[96rem]">{children}</div>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
