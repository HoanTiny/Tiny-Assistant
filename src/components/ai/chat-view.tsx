"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Square, Wrench, X } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";
import { ModelPicker } from "./model-picker";
import { useAIModels } from "./use-ai";

type ToolUse = { label: string; ok: boolean; link?: string };

export type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  tools?: ToolUse[];
  pending?: boolean;
};

const SUGGESTIONS = [
  "Hôm nay tôi nên làm gì trước?",
  "Tuần này tôi có việc nào trễ hạn không?",
  "Lên kế hoạch cho ngày mai giúp tôi",
  "Tạo việc: gọi điện cho khách hàng vào thứ 6",
];

export function ChatView({
  conversationId,
  initialMessages,
  initialPrompt,
}: {
  conversationId?: string;
  initialMessages: ChatMsg[];
  initialPrompt?: string;
}) {
  const ai = useAIModels();
  const [messages, setMessages] = useState<ChatMsg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const sentInitial = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || streaming || !ai.choice) return;
    setInput("");
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
            patch((msg) => ({ ...msg, tools: [...(msg.tools ?? []), { label: ev.label, ok: ev.ok, link: ev.link }] }));
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

  return (
    <div className="flex h-[calc(100vh-10rem)] min-h-[420px] flex-col rounded-xl border bg-card">
      <div className="border-b p-3">
        <ModelPicker ai={ai} />
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="mx-auto mt-8 max-w-md text-center text-sm text-muted-foreground">
            <p className="mb-1 text-base font-medium text-foreground">Trợ lý xem được công việc và ghi chú của bạn</p>
            <p>Hỏi về kế hoạch, nhờ tạo việc, đánh dấu xong, tóm tắt ghi chú...</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!ai.choice}
                  onClick={() => void send(s)}
                  className="rounded-full border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5",
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              {m.tools && m.tools.length > 0 && (
                <ul className="mb-2 flex flex-wrap gap-1.5">
                  {m.tools.map((t, i) => (
                    <li key={i}>
                      <ToolChip tool={t} />
                    </li>
                  ))}
                </ul>
              )}
              {m.role === "user" ? (
                <p className="whitespace-pre-wrap text-sm">{m.content}</p>
              ) : m.content ? (
                <Markdown>{m.content}</Markdown>
              ) : m.pending ? (
                <p className="animate-pulse text-sm text-muted-foreground">
                  {m.tools?.length ? "Đang tổng hợp..." : "Đang suy nghĩ..."}
                </p>
              ) : null}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex items-end gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <Textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder="Nhập tin nhắn... (Enter để gửi, Shift+Enter xuống dòng)"
          className="resize-none"
          aria-label="Tin nhắn"
        />
        {streaming ? (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={() => abortRef.current?.abort()}
            aria-label="Dừng"
          >
            <Square size={16} />
          </Button>
        ) : (
          <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={!input.trim() || !ai.choice} aria-label="Gửi">
            <ArrowUp size={18} />
          </Button>
        )}
      </form>
    </div>
  );
}

function ToolChip({ tool }: { tool: ToolUse }) {
  const Icon = tool.ok ? (tool.link ? Check : Wrench) : X;
  const body = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border bg-card px-2 py-0.5 text-xs",
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
