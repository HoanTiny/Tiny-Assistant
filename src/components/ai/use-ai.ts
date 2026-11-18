"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProviderInfo } from "@/lib/ai/types";

const STORAGE_KEY = "wh_ai_choice";

type Choice = { provider: string; model: string };

export function readChoice(): Choice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Choice) : null;
  } catch {
    return null;
  }
}

/** Danh sách hãng/model AI + lựa chọn hiện tại (nhớ trong trình duyệt) */
export function useAIModels() {
  const [providers, setProviders] = useState<ProviderInfo[] | null>(null);
  const [choice, setChoiceState] = useState<Choice | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/models")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(({ providers }: { providers: ProviderInfo[] }) => {
        if (cancelled) return;
        setProviders(providers);
        const saved = readChoice();
        const configured = providers.filter((p) => p.configured);
        const savedProvider = configured.find((p) => p.id === saved?.provider);
        if (savedProvider && saved) {
          setChoiceState({ provider: savedProvider.id, model: saved.model || savedProvider.defaultModel });
        } else if (configured[0]) {
          setChoiceState({ provider: configured[0].id, model: configured[0].defaultModel });
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const setChoice = useCallback((next: Choice) => {
    setChoiceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* trình duyệt chặn localStorage: bỏ qua */
    }
  }, []);

  const hasConfigured = providers?.some((p) => p.configured) ?? false;
  return { providers, choice, setChoice, error, hasConfigured, loading: providers === null && !error };
}

/** Gọi một endpoint AI dạng stream văn bản, trả từng đoạn qua onChunk */
export function useTextStream() {
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (url: string, body: unknown, onChunk: (fullText: string) => void): Promise<{ text: string; headers: Headers } | null> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming(true);
      let full = "";
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          full = `⚠️ ${err.error ?? "Có lỗi xảy ra"}`;
          onChunk(full);
          return { text: full, headers: res.headers };
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          onChunk(full);
        }
        return { text: full, headers: res.headers };
      } catch (e) {
        if ((e as Error).name === "AbortError") return { text: full, headers: new Headers() };
        onChunk(`${full}\n\n⚠️ Mất kết nối: ${(e as Error).message}`);
        return null;
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setStreaming(false);
      }
    },
    [],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { start, stop, streaming };
}
