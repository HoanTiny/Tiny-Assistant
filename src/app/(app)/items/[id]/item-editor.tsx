"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  Bold,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  Flag,
  Heading2,
  List,
  ListChecks,
  NotebookPen,
  Pencil,
  Save,
  X,
} from "lucide-react";
import { Kbd } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { PRIORITIES, TASK_STATUSES } from "@/lib/modules";
import { cn } from "@/lib/utils";
import { saveItem } from "../../actions";

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

const PRIORITY_STYLE: Record<number, { dot: string; active: string }> = {
  0: { dot: "bg-neutral-300 dark:bg-neutral-600", active: "bg-card text-foreground shadow-2xs" },
  1: { dot: "bg-violet-500", active: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  2: { dot: "bg-amber-500", active: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  3: { dot: "bg-rose-500", active: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
};

function offsetDateStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ItemEditor({
  item,
  typeLabel,
  tags = [],
  createdLabel,
  updatedLabel,
}: {
  item: EditableItem;
  typeLabel: string;
  tags?: string[];
  createdLabel: string;
  updatedLabel: string;
}) {
  const [state, action, pending] = useActionState(saveItem, undefined);
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);
  const [status, setStatus] = useState(item.status ?? "todo");
  const [priority, setPriority] = useState(item.priority);
  const [dueAt, setDueAt] = useState(item.dueAt ?? "");
  const [preview, setPreview] = useState(item.type === "note" && item.content.length > 0);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(() =>
    JSON.stringify({
      title: item.title,
      content: item.content,
      status: item.status ?? "todo",
      priority: item.priority,
      dueAt: item.dueAt ?? "",
    }),
  );

  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isTask = item.type === "task";

  const currentSnapshot = JSON.stringify({ title, content, status, priority, dueAt });
  const isDirty = currentSnapshot !== lastSavedSnapshot;

  // Cập nhật mốc đã lưu khi server action thành công
  useEffect(() => {
    if (state?.ok) setLastSavedSnapshot(currentSnapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.savedAt]);

  // Hỗ trợ Ctrl+S / ⌘S lưu nhanh
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

  // Nhận kết quả chèn trực tiếp từ bảng Trợ lý AI bên cạnh
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

  // Đếm tiến độ checklist Markdown nếu có (- [ ] / - [x])
  const checklist = useMemo(() => {
    const matches = content.match(/^\s*-\s+\[([ xX])\]/gm);
    if (!matches || matches.length === 0) return null;
    const done = matches.filter((m) => /\[[xX]\]/.test(m)).length;
    return { done, total: matches.length, pct: Math.round((done / matches.length) * 100) };
  }, [content]);

  const insertSnippet = (snippet: string) => {
    setPreview(false);
    const el = textareaRef.current;
    if (!el) {
      setContent((prev) => (prev ? `${prev}\n${snippet}` : snippet));
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const needsNewline = before.length > 0 && !before.endsWith("\n") && !snippet.startsWith("**");
    const inserted = `${needsNewline ? "\n" : ""}${snippet}`;
    const next = `${before}${inserted}${after}`;
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + inserted.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const isDone = isTask && status === "done";

  return (
    <div className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-[0_2px_20px_-8px_rgba(0,0,0,0.07)] dark:shadow-[0_8px_32px_-12px_rgba(0,0,0,0.45)]">
      <form ref={formRef} action={action} className="flex flex-col">
        <input type="hidden" name="id" value={item.id} />
        {isTask && (
          <>
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="priority" value={String(priority)} />
          </>
        )}

        {/* Phần đầu tài liệu: loại mục + tiêu đề lớn + dải thuộc tính tinh gọn */}
        <div className="px-6 pt-6 pb-5 sm:px-8 sm:pt-7">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/80 px-2.5 py-0.5 text-[11.5px] font-semibold text-muted-foreground">
              {isTask ? <CheckCircle2 size={12} className="text-primary" /> : <NotebookPen size={12} className="text-primary" />}
              {typeLabel}
            </span>
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-[11.5px] font-semibold text-accent-foreground"
              >
                #{t}
              </span>
            ))}
          </div>

          {/* Tiêu đề chính kiểu tài liệu + nút đánh dấu hoàn thành nhanh */}
          <div className="flex items-start gap-3">
            {isTask && (
              <button
                type="button"
                onClick={() => setStatus((s) => (s === "done" ? "todo" : "done"))}
                title={isDone ? "Đánh dấu chưa xong" : "Đánh dấu hoàn thành"}
                aria-label={isDone ? "Đánh dấu chưa xong" : "Đánh dấu hoàn thành"}
                className={cn(
                  "mt-1.5 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full transition-all",
                  isDone
                    ? "bg-emerald-500 text-white shadow-xs hover:bg-emerald-600"
                    : "border-2 border-border-strong text-transparent hover:border-primary",
                )}
              >
                {isDone ? <Check size={14} strokeWidth={3} /> : <Circle size={12} />}
              </button>
            )}
            <input
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              aria-label="Tiêu đề"
              placeholder="Tiêu đề công việc..."
              className={cn(
                "font-display w-full bg-transparent text-2xl font-bold tracking-[-0.025em] text-foreground outline-none focus-visible:outline-none placeholder:text-muted-foreground/50 sm:text-[30px] sm:leading-tight",
                isDone && "text-muted-foreground line-through decoration-muted-foreground/50",
              )}
            />
          </div>

          {/* Bảng thuộc tính kiểu Linear / Notion: gọn, có màu, bấm 1 chạm */}
          {isTask && (
            <div className="mt-5 space-y-2.5 rounded-2xl border border-border/70 bg-muted/30 p-3.5">
              {/* Hàng 1: Trạng thái */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="w-20 shrink-0 text-xs font-semibold text-muted-foreground">Trạng thái</span>
                <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-muted/90 p-0.5">
                  {TASK_STATUSES.map((s) => {
                    const active = status === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setStatus(s.value)}
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                          active ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[s.value] ?? "bg-neutral-400")} />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hàng 2: Ưu tiên */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="inline-flex w-20 shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground">
                  <Flag size={12} /> Ưu tiên
                </span>
                <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-muted/90 p-0.5">
                  {PRIORITIES.map((p) => {
                    const active = priority === p.value;
                    const st = PRIORITY_STYLE[p.value] ?? PRIORITY_STYLE[0];
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setPriority(p.value)}
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                          active ? st.active : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <span className={cn("h-2 w-2 rounded-full", st.dot)} />
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hàng 3: Hạn chót + chọn nhanh */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="inline-flex w-20 shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground">
                  <CalendarDays size={12} /> Hạn chót
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="relative inline-flex items-center">
                    <input
                      id="dueAt"
                      name="dueAt"
                      type="date"
                      value={dueAt}
                      onChange={(e) => setDueAt(e.target.value)}
                      className="h-8 cursor-pointer rounded-xl border border-border bg-card px-2.5 text-xs font-semibold text-foreground transition-colors hover:border-border-strong focus:border-primary focus:outline-none focus-visible:outline-none"
                    />
                    {dueAt && (
                      <button
                        type="button"
                        onClick={() => setDueAt("")}
                        title="Bỏ hạn chót"
                        aria-label="Bỏ hạn chót"
                        className="ml-1 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  <div className="inline-flex items-center gap-1">
                    {(
                      [
                        ["Hôm nay", 0],
                        ["Ngày mai", 1],
                        ["+7 ngày", 7],
                      ] as const
                    ).map(([label, offset]) => {
                      const target = offsetDateStr(offset);
                      const isMatch = dueAt === target;
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setDueAt(target)}
                          className={cn(
                            "cursor-pointer rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                            isMatch
                              ? "bg-accent font-semibold text-accent-foreground"
                              : "bg-card text-muted-foreground hover:bg-hover hover:text-foreground",
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Thanh công cụ soạn thảo mảnh nằm liền mạch trên tờ giấy */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-y border-border/70 bg-muted/20 px-6 py-2 sm:px-8">
          <div className="flex items-center gap-1">
            <span className="mr-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isTask ? "Mô tả" : "Nội dung"}
            </span>
            {!preview && (
              <>
                <ToolbarBtn label="Tiêu đề" onClick={() => insertSnippet("### ")}>
                  <Heading2 size={14} />
                </ToolbarBtn>
                <ToolbarBtn label="In đậm" onClick={() => insertSnippet("**văn bản**")}>
                  <Bold size={14} />
                </ToolbarBtn>
                <ToolbarBtn label="Danh sách" onClick={() => insertSnippet("- ")}>
                  <List size={14} />
                </ToolbarBtn>
                <ToolbarBtn label="Checklist" onClick={() => insertSnippet("- [ ] ")}>
                  <ListChecks size={14} />
                </ToolbarBtn>
              </>
            )}
            {checklist && (
              <span className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 size={12} />
                {checklist.done}/{checklist.total} mục ({checklist.pct}%)
              </span>
            )}
          </div>

          <div className="inline-flex rounded-full bg-muted p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setPreview(false)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1 rounded-full px-3 py-1 transition-colors",
                !preview ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Pencil size={12} /> Viết
            </button>
            <button
              type="button"
              onClick={() => setPreview(true)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1 rounded-full px-3 py-1 transition-colors",
                preview ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Eye size={12} /> Xem trước
            </button>
          </div>
        </div>

        {/* Vùng viết thoáng đãng, không lồng hộp */}
        <div className="px-6 py-5 sm:px-8">
          <textarea
            ref={textareaRef}
            name="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={isTask ? 10 : 16}
            placeholder={
              isTask
                ? "Ghi lại kịch bản, ý tưởng, đường dẫn hoặc nhấn nút Checklist phía trên để chia nhỏ bước..."
                : "Bắt đầu viết ghi chú của bạn..."
            }
            aria-label="Nội dung"
            className={cn(
              "block min-h-56 w-full resize-y bg-transparent text-[15px] leading-[1.75] text-foreground outline-none focus-visible:outline-none placeholder:text-muted-foreground/60",
              preview && "hidden",
            )}
          />
          {preview && (
            <div className="min-h-56">
              {content.trim() ? (
                <Markdown className="text-[15px]">{content}</Markdown>
              ) : (
                <p className="text-sm italic text-muted-foreground">Chưa có nội dung để xem trước.</p>
              )}
            </div>
          )}
        </div>

        {/* Chân trang tinh tế: thời gian, trạng thái lưu & nút Lưu kèm phím tắt */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-muted/20 px-6 py-3.5 sm:px-8">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={13} />
              Tạo {createdLabel} · Sửa {updatedLabel}
            </span>
            {isDirty && !pending && (
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Có thay đổi chưa lưu
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {state?.ok && !pending && !isDirty && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                <Check size={14} /> Đã lưu
              </span>
            )}
            {state?.error && <span className="text-xs font-semibold text-danger">{state.error}</span>}
            <button
              type="submit"
              disabled={pending}
              className={cn(
                "inline-flex h-9 cursor-pointer items-center gap-2 rounded-full px-4 text-xs font-bold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
                isDirty
                  ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover"
                  : "border border-border-strong bg-card text-foreground hover:border-primary hover:text-primary",
              )}
            >
              <Save size={14} />
              <span>{pending ? "Đang lưu..." : "Lưu thay đổi"}</span>
              <Kbd className={cn("hidden sm:inline", isDirty && "border-white/25 bg-white/15 text-white")}>Ctrl S</Kbd>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function ToolbarBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
    >
      {children}
    </button>
  );
}
