"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { MODULES, SYSTEM_LINKS, type ModuleDef } from "@/lib/modules";
import { cn } from "@/lib/utils";

export const OPEN_NAV_EVENT = "wh:open-nav";

function NavLink({ mod, active, onNavigate }: { mod: ModuleDef; active: boolean; onNavigate?: () => void }) {
  const Icon = mod.icon;
  return (
    <Link
      href={mod.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-12 items-center gap-2.5 rounded-lg px-3 text-sm font-semibold transition-colors duration-150",
        active
          ? "bg-accent text-primary"
          : "text-neutral-600 hover:bg-hover hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100",
      )}
    >
      <Icon size={20} strokeWidth={1.8} className="shrink-0" />
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

function NavGroup({ title, mods, onNavigate }: { title: string; mods: ModuleDef[]; onNavigate?: () => void }) {
  return (
    <div>
      <div className="mb-1 px-3 text-xs font-semibold text-muted-foreground">{title}</div>
      <div className="space-y-0.5">
        <Suspense fallback={<NavList mods={mods} onNavigate={onNavigate} />}>
          <ActiveNavList mods={mods} onNavigate={onNavigate} />
        </Suspense>
      </div>
    </div>
  );
}

export function BrandMark({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={cn(
          "flex items-center justify-center rounded-xl bg-neutral-900 font-bold text-white dark:bg-white dark:text-neutral-900",
          size === "lg" ? "h-11 w-11 text-xl" : "h-9 w-9 text-base",
        )}
        aria-hidden="true"
      >
        W
      </span>
      <span className={cn("font-display", size === "lg" ? "text-2xl" : "text-lg")}>WorkHub</span>
    </span>
  );
}

/** Mở menu bên trên điện thoại (nút ở thanh trên gọi hàm này) */
export function openNav() {
  window.dispatchEvent(new Event(OPEN_NAV_EVENT));
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_NAV_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_NAV_EVENT, onOpen);
  }, []);

  const groups = [...new Set(MODULES.map((m) => m.group ?? "Khác"))];

  const nav = (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={close} className="flex h-16 shrink-0 items-center px-6">
        <BrandMark />
      </Link>
      <nav className="flex-1 space-y-5 overflow-y-auto px-4 pb-6 pt-2" aria-label="Module">
        {groups.map((g) => (
          <NavGroup key={g} title={g} mods={MODULES.filter((m) => (m.group ?? "Khác") === g)} onNavigate={close} />
        ))}
        <NavGroup title="Hệ thống" mods={SYSTEM_LINKS} onNavigate={close} />
      </nav>
    </div>
  );

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={close} />
          <aside className="absolute inset-y-0 left-0 w-[290px] bg-sidebar">
            <button aria-label="Đóng menu" onClick={close} className="absolute right-3 top-3.5 rounded-full p-2 hover:bg-hover">
              <X size={18} />
            </button>
            {nav}
          </aside>
        </div>
      )}
      <aside className="sticky top-0 hidden h-screen w-[290px] shrink-0 border-r bg-sidebar lg:block">{nav}</aside>
    </>
  );
}
