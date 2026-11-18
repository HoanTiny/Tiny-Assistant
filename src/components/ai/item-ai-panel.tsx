"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Copy, NotebookPen, Sparkles, Square } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { saveAiResultAsNote } from "@/app/(app)/actions";
import { ModelPicker } from "./model-picker";
import { useAIModels, useTextStream } from "./use-ai";

export type ItemActionOption = { key: string; label: string; description: string };

/** Bảng AI gắn trên trang chi tiết item: đánh giá, tóm tắt, chia nhỏ việc... */
export function ItemAIPanel({ itemId, actions }: { itemId: string; actions: ItemActionOption[] }) {
  const ai = useAIModels();
  const { start, stop, streaming } = useTextStream();
  const [output, setOutput] = useState("");
  const [current, setCurrent] = useState<ItemActionOption | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, startSaving] = useTransition();
  const router = useRouter();

  const run = (action: ItemActionOption) => {
    if (!ai.choice) return;
    setCurrent(action);
    setOutput("");
    void start("/api/ai/item-action", { itemId, action: action.key, ...ai.choice }, setOutput);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const saveAsNote = () =>
    startSaving(async () => {
      if (!current) return;
      const noteId = await saveAiResultAsNote(itemId, current.label, output);
      if (noteId) router.push(`/items/${noteId}`);
    });

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2 font-medium">
        <Sparkles size={16} className="text-primary" /> AI hỗ trợ
      </div>
      <ModelPicker ai={ai} />
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button
            key={a.key}
            variant="secondary"
            size="sm"
            title={a.description}
            disabled={!ai.choice || streaming}
            onClick={() => run(a)}
          >
            {a.label}
          </Button>
        ))}
      </div>

      {(output || streaming) && (
        <div className="mt-4 border-t pt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{current?.label}</span>
            <div className="flex gap-1">
              {streaming ? (
                <Button variant="ghost" size="sm" onClick={stop}>
                  <Square size={14} /> Dừng
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={copy}>
                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Đã chép" : "Chép"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={saveAsNote} disabled={saving}>
                    <NotebookPen size={14} /> {saving ? "Đang lưu..." : "Lưu thành ghi chú"}
                  </Button>
                </>
              )}
            </div>
          </div>
          {output ? (
            <Markdown>{output}</Markdown>
          ) : (
            <p className="animate-pulse text-sm text-muted-foreground">AI đang suy nghĩ...</p>
          )}
        </div>
      )}
    </Card>
  );
}
