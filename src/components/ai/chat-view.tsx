"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  CalendarDays,
  Check,
  Clock,
  CloudSun,
  Globe,
  ListTodo,
  PanelLeft,
  Plus,
  PlusCircle,
  Search,
  Sparkles,
  Square,
  SquarePen,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ConversationSummary } from "@/app/(app)/ai/conversations";
import { Markdown } from "@/components/markdown";
import { cn, formatDateTime, normalizeText } from "@/lib/utils";
import { ModelPicker } from "./model-picker";
import { useAIModels } from "./use-ai";

type ToolUse = { name?: string; label: string; ok: boolean; link?: string };

export type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  tools?: ToolUse[];
  pending?: boolean;
};

const SUGGESTIONS: { text: string; icon: LucideIcon }[] = [
  { text: "Hôm nay tôi nên làm gì trước?", icon: ListTodo },
  { text: "Tuần này tôi có việc nào trễ hạn không?", icon: Clock },
  { text: "Lên kế hoạch cho ngày mai giúp tôi", icon: CalendarDays },
  { text: "Tạo việc: gọi điện cho khách hàng vào thứ 6", icon: PlusCircle },
];

export function ChatView({
  conversationId,
  conversationTitle,
  initialMessages,
  initialPrompt,
  conversations = [],
}: {
  conversationId?: string;
  conversationTitle?: string;
  initialMessages: ChatMsg[];
  initialPrompt?: string;
  conversations?: ConversationSummary[];
}) {
  const ai = useAIModels();
  const [messages, setMessages] = useState<ChatMsg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [isMultiline, setIsMultiline] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const sentInitial = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const promptsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const isEmpty = messages.length === 0;

  const filteredConversations = useMemo(() => {
    const q = normalizeText(search.trim());
    if (!q) return conversations;
    return conversations.filter((c) => normalizeText(c.title).includes(q));
  }, [conversations, search]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Tự co giãn chiều cao ô nhập & chuyển bo tròn pill <-> bo 28px khi nhiều dòng
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, 160);
    el.style.height = `${next}px`;
    setIsMultiline(next > 44 || input.includes("\n"));
  }, [input, isEmpty]);

  // Đóng menu gợi ý nhanh khi bấm ra ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!promptsOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (!promptsRef.current?.contains(e.target as Node)) setPromptsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPromptsOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [promptsOpen]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || streaming || !ai.choice) return;
    setInput("");
    setPromptsOpen(false);
    const replyId = `a-${Date.now()}`;
    setMessages((m) => [
      ...m,
      { id: `u-${Date.now()}`, role: "user", content: text },
      { id: replyId, role: "assistant", content: "", tools: [], pending: true },
    ]);
    const patch = (fn: (msg: ChatMsg) => ChatMsg) =>
      setMessages((m) => m.map((msg) => (msg.id === replyId ? fn(msg) : msg)));

    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    let newConversationId: string | undefined;
    let usedTools = false;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text, ...ai.choice }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error ?? "Có lỗi xảy ra");
      }

      // Đọc từng dòng NDJSON
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "conversation") newConversationId = ev.id;
          else if (ev.type === "tool") {
            usedTools = true;
            patch((msg) => ({
              ...msg,
              tools: [...(msg.tools ?? []), { name: ev.name, label: ev.label, ok: ev.ok, link: ev.link }],
            }));
          } else if (ev.type === "text") patch((msg) => ({ ...msg, content: ev.text, pending: false }));
          else if (ev.type === "error") patch((msg) => ({ ...msg, content: `⚠️ Lỗi AI: ${ev.message}`, pending: false }));
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        patch((msg) => ({ ...msg, content: `⚠️ ${(e as Error).message}`, pending: false }));
      }
    } finally {
      patch((msg) => ({ ...msg, pending: false }));
      setStreaming(false);
      abortRef.current = null;
    }

    if (newConversationId && newConversationId !== conversationId) {
      router.replace(`/ai/${newConversationId}`);
    } else if (usedTools) {
      router.refresh();
    }
  };

  // Câu hỏi gửi từ ô nhập nhanh (/ai?q=...)
  useEffect(() => {
    if (initialPrompt && ai.choice && !sentInitial.current) {
      sentInitial.current = true;
      void send(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, ai.choice]);

  const canSend = Boolean(input.trim() && ai.choice);

  const sidebarContent = (onClose?: () => void) => (
    <div className="flex h-full flex-col">
      {/* Đầu thanh bên: logo + nút thu gọn */}
      <div className="flex h-13 shrink-0 items-center justify-between px-4">
        <Link href="/ai" onClick={onClose} className="inline-flex items-center gap-2 text-[15px] font-semibold text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-[#2a85ff] via-[#6366f1] to-[#a855f7] text-white">
            <Sparkles size={13} />
          </span>
          Trợ lý AI
        </Link>
        <button
          type="button"
          onClick={() => (onClose ? onClose() : setSidebarOpen(false))}
          aria-label="Thu gọn danh sách cuộc trò chuyện"
          title="Thu gọn"
          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <PanelLeft size={16} />
        </button>
      </div>

      {/* Nút tạo cuộc trò chuyện mới & ô tìm kiếm */}
      <div className="space-y-1 px-3 pt-1 pb-2">
        <Link
          href="/ai"
          onClick={onClose}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-full px-3.5 py-2 text-[13.5px] font-medium transition-colors",
            !conversationId ? "bg-muted text-foreground" : "text-foreground/90 hover:bg-muted/80",
          )}
        >
          <SquarePen size={15} className="shrink-0 text-foreground/80" />
          <span>Cuộc trò chuyện mới</span>
        </Link>

        <div className="flex items-center gap-2.5 rounded-full px-3.5 py-2 text-[13px] text-muted-foreground transition-colors focus-within:bg-muted/80 hover:bg-muted/60">
          <Search size={15} className="shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm cuộc trò chuyện..."
            aria-label="Tìm kiếm cuộc trò chuyện"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none focus-visible:outline-none placeholder:text-muted-foreground"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Xóa từ khóa tìm kiếm"
              className="cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Danh sách cuộc trò chuyện gần đây */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-4">
        <div className="px-3 pb-1.5 text-xs font-medium text-muted-foreground">Gần đây</div>
        {filteredConversations.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            {search ? "Không tìm thấy cuộc trò chuyện nào." : "Chưa có cuộc trò chuyện nào."}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {filteredConversations.map((c) => {
              const isActive = c.id === conversationId;
              return (
                <li key={c.id}>
                  <Link
                    href={`/ai/${c.id}`}
                    onClick={onClose}
                    title={`${c.title} · ${formatDateTime(c.updatedAt)}`}
                    className={cn(
                      "block truncate rounded-full px-3 py-1.5 text-[13.5px] transition-colors",
                      isActive ? "bg-accent font-medium text-accent-foreground" : "text-foreground/85 hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    {c.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  const composer = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void send(input);
      }}
      className={cn(
        "relative w-full border border-border/80 bg-card transition-all focus-within:border-primary/40",
        isEmpty
          ? "max-w-[660px] shadow-[0_6px_28px_-6px_rgba(42,133,255,0.16),0_2px_10px_-2px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_32px_-8px_rgba(0,0,0,0.55)]"
          : "max-w-3xl shadow-[0_2px_14px_-4px_rgba(0,0,0,0.08)] dark:shadow-[0_6px_24px_-6px_rgba(0,0,0,0.45)]",
        isMultiline ? "rounded-[26px]" : "rounded-full",
      )}
    >
      <div className="flex items-end gap-1.5 px-2.5 py-2">
        {/* Nút + mở gợi ý nhanh */}
        <div ref={promptsRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setPromptsOpen((o) => !o)}
            aria-label="Gợi ý nhanh"
            aria-expanded={promptsOpen}
            title="Gợi ý nhanh"
            className={cn(
              "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-muted hover:text-foreground",
              promptsOpen && "bg-muted text-foreground",
            )}
          >
            <Plus size={19} className={cn("transition-transform", promptsOpen && "rotate-45")} />
          </button>

          {promptsOpen && (
            <div
              className={cn(
                "absolute left-0 z-30 w-80 max-w-[calc(100vw-3rem)] rounded-2xl border border-border bg-card p-1.5 shadow-xl",
                isEmpty ? "top-full mt-2" : "bottom-full mb-2",
              )}
            >
              <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Gợi ý nhanh
              </div>
              {SUGGESTIONS.map(({ text, icon: Icon }) => (
                <button
                  key={text}
                  type="button"
                  disabled={!ai.choice}
                  onClick={() => void send(text)}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon size={15} className="shrink-0 text-primary" />
                  <span className="leading-snug">{text}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ô nhập văn bản */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder="Hỏi Trợ lý AI"
          aria-label="Hỏi Trợ lý AI"
          className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-1 py-1.5 text-[15px] leading-6 text-foreground outline-none focus-visible:outline-none placeholder:text-muted-foreground"
        />

        {/* Bộ chọn model inline kiểu Gemini + nút gửi/dừng */}
        <div className="flex shrink-0 items-center gap-1 pb-0.5">
          <ModelPicker ai={ai} inline menuPosition={isEmpty ? "down" : "up"} />
          {streaming ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              aria-label="Dừng"
              title="Dừng"
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-foreground text-background transition-transform hover:opacity-90 active:scale-95"
            >
              <Square size={13} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Gửi"
              title="Gửi (Enter)"
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-full transition-all",
                canSend
                  ? "cursor-pointer bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover active:scale-95"
                  : "cursor-not-allowed text-muted-foreground/50",
              )}
            >
              <ArrowUp size={18} />
            </button>
          )}
        </div>
      </div>
    </form>
  );

  return (
    <div className="relative flex h-[calc(100vh-7.5rem)] min-h-[560px] w-full overflow-hidden rounded-3xl border border-border bg-card shadow-xs">
      {/* Thanh bên lịch sử cuộc trò chuyện (desktop) */}
      {sidebarOpen && (
        <aside className="hidden w-[256px] shrink-0 border-r border-border/80 bg-muted/25 lg:block">
          {sidebarContent()}
        </aside>
      )}

      {/* Thanh bên dạng ngăn kéo trên màn hình nhỏ */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Cuộc trò chuyện">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="relative z-10 h-full w-[272px] max-w-[85vw] border-r border-border bg-card shadow-2xl">
            {sidebarContent(() => setMobileSidebarOpen(false))}
          </aside>
        </div>
      )}

      {/* Khung trò chuyện chính kiểu Gemini */}
      <div className="relative flex min-w-0 flex-1 flex-col bg-card">
        {/* Vầng sáng xanh dương dịu ở trung tâm khi chưa có tin nhắn */}
        {isEmpty && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_52%,rgba(59,154,255,0.22)_0%,rgba(130,196,255,0.11)_30%,rgba(191,226,255,0.03)_54%,transparent_72%)] dark:bg-[radial-gradient(circle_at_50%_52%,rgba(42,133,255,0.18)_0%,rgba(99,102,241,0.07)_34%,transparent_68%)]"
          />
        )}

        {/* Thanh trên tối giản */}
        <header className="relative z-10 flex h-13 shrink-0 items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2">
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Mở danh sách cuộc trò chuyện"
                title="Mở danh sách"
                className="hidden h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:inline-flex"
              >
                <PanelLeft size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Mở danh sách cuộc trò chuyện"
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
            >
              <PanelLeft size={16} />
            </button>
            {conversationTitle && (
              <span className="truncate text-sm font-medium text-muted-foreground">{conversationTitle}</span>
            )}
          </div>

          {!isEmpty && (
            <Link
              href="/ai"
              title="Cuộc trò chuyện mới"
              aria-label="Cuộc trò chuyện mới"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <SquarePen size={16} />
            </Link>
          )}
        </header>

        {isEmpty ? (
          /* Trạng thái trống: tiêu đề + thanh nhập nổi căn giữa giữa nền vầng sáng */
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-16">
            <h1 className="mb-7 text-center text-2xl font-normal tracking-[-0.02em] text-foreground sm:text-[32px]">
              Chúng ta nên bắt đầu từ đâu nhỉ?
            </h1>
            {composer}
          </div>
        ) : (
          /* Trạng thái đang trò chuyện: danh sách tin nhắn + thanh nhập ghim dưới */
          <>
            <div className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-6">
              <div className="mx-auto w-full max-w-3xl space-y-6 py-4">
                {messages.map((m) =>
                  m.role === "user" ? (
                    <div key={m.id} className="flex justify-end">
                      <p className="max-w-[82%] whitespace-pre-wrap rounded-3xl rounded-tr-md bg-muted px-4 py-2.5 text-[14.5px] leading-relaxed text-foreground">
                        {m.content}
                      </p>
                    </div>
                  ) : (
                    <div key={m.id} className="flex items-start gap-3.5">
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2a85ff] via-[#6366f1] to-[#a855f7] text-white shadow-xs",
                          m.pending && "animate-pulse",
                        )}
                        aria-hidden="true"
                      >
                        <Sparkles size={15} />
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        {m.tools && m.tools.length > 0 && (
                          <ul className="mb-2.5 flex flex-wrap gap-1.5" aria-label="Công cụ trợ lý đã dùng">
                            {m.tools.map((t, i) => (
                              <li key={i}>
                                <ToolChip tool={t} />
                              </li>
                            ))}
                          </ul>
                        )}
                        {m.content ? (
                          <Markdown className="text-[14.5px]">{m.content}</Markdown>
                        ) : m.pending ? (
                          <p className="animate-pulse text-sm text-muted-foreground">
                            {m.tools?.length ? "Đang tổng hợp..." : "Đang suy nghĩ..."}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ),
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            <div className="relative z-10 flex justify-center px-4 pt-2 pb-4 sm:px-6">{composer}</div>
          </>
        )}
      </div>
    </div>
  );
}

function ToolChip({ tool }: { tool: ToolUse }) {
  const Icon = !tool.ok
    ? X
    : tool.name === "get_weather"
      ? CloudSun
      : tool.name === "web_search"
        ? Globe
        : tool.link
          ? Check
          : Wrench;
  const body = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 text-xs",
        tool.ok ? "text-muted-foreground" : "text-danger",
        tool.link && "hover:text-primary",
      )}
    >
      <Icon size={12} />
      {tool.label}
    </span>
  );
  return tool.link ? <Link href={tool.link}>{body}</Link> : body;
}
