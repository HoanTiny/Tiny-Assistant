"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw, Sparkles, Square } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { readChoice, useTextStream } from "@/components/ai/use-ai";
import { formatDateTime } from "@/lib/utils";

/** Một khung bản tin: hiện bản đã có, hoặc tạo / tạo lại bằng AI (stream) */
export function BriefPanel({
  kind,
  title,
  description,
  existing,
  aiReady,
}: {
  kind: "daily" | "weekly";
  title: string;
  description: string;
  existing: { id: string; content: string; updatedAt: string } | null;
  aiReady: boolean;
}) {
  const { start, stop, streaming } = useTextStream();
  const [output, setOutput] = useState<string | null>(null);
  const router = useRouter();

  const generate = async () => {
    setOutput("");
    await start("/api/ai/brief", { kind, ...readChoice() }, setOutput);
    router.refresh();
  };

  const content = output ?? existing?.content ?? "";

  return (
    <Card className="flex flex-col p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">
            {existing && output === null ? `Tạo lúc ${formatDateTime(existing.updatedAt)}` : description}
          </p>
        </div>
        {streaming ? (
          <Button variant="secondary" size="sm" onClick={stop}>
            <Square size={14} /> Dừng
          </Button>
        ) : (
          <Button variant={existing ? "secondary" : "primary"} size="sm" onClick={generate} disabled={!aiReady}>
            {existing ? <RefreshCw size={14} /> : <Sparkles size={14} />}
            {existing ? "Tạo lại" : "Tạo ngay"}
          </Button>
        )}
      </div>

      {content ? (
        <Markdown>{content}</Markdown>
      ) : streaming ? (
        <p className="animate-pulse text-sm text-muted-foreground">AI đang đọc công việc của bạn...</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {aiReady ? "Chưa có. Bấm “Tạo ngay” hoặc đợi app tự tạo theo lịch." : "Cần thêm API key AI vào .env.local để dùng tính năng này."}
        </p>
      )}

      {existing && output === null && (
        <Link href={`/items/${existing.id}`} className="mt-4 text-xs text-muted-foreground hover:text-primary">
          Mở để sửa hoặc dùng nút AI →
        </Link>
      )}
    </Card>
  );
}
