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
import { Markdown } from "@/components/markdown";
import { saveAiResultAsNote } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";
import { ModelPicker } from "./model-picker";
import { useAIModels, useTextStream } from "./use-ai";

export type ItemActionOption = { key: string; label: string; description: string };

const ACTION_STYLE: Record<string, { icon: LucideIcon; tint: string; short: string }> = {
  evaluate: {
    icon: ClipboardCheck,
    tint: "bg-sky-500/12 text-[#2a85ff] dark:bg-sky-400/15 dark:text-sky-300",
    short: "Chấm điểm & rủi ro",
  },
  summarize: {
    icon: AlignLeft,
    tint: "bg-violet-500/12 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300",
    short: "Rút gọn 5 ý chính",
  },
  breakdown: {
    icon: ListChecks,
    tint: "bg-emerald-500/12 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300",
    short: "Tạo checklist từng bước",
  },
  improve: {
    icon: WandSparkles,
    tint: "bg-amber-500/12 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300",
    short: "Viết mạch lạc hơn",
  },
};

/** AI Copilot Studio trên trang chi tiết: chạy tác vụ nhanh, chèn thẳng vào mô tả hoặc lưu ghi chú */
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
    <div className="relative rounded-3xl border border-border/80 bg-card shadow-[0_2px_20px_-8px_rgba(0,0,0,0.07)] dark:shadow-[0_8px_32px_-12px_rgba(0,0,0,0.45)]">
      {/* Vầng sáng dịu kiểu Gemini ở đầu thẻ (clip riêng để không cắt menu chọn model) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
        <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(ellipse_80%_75%_at_50%_0%,rgba(42,133,255,0.12)_0%,rgba(139,92,246,0.06)_48%,transparent_80%)] dark:bg-[radial-gradient(ellipse_80%_75%_at_50%_0%,rgba(42,133,255,0.16)_0%,rgba(139,92,246,0.08)_48%,transparent_80%)]" />
      </div>

      <div className="relative p-5">
        {/* Đầu thẻ: biểu tượng AI + bộ chọn model inline */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2a85ff] via-[#6366f1] to-[#a855f7] text-white shadow-xs"
              aria-hidden="true"
            >
              <Sparkles size={15} />
            </span>
            <div>
              <h2 className="text-[15px] font-bold leading-tight text-foreground">Trợ lý AI</h2>
              <p className="text-[11.5px] text-muted-foreground">Phân tích & gợi ý theo mục này</p>
            </div>
          </div>
          <ModelPicker ai={ai} inline menuPosition="down" />
        </div>

        {/* Lưới 2×2 thẻ tác vụ nhanh gọn gàng */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {actions.map((a) => {
            const style = ACTION_STYLE[a.key] ?? {
              icon: Sparkles,
              tint: "bg-accent text-accent-foreground",
              short: a.description,
            };
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
                  "group flex cursor-pointer flex-col items-start rounded-2xl border p-3 text-left transition-all",
                  "hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/40 hover:shadow-xs",
                  "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none",
                  running
                    ? "border-primary bg-accent/50 shadow-xs"
                    : isSelected
                      ? "border-primary/40 bg-accent/30"
                      : "border-border/75 bg-background/50",
                )}
              >
                <span
                  className={cn(
                    "mb-2.5 flex h-8 w-8 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
                    style.tint,
                  )}
                  aria-hidden="true"
                >
                  {running ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
                </span>
                <span className="text-[13.5px] font-bold leading-snug text-foreground">{a.label}</span>
                <span className="mt-0.5 line-clamp-1 text-[11.5px] text-muted-foreground">{style.short}</span>
              </button>
            );
          })}
        </div>

        {/* Khu vực kết quả hoặc ghi chú hướng dẫn tinh tế */}
        {output || streaming ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-border/80 bg-muted/25">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-muted/35 px-3.5 py-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Sparkles size={12} className="text-primary" />
                {current?.label}
              </span>
              {streaming ? (
                <button
                  type="button"
                  onClick={stop}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold text-background hover:opacity-90"
                >
                  <Square size={10} fill="currentColor" /> Dừng
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={insertIntoEditor}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-primary/12 px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
                  >
                    {inserted ? <Check size={12} /> : <Plus size={12} />}
                    {inserted ? "Đã chèn" : "Chèn vào mô tả"}
                  </button>
                  <button
                    type="button"
                    onClick={copy}
                    title="Sao chép"
                    className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                  >
                    {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                  </button>
                  <button
                    type="button"
                    onClick={saveAsNote}
                    disabled={saving}
                    title="Lưu thành ghi chú liên kết"
                    className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground disabled:opacity-50"
                  >
                    <NotebookPen size={12} />
                  </button>
                </div>
              )}
            </div>
            <div className="max-h-[420px] overflow-y-auto p-4">
              {output ? (
                <Markdown className="text-[13.5px]">{output}</Markdown>
              ) : (
                <p className="animate-pulse text-xs text-muted-foreground">AI đang phân tích mục này...</p>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-4 rounded-2xl bg-muted/35 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
            Nội dung gốc không bị tự động thay đổi. Khi AI trả lời xong, bạn có thể bấm{" "}
            <strong className="text-foreground">Chèn vào mô tả</strong> hoặc lưu thành ghi chú riêng.
          </p>
        )}
      </div>
    </div>
  );
}
