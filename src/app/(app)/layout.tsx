import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { CommandPalette } from "@/components/command-palette";
import { requireUser } from "@/lib/auth/dal";
import { logout } from "../(auth)/actions";

// Mọi trang ở đây phụ thuộc phiên đăng nhập nên luôn render lúc có request
// (loading.tsx hiển thị khung chờ). Tắt kiểm tra "instant navigation" của Next.js cho nhóm trang này.
export const instant = false;

async function UserMenu() {
  const user = await requireUser();
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{user.name}</div>
        <div className="truncate text-xs text-muted-foreground">{user.workspaceName}</div>
      </div>
      <form action={logout}>
        <button
          type="submit"
          title="Đăng xuất"
          aria-label="Đăng xuất"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut size={16} />
        </button>
      </form>
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="md:flex">
      <Sidebar
        userSlot={
          <Suspense fallback={<div className="h-12 animate-pulse rounded-lg bg-muted" />}>
            <UserMenu />
          </Suspense>
        }
      />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
      <CommandPalette />
    </div>
  );
}
