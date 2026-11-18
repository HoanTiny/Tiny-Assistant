"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Menu, X, Zap } from "lucide-react";
import { Suspense, useState } from "react";
import { MODULES, SYSTEM_LINKS, type ModuleDef } from "@/lib/modules";
import { cn } from "@/lib/utils";
import { openCommandPalette } from "./command-palette";

function NavLink({ mod, active, onNavigate }: { mod: ModuleDef; active: boolean; onNavigate?: () => void }) {
  const Icon = mod.icon;
  return (
    <Link
      href={mod.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon size={17} />
      {mod.label}
    </Link>
  );
}

function NavList({ mods, pathname, onNavigate }: { mods: ModuleDef[]; pathname?: string; onNavigate?: () => void }) {
  return mods.map((m) => (
    <NavLink
      key={m.key}
      mod={m}
      onNavigate={onNavigate}
      active={pathname !== undefined && (m.href === "/" ? pathname === "/" : pathname.startsWith(m.href))}
    />
  ));
}

/** Đọc URL hiện tại để tô sáng mục đang mở. Nằm trong Suspense vì URL chỉ có lúc chạy. */
function ActiveNavList(props: { mods: ModuleDef[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return <NavList {...props} pathname={pathname} />;
}

function Nav(props: { mods: ModuleDef[]; onNavigate?: () => void }) {
  return (
    <Suspense fallback={<NavList {...props} />}>
      <ActiveNavList {...props} />
    </Suspense>
  );
}

export function Sidebar({ userSlot }: { userSlot: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const nav = (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={close} className="mb-6 flex items-center gap-2 px-3 font-semibold">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <LayoutGrid size={16} />
        </span>
        WorkHub
      </Link>
      <button
        type="button"
        onClick={() => {
          close();
          openCommandPalette();
        }}
        className="mb-4 flex w-full items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <Zap size={15} className="text-primary" />
        <span className="flex-1 text-left">Nhập nhanh...</span>
        <kbd className="rounded border px-1.5 text-[10px]">Ctrl K</kbd>
      </button>
      <nav className="space-y-1">
        <Nav mods={MODULES} onNavigate={close} />
      </nav>
      <div className="mt-auto space-y-1 border-t pt-4">
        <Nav mods={SYSTEM_LINKS} onNavigate={close} />
        <div className="pt-2">{userSlot}</div>
      </div>
    </div>
  );

  return (
    <>
      {/* Thanh trên cho điện thoại */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur md:hidden">
        <span className="font-semibold">WorkHub</span>
        <button aria-label="Nhập nhanh" onClick={openCommandPalette} className="ml-auto mr-1 rounded-lg p-1.5 text-primary hover:bg-muted">
          <Zap size={20} />
        </button>
        <button aria-label="Mở menu" onClick={() => setOpen(true)} className="rounded-lg p-1.5 hover:bg-muted">
          <Menu size={20} />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={close} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r bg-card p-4">
            <button aria-label="Đóng menu" onClick={close} className="absolute right-3 top-3 rounded-lg p-1.5 hover:bg-muted">
              <X size={18} />
            </button>
            {nav}
          </aside>
        </div>
      )}
      {/* Thanh bên cho máy tính */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r bg-card p-4 md:block">{nav}</aside>
    </>
  );
}
