"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { useAIModels } from "./use-ai";

/** Chọn hãng AI + model. Dùng chung cho chat (inline kiểu Gemini) và các nút AI. */
export function ModelPicker({
  ai,
  inline = false,
  menuPosition = "down",
}: {
  ai: ReturnType<typeof useAIModels>;
  inline?: boolean;
  menuPosition?: "up" | "down";
}) {
  const { providers, choice, setChoice, error, hasConfigured, loading } = ai;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (inline) {
    if (loading) return <div className="h-7 w-20 animate-pulse rounded-full bg-muted" />;
    if (error) return <span className="px-2 text-xs text-danger">Lỗi model</span>;
    if (!hasConfigured || !choice || !providers) {
      return (
        <Link
          href="/settings"
          className="inline-flex h-8 shrink-0 items-center rounded-full px-2.5 text-xs font-medium text-warning hover:bg-muted"
        >
          Thêm API key
        </Link>
      );
    }

    return (
      <div ref={wrapRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label="Chọn model AI"
          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <span className="max-w-32 truncate">{choice.model}</span>
          <ChevronDown size={14} className={cn("shrink-0 transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <div
            role="listbox"
            className={cn(
              "absolute right-0 z-30 w-64 overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-xl",
              menuPosition === "up" ? "bottom-full mb-2" : "top-full mt-2",
            )}
          >
            <div className="max-h-72 overflow-y-auto">
              {providers.map((p, idx) => (
                <div key={p.id} className={cn(idx > 0 && "mt-1 border-t border-border/70 pt-1")}>
                  <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span>{p.label}</span>
                    {!p.configured && <span className="normal-case font-normal">Chưa có key</span>}
                  </div>
                  {(p.configured ? p.models : [p.defaultModel]).map((m) => {
                    const selected = choice.provider === p.id && choice.model === m;
                    return (
                      <button
                        key={`${p.id}:${m}`}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        disabled={!p.configured}
                        onClick={() => {
                          setChoice({ provider: p.id, model: m });
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] transition-colors",
                          !p.configured
                            ? "cursor-not-allowed text-muted-foreground/50"
                            : selected
                              ? "cursor-pointer bg-accent font-semibold text-accent-foreground"
                              : "cursor-pointer text-foreground hover:bg-muted",
                        )}
                      >
                        <span className="min-w-0 truncate">
                          {m}
                          {m === p.defaultModel && <span className="ml-1 text-[11px] font-normal text-muted-foreground">· mặc định</span>}
                        </span>
                        {selected && <Check size={14} className="shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

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
