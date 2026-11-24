"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogOut, Menu, Search, Settings, Zap } from "lucide-react";
import { openCommandPalette } from "./command-palette";
import { openNav } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { Kbd, buttonClass } from "./ui";

type UserInfo = { name: string; email: string; workspaceName: string };

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts.at(-1)?.[0] ?? "") + (parts.length > 1 ? (parts[0]?.[0] ?? "") : "")).toUpperCase() || "?";
}

/** Avatar + menu thả xuống: thông tin tài khoản, giao diện, cài đặt, đăng xuất */
export function UserDropdown({ user, logoutAction }: { user: UserInfo; logoutAction: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Tài khoản"
        className="flex rounded-full p-1 transition-colors hover:bg-black/5 dark:hover:bg-black/40"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-white">
          {initials(user.name)}
        </span>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl border bg-card p-2 shadow-elevated">
          <div className="flex items-center gap-3 px-3 py-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
              {initials(user.name)}
            </span>
            <div className="min-w-0">
              <div className="truncate font-bold">{user.name}</div>
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            </div>
          </div>
          <div className="px-3 pb-2 pt-1">
            <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Giao diện</div>
            <ThemeToggle />
          </div>
          <div className="my-1 border-t" />
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-semibold hover:bg-hover"
          >
            <Settings size={16} className="text-muted-foreground" /> Cài đặt
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-semibold text-danger hover:bg-danger/10"
            >
              <LogOut size={16} /> Đăng xuất
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/** Thanh trên cùng: mở menu (điện thoại), tìm kiếm / ghi nhanh, tài khoản */
export function TopBar({ userSlot }: { userSlot: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 bg-card px-4 shadow-sm dark:shadow-2xl">
      <button
        type="button"
        onClick={openNav}
        aria-label="Mở menu"
        className="rounded-full p-2 text-xl transition-colors hover:bg-black/5 hover:text-foreground lg:hidden dark:hover:bg-black/40"
      >
        <Menu size={22} />
      </button>
      <button
        type="button"
        onClick={openCommandPalette}
        aria-label="Tìm kiếm"
        className="flex h-10 min-w-0 items-center gap-2.5 rounded-full px-2 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground sm:w-full sm:max-w-sm sm:rounded-xl sm:bg-field sm:px-3.5 dark:hover:bg-black/40"
      >
        <Search size={20} />
        <span className="hidden flex-1 truncate text-left text-sm sm:inline">Tìm hoặc ghi nhanh...</span>
        <Kbd className="hidden sm:inline">Ctrl K</Kbd>
      </button>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button type="button" onClick={openCommandPalette} className={buttonClass("primary", "sm", "hidden sm:inline-flex")}>
          <Zap size={16} /> Ghi nhanh
        </button>
        {userSlot}
      </div>
    </header>
  );
}
