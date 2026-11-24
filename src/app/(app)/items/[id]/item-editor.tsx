"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CalendarDays, Check, CheckSquare, ChevronDown, Eye, Flag, NotebookPen, Pencil, X } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { PRIORITIES, TASK_STATUSES } from "@/lib/modules";
import { cn } from "@/lib/utils";
import { saveItem } from "../../actions";
import { TagEditor } from "./tag-editor";

type EditableItem = {
  id: string;
  type: string;
  title: string;
  content: string;
  status: string | null;
  priority: number;
  dueAt: string | null; // yyyy-mm-dd
};

const STATUS_DOT: Record<string, string> = {
  todo: "bg-neutral-400",
  doing: "bg-amber-500",
  done: "bg-emerald-500",
};

const PRIORITY_TONE: Record<number, string> = {
  0: "text-muted-foreground",
  1: "text-violet-600 dark:text-violet-400",
  2: "text-amber-600 dark:text-amber-400",
  3: "text-rose-600 dark:text-rose-400",
};

export function ItemEditor({
  item,
  tags = [],
  createdLabel,
  updatedLabel,
}: {
  item: EditableItem;
  tags?: string[];
  createdLabel: string;
  updatedLabel: string;
}) {
  const [state, action, pending] = useActionState(saveItem, undefined);
  // Chỉ công việc và ghi chú đổi loại qua lại được
  const canSwitchType = item.type === "task" || item.type === "note";
  const [type, setType] = useState(item.type);
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);
  const [status, setStatus] = useState(item.status ?? "todo");
  const [priority, setPriority] = useState(item.priority);
  const [dueAt, setDueAt] = useState(item.dueAt ?? "");
  const [preview, setPreview] = useState(item.type === "note" && item.content.length > 0);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(() =>
    JSON.stringify({
      type: item.type,
      title: item.title,
      content: item.content,
      status: item.status ?? "todo",
      priority: item.priority,
      dueAt: item.dueAt ?? "",
    }),
  );
  const [seenSavedAt, setSeenSavedAt] = useState<number | undefined>(undefined);

  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isTask = type === "task";

  const currentSnapshot = JSON.stringify({ type, title, content, status, priority, dueAt });
  const isDirty = currentSnapshot !== lastSavedSnapshot;

  // Lưu thành công lần mới → đánh dấu nội dung hiện tại là "đã lưu".
  // Cập nhật ngay trong lúc render (cách React khuyên dùng) thay vì trong useEffect.
  if (state?.ok && state.savedAt !== seenSavedAt) {
    setSeenSavedAt(state.savedAt);
    setLastSavedSnapshot(currentSnapshot);
  }

  // Lưu nhanh bằng Ctrl+S / ⌘S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!pending) formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  // Nhận văn bản chèn từ bảng Trợ lý AI
  useEffect(() => {
    const onAppend = (e: Event) => {
      const detail = (e as CustomEvent<{ itemId: string; text: string }>).detail;
      if (!detail || detail.itemId !== item.id || !detail.text) return;
      setContent((prev) => (prev.trim() ? `${prev.trimEnd()}\n\n${detail.text.trim()}` : detail.text.trim()));
      setPreview(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    };
    window.addEventListener("wh:item-append", onAppend);
    return () => window.removeEventListener("wh:item-append", onAppend);
  }, [item.id]);

  const pillClass =
    "h-9 cursor-pointer appearance-none rounded-full border border-border bg-muted/50 text-xs font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-muted focus:border-primary focus:bg-card focus:outline-none focus-visible:outline-none";

  return (
    <Card className="p-6 sm:p-8 lg:p-10">
      <form ref={formRef} action={action} className="flex flex-col">
        <input type="hidden" name="id" value={item.id} />

        {/* Tiêu đề lớn thoáng đãng */}
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          aria-label="Tiêu đề"
          placeholder="Nhập tiêu đề..."
          className="font-display w-full bg-transparent text-2xl font-bold tracking-[-0.02em] text-foreground outline-none focus-visible:outline-none placeholder:text-muted-foreground/50 sm:text-3xl"
        />

        {/* Dải thuộc tính gọn trên 1 hàng duy nhất */}
        {
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {/* Loại: đổi công việc ↔ ghi chú (khi AI xếp nhầm). Đổi xong bấm Lưu. */}
            {canSwitchType && (
              <div className="relative inline-flex items-center">
                {isTask ? (
                  <CheckSquare size={13} className="pointer-events-none absolute left-3 text-primary" />
                ) : (
                  <NotebookPen size={13} className="pointer-events-none absolute left-3 text-primary" />
                )}
                <select
                  name="type"
                  aria-label="Loại"
                  title="Đổi loại rồi bấm Lưu thay đổi"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className={cn(pillClass, "pl-7 pr-7")}
                >
                  <option value="task">Công việc</option>
                  <option value="note">Ghi chú</option>
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-2.5 text-muted-foreground" />
              </div>
            )}

            {isTask && (
              <>
                {/* Trạng thái */}
                <div className="relative inline-flex items-center">
                  <span
                    className={cn(
                      "pointer-events-none absolute left-3 h-2 w-2 rounded-full",
                      STATUS_DOT[status] ?? "bg-neutral-400",
                    )}
                  />
                  <select
                    name="status"
                    aria-label="Trạng thái"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className={cn(pillClass, "pl-7 pr-7")}
                  >
                    {TASK_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-2.5 text-muted-foreground" />
                </div>

                {/* Ưu tiên */}
                <div className="relative inline-flex items-center">
                  <Flag
                    size={13}
                    className={cn("pointer-events-none absolute left-3", PRIORITY_TONE[priority] ?? "text-muted-foreground")}
                  />
                  <select
                    name="priority"
                    aria-label="Mức ưu tiên"
                    value={String(priority)}
                    onChange={(e) => setPriority(Number(e.target.value))}
                    className={cn(pillClass, "pl-7 pr-7")}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.value === 0 ? "Không ưu tiên" : `Ưu tiên: ${p.label}`}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-2.5 text-muted-foreground" />
                </div>

                {/* Hạn chót */}
                <div className="relative inline-flex items-center">
                  <CalendarDays size={13} className="pointer-events-none absolute left-3 text-muted-foreground" />
                  <input
                    name="dueAt"
                    type="date"
                    aria-label="Hạn chót"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    className={cn(pillClass, "pl-8", dueAt ? "pr-7" : "pr-3 text-muted-foreground")}
                  />
                  {dueAt && (
                    <button
                      type="button"
                      onClick={() => setDueAt("")}
                      aria-label="Xóa hạn chót"
                      title="Xóa hạn chót"
                      className="absolute right-2 inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Tag: thêm / bỏ ngay tại chỗ */}
            <TagEditor itemId={item.id} initialTags={tags} />
          </div>
        }

        {/* Đường ngăn mảnh rồi vào thẳng vùng viết rộng rãi */}
        <div className="mt-6 border-t border-border/70 pt-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isTask ? "Mô tả chi tiết" : "Nội dung"}
            </span>
            <button
              type="button"
              onClick={() => setPreview((p) => !p)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {preview ? <Pencil size={12} /> : <Eye size={12} />}
              {preview ? "Chỉnh sửa" : "Xem trước"}
            </button>
          </div>

          <textarea
            ref={textareaRef}
            name="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={isTask ? 12 : 18}
            placeholder={isTask ? "Viết mô tả, ghi chú hoặc đường dẫn liên quan..." : "Bắt đầu viết nội dung..."}
            aria-label="Nội dung"
            className={cn(
              "block min-h-[280px] w-full resize-y bg-transparent text-[15px] leading-[1.8] text-foreground outline-none focus-visible:outline-none placeholder:text-muted-foreground/55",
              preview && "hidden",
            )}
          />
          {preview && (
            <div className="min-h-[280px]">
              {content.trim() ? (
                <Markdown className="text-[15px]">{content}</Markdown>
              ) : (
                <p className="text-sm text-muted-foreground">Chưa có nội dung.</p>
              )}
            </div>
          )}
        </div>

        {/* Chân trang tối giản */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-5">
          <span className="text-xs text-muted-foreground">
            Tạo {createdLabel} · Sửa {updatedLabel}
          </span>

          <div className="flex items-center gap-3">
            {isDirty && !pending && <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Chưa lưu</span>}
            {state?.ok && !pending && !isDirty && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                <Check size={14} /> Đã lưu
              </span>
            )}
            {state?.error && <span className="text-xs font-semibold text-danger">{state.error}</span>}
            <Button type="submit" size="sm" disabled={pending} className="px-5">
              {pending ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
