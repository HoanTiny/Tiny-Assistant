import { LayoutGrid } from "lucide-react";

// Mọi trang ở đây phụ thuộc phiên đăng nhập nên luôn render lúc có request
// (loading.tsx hiển thị khung chờ). Tắt kiểm tra "instant navigation" của Next.js cho nhóm trang này.
export const instant = false;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2 text-lg font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LayoutGrid size={18} />
          </span>
          WorkHub
        </div>
        {children}
      </div>
    </main>
  );
}
