"use client";

import Link from "next/link";
import { Select } from "@/components/ui";
import type { useAIModels } from "./use-ai";

/** Chọn hãng AI + model. Dùng chung cho chat và các nút AI. */
export function ModelPicker({ ai }: { ai: ReturnType<typeof useAIModels> }) {
  const { providers, choice, setChoice, error, hasConfigured, loading } = ai;

  if (loading) return <div className="h-10 w-64 animate-pulse rounded-lg bg-muted" />;
  if (error) return <p className="text-sm text-danger">Không tải được danh sách model: {error}</p>;
  if (!hasConfigured || !choice || !providers) {
    return (
      <p className="text-sm text-warning">
        Chưa có API key nào. Thêm <code>OPENAI_API_KEY</code> hoặc <code>GEMINI_API_KEY</code> vào <code>.env.local</code>{" "}
        rồi khởi động lại app. <Link href="/settings" className="underline">Xem cài đặt</Link>
      </p>
    );
  }

  const current = providers.find((p) => p.id === choice.provider);
  return (
    <div className="flex flex-wrap gap-2">
      <Select
        aria-label="Hãng AI"
        className="w-auto"
        value={choice.provider}
        onChange={(e) => {
          const p = providers.find((x) => x.id === e.target.value);
          if (p) setChoice({ provider: p.id, model: p.defaultModel });
        }}
      >
        {providers.map((p) => (
          <option key={p.id} value={p.id} disabled={!p.configured}>
            {p.label}
            {p.configured ? "" : " (chưa có key)"}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Model"
        className="w-auto max-w-64"
        value={choice.model}
        onChange={(e) => setChoice({ provider: choice.provider, model: e.target.value })}
      >
        {(current?.models ?? [choice.model]).map((m) => (
          <option key={m} value={m}>
            {m}
            {m === current?.defaultModel ? " (mặc định)" : ""}
          </option>
        ))}
      </Select>
    </div>
  );
}
