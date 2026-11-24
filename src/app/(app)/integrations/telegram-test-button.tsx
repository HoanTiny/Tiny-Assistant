"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { sendTelegramTest } from "./actions";

export function TelegramTestButton({ integrationId }: { integrationId: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      {result?.ok && <span className="text-xs font-semibold text-success">Đã gửi</span>}
      {result?.error && <span className="max-w-48 truncate text-xs font-semibold text-danger">{result.error}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await sendTelegramTest(integrationId)))}
        className={buttonClass("secondary", "xs")}
      >
        <Send size={13} /> {pending ? "Đang gửi..." : "Gửi thử"}
      </button>
    </span>
  );
}
