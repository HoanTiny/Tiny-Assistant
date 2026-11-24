"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Archive } from "lucide-react";

/** Nút "Ẩn khỏi danh sách" có bước xác nhận, tránh bấm nhầm */
export function ArchiveButton({ action }: { action: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!confirming) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setConfirming(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setConfirming(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [confirming]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setConfirming((c) => !c)}
        aria-expanded={confirming}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <Archive size={14} />
        <span>Ẩn khỏi danh sách</span>
      </button>

      {confirming && (
        <div role="dialog" aria-label="Xác nhận ẩn" className="absolute right-0 top-full z-30 mt-2 w-72 rounded-2xl border bg-card p-4 shadow-elevated">
          <p className="text-sm font-bold text-foreground">Ẩn mục này?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Mục sẽ không còn hiện trong danh sách. Bạn có thể khôi phục bất cứ lúc nào ở trang{" "}
            <Link href="/archived" className="font-semibold text-primary hover:underline">
              Đã ẩn
            </Link>
            .
          </p>
          <form action={action} className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="h-8 cursor-pointer rounded-lg px-3 text-xs font-semibold text-muted-foreground hover:bg-hover hover:text-foreground"
            >
              Hủy
            </button>
            <button type="submit" className="h-8 cursor-pointer rounded-lg bg-danger px-3 text-xs font-bold text-white hover:opacity-90">
              Ẩn
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
