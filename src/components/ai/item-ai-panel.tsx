"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  AlignLeft,
  Check,
  ClipboardCheck,
  Copy,
  ListChecks,
  Loader2,
  NotebookPen,
  Plus,
  Sparkles,
  Square,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { saveAiResultAsNote } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";
import { ModelPicker } from "./model-picker";
import { useAIModels, useTextStream } from "./use-ai";

export type ItemActionOption = { key: string; label: string; description: string };

const ACTION_STYLE: Record<string, { icon: LucideIcon; tint: string }> = {
  evaluate: {
    icon: ClipboardCheck,
    tint: "bg-sky-500/12 text-[#2a85ff] dark:bg-sky-400/15 dark:text-sky-300",
  },
  summarize: {
    icon: AlignLeft,
    tint: "bg-violet-500/12 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300",
  },
  breakdown: {
    icon: ListChecks,
    tint: "bg-emerald-500/12 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300",
  },
  improve: {
    icon: WandSparkles,
    tint: "bg-amber-500/12 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300",
  },
};

/** Khung Trợ lý AI tinh gọn bên phải trang chi tiết */
export function ItemAIPanel({ itemId, actions }: { itemId: string; actions: ItemActionOption[] }) {
  const ai = useAIModels();
  const { start, stop, streaming } = useTextStream();
  const [output, setOutput] = useState("");
  const [current, setCurrent] = useState<ItemActionOption | null>(null);
  const [copied, setCopied] = useState(false);
  const [inserted, setInserted] = useState(false);
  const [saving, startSaving] = useTransition();
  const router = useRouter();

  const run = (action: ItemActionOption) => {
    if (!ai.choice) return;
    setCurrent(action);
    setOutput("");
    setInserted(false);
    void start("/api/ai/item-action", { itemId, action: action.key, ...ai.choice }, setOutput);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const insertIntoEditor = () => {
    window.dispatchEvent(new CustomEvent("wh:item-append", { detail: { itemId, text: output } }));
    setInserted(true);
    setTimeout(() => setInserted(false), 2000);
  };

  const saveAsNote = () =>
    startSaving(async () => {
      if (!current) return;
      const noteId = await saveAiResultAsNote(itemId, current.label, output);
      if (noteId) router.push(`/items/${noteId}`);
    });

  return (
    <Card className="p-5">
      {/* Đầu thẻ tối giản: tên + bộ chọn model */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#2a85ff] via-[#6366f1] to-[#a855f7] text-white"
            aria-hidden="true"
          >
            <Sparkles size={14} />
          </span>
          <h2 className="text-sm font-bold text-foreground">Trợ lý AI</h2>
        </div>
        <ModelPicker ai={ai} inline menuPosition="down" />
      </div>

      {/* Lưới 2×2 chỉ giữ icon + nhãn chính cho thoáng mắt */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {actions.map((a) => {
          const style = ACTION_STYLE[a.key] ?? { icon: Sparkles, tint: "bg-accent text-accent-foreground" };
          const Icon = style.icon;
          const running = streaming && current?.key === a.key;
          const isSelected = !streaming && current?.key === a.key && Boolean(output);

          return (
            <button
              key={a.key}
              type="button"
              disabled={!ai.choice || streaming}
              onClick={() => run(a)}
              title={a.description}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all",
                "hover:border-primary/40 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60",
                running
                  ? "border-primary bg-accent/50"
                  : isSelected
                    ? "border-primary/40 bg-accent/30"
                    : "border-border/80 bg-muted/20",
              )}
            >
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", style.tint)} aria-hidden="true">
                {running ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
              </span>
              <span className="truncate text-xs font-semibold text-foreground">{a.label}</span>
            </button>
          );
        })}
      </div>

      {/* Chỉ hiện phần kết quả khi có chạy AI */}
      {(output || streaming) && (
        <div className="mt-4 border-t border-border/70 pt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-muted-foreground">{current?.label}</span>
            {streaming ? (
              <button
                type="button"
                onClick={stop}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold text-background hover:opacity-90"
              >
                <Square size={10} fill="currentColor" /> Dừng
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={insertIntoEditor}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground transition-colors hover:bg-primary hover:text-white"
                >
                  {inserted ? <Check size={12} /> : <Plus size={12} />}
                  {inserted ? "Đã chèn" : "Chèn vào mô tả"}
                </button>
                <button
                  type="button"
                  onClick={copy}
                  title="Sao chép"
                  className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                </button>
                <button
                  type="button"
                  onClick={saveAsNote}
                  disabled={saving}
                  title="Lưu thành ghi chú liên kết"
                  className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <NotebookPen size={12} />
                </button>
              </div>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto rounded-xl bg-muted/30 p-3.5">
            {output ? (
              <Markdown className="text-[13.5px]">{output}</Markdown>
            ) : (
              <p className="animate-pulse text-xs text-muted-foreground">AI đang xử lý...</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
