"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckSquare, CornerDownLeft, NotebookPen, Sparkles, Zap, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui";
import { readChoice } from "@/components/ai/use-ai";
import { MODULES, SYSTEM_LINKS } from "@/lib/modules";
import { cn, formatDue, normalizeText } from "@/lib/utils";

type Option = { key: string; label: string; icon: LucideIcon; href?: string };

type Captured = {
  item: { id: string; type: string; title: string; dueAt: string | null; priority: number; tags: string[] };
  usedAI: boolean;
  warning?: string;
};

export const OPEN_PALETTE_EVENT = "wh:open-palette";

/** Mở ô nhập nhanh từ bất kỳ đâu (nút trên thanh bên...) */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
}

/**
 * Ô nhập nhanh (Ctrl+K / ⌘K):
 *  - Enter: AI phân loại câu vừa gõ thành công việc hoặc ghi chú rồi lưu
 *  - Hỏi trợ lý: mở trang Trợ lý AI với câu hỏi đó
 *  - Gõ tên module để chuyển trang
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [captured, setCaptured] = useState<Captured[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const close = useCallback(() => {
    setOpen(false);
    setError(null);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const options = useMemo<Option[]>(() => {
    const q = text.trim();
    const opts: Option[] = [];
    if (q) {
      opts.push({ key: "capture", label: `Lưu nhanh: “${q}”`, icon: Zap });
      opts.push({ key: "ask", label: `Hỏi trợ lý: “${q}”`, icon: Sparkles });
    }
    const nq = normalizeText(q);
    for (const m of [...MODULES, ...SYSTEM_LINKS]) {
      if (!q || normalizeText(m.label).includes(nq)) {
        opts.push({ key: `nav:${m.href}`, label: `Mở ${m.label}`, icon: m.icon, href: m.href });
      }
    }
    return opts;
  }, [text]);

  const capture = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value, ...readChoice() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setCaptured((c) => [data as Captured, ...c].slice(0, 5));
      setText("");
      setActive(0);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const select = (opt: Option | undefined) => {
    if (!opt || busy) return;
    const q = text.trim();
    if (opt.key === "capture") return void capture(q);
    close();
    if (opt.key === "ask") {
      setText("");
      router.push(`/ai?q=${encodeURIComponent(q)}`);
    } else if (opt.href) {
      setText("");
      router.push(opt.href);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Nhập nhanh">
      <div className="absolute inset-0 bg-black/40" onClick={close} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b px-4">
          <Zap size={18} className="shrink-0 text-primary" />
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, options.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                select(options[active]);
              } else if (e.key === "Escape") {
                close();
              }
            }}
            disabled={busy}
            placeholder="Gõ bất cứ điều gì: “Mai 3h gửi kịch bản cho anh Nam”..."
            className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Nhập nhanh"
          />
          {busy && <span className="text-xs text-muted-foreground">AI đang xử lý...</span>}
        </div>

        <ul className="max-h-72 overflow-y-auto p-2" role="listbox">
          {options.map((o, i) => {
            const Icon = o.icon;
            return (
              <li key={o.key} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => select(o)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm",
                    i === active ? "bg-accent text-accent-foreground" : "text-foreground",
                  )}
                >
                  <Icon size={16} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {i === active && <CornerDownLeft size={14} className="shrink-0 opacity-60" />}
                </button>
              </li>
            );
          })}
        </ul>

        {(error || captured.length > 0) && (
          <div className="border-t p-3">
            {error && <p className="mb-2 text-sm text-danger">{error}</p>}
            {captured.length > 0 && (
              <>
                <div className="mb-1.5 text-xs text-muted-foreground">Vừa lưu</div>
                <ul className="space-y-1.5">
                  {captured.map((c) => (
                    <li key={c.item.id} className="text-sm">
                      <div className="flex items-center gap-2">
                        {c.item.type === "task" ? (
                          <CheckSquare size={14} className="shrink-0 text-primary" />
                        ) : (
                          <NotebookPen size={14} className="shrink-0 text-primary" />
                        )}
                        <Link href={`/items/${c.item.id}`} onClick={close} className="min-w-0 flex-1 truncate hover:text-primary">
                          {c.item.title}
                        </Link>
                        {c.item.priority >= 3 && <Badge tone="danger">Gấp</Badge>}
                        {c.item.dueAt && <Badge>{formatDue(c.item.dueAt)}</Badge>}
                        {c.item.tags.map((t) => (
                          <Badge key={t} tone="accent">
                            {t}
                          </Badge>
                        ))}
                      </div>
                      {c.warning && <p className="mt-0.5 pl-6 text-xs text-warning">{c.warning}</p>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        <div className="flex justify-between border-t px-4 py-2 text-xs text-muted-foreground">
          <span>Enter: chọn · ↑↓: di chuyển · Esc: đóng</span>
          <span>Ctrl K</span>
        </div>
      </div>
    </div>
  );
}
