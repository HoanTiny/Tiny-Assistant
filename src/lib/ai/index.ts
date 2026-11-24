/**
 * Lớp AI dùng chung cho toàn app.
 *
 *   streamAI()     → trả về ReadableStream văn bản (nút AI trên item, bản tin...)
 *   generateAI()   → trả về toàn bộ văn bản (job nền, đánh giá hàng loạt...)
 *   generateJSON() → bắt AI trả JSON rồi kiểm tra bằng zod (phân loại, trích xuất...)
 *   runAgent()     → AI được gọi các hàm của app (đọc/ghi dữ liệu) qua nhiều bước
 *
 * Mọi lần gọi đều tự ghi nhật ký vào bảng ai_calls (model, token, thời gian, lỗi).
 */
import "server-only";
import type { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { geminiProvider, geminiWebSearch } from "./providers/gemini";
import { openaiProvider } from "./providers/openai";
import type { AIProvider, ChatMessage, ProviderId, ProviderInfo, ToolCall, ToolSpec } from "./types";

export type { ChatMessage, ProviderId, ProviderInfo } from "./types";

const providers: Record<ProviderId, AIProvider> = {
  openai: openaiProvider,
  gemini: geminiProvider,
};

export function isProviderId(id: unknown): id is ProviderId {
  return typeof id === "string" && id in providers;
}

export function getProvider(id: ProviderId): AIProvider {
  return providers[id];
}

/**
 * Provider mặc định cho các việc chạy nền (không có lựa chọn từ giao diện):
 * AI_DEFAULT_PROVIDER nếu có, không thì hãng đầu tiên đã có API key.
 */
export function defaultProviderId(): ProviderId | null {
  const preferred = process.env.AI_DEFAULT_PROVIDER;
  if (isProviderId(preferred) && providers[preferred].isConfigured()) return preferred;
  return (Object.values(providers).find((p) => p.isConfigured())?.id as ProviderId | undefined) ?? null;
}

/** Chọn provider/model: dùng lựa chọn từ giao diện nếu hợp lệ, không thì mặc định */
export function resolveChoice(provider?: unknown, model?: unknown): { provider: ProviderId; model: string } | null {
  if (isProviderId(provider) && providers[provider].isConfigured()) {
    return { provider, model: typeof model === "string" && model ? model : providers[provider].defaultModel() };
  }
  const id = defaultProviderId();
  return id ? { provider: id, model: providers[id].defaultModel() } : null;
}

// Danh sách model ít thay đổi → nhớ tạm 10 phút để không gọi API của hãng liên tục
const modelCache = new Map<ProviderId, { at: number; models: string[] }>();
const MODEL_TTL = 10 * 60 * 1000;

export async function listProviders(): Promise<ProviderInfo[]> {
  return Promise.all(
    Object.values(providers).map(async (p) => {
      const configured = p.isConfigured();
      const defaultModel = p.defaultModel();
      let models: string[] = [];
      if (configured) {
        const cached = modelCache.get(p.id);
        if (cached && Date.now() - cached.at < MODEL_TTL) {
          models = cached.models;
        } else {
          try {
            models = await p.listModels();
            modelCache.set(p.id, { at: Date.now(), models });
          } catch (err) {
            console.error(`[ai] Không lấy được danh sách model của ${p.id}:`, err);
          }
        }
      }
      if (!models.includes(defaultModel)) models = [defaultModel, ...models];
      return { id: p.id, label: p.label, configured, defaultModel, models };
    }),
  );
}

type CallContext = {
  provider: ProviderId;
  model?: string;
  /** Tên tính năng để thống kê chi phí, ví dụ "chat", "item:evaluate" */
  feature: string;
  user: { id: string | null; workspaceId: string };
  signal?: AbortSignal;
};

type RunOptions = CallContext & { messages: ChatMessage[]; json?: boolean; fast?: boolean };

/** Dịch lỗi của hãng AI sang thông báo dễ hiểu */
export function describeAIError(err: unknown): string {
  const status = (err as { status?: number })?.status;
  const message = err instanceof Error ? err.message : String(err);
  if (status === 401 || status === 403 || (status === 400 && /api key not valid/i.test(message))) {
    return "API key không hợp lệ hoặc không có quyền.";
  }
  if (status === 429) return "Vượt giới hạn gọi hoặc hết hạn mức (quota) của tài khoản AI.";
  if (status === 404) return "Model không tồn tại hoặc tài khoản không được dùng model này.";
  return message.slice(0, 300);
}

async function logCall(
  ctx: CallContext & { model: string },
  result: { status: "ok" | "error" | "aborted"; inputTokens: number; outputTokens: number; startedAt: number; error?: string },
) {
  try {
    const db = await getDb();
    await db.insert(schema.aiCalls).values({
      workspaceId: ctx.user.workspaceId,
      userId: ctx.user.id,
      provider: ctx.provider,
      model: ctx.model,
      feature: ctx.feature,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      durationMs: Date.now() - result.startedAt,
      status: result.status,
      error: result.error,
    });
  } catch (err) {
    console.error("[ai] Không ghi được nhật ký ai_calls:", err);
  }
}

function requireConfigured(id: ProviderId): AIProvider {
  const provider = getProvider(id);
  if (!provider.isConfigured()) {
    throw new Error(`Chưa cấu hình API key cho ${provider.label}. Thêm vào file .env.local rồi khởi động lại.`);
  }
  return provider;
}

async function* run(opts: RunOptions & { model: string }) {
  const provider = requireConfigured(opts.provider);
  const startedAt = Date.now();
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    for await (const ev of provider.stream({
      model: opts.model,
      messages: opts.messages,
      json: opts.json,
      fast: opts.fast,
      signal: opts.signal,
    })) {
      if (ev.type === "usage") {
        inputTokens = ev.inputTokens;
        outputTokens = ev.outputTokens;
      } else {
        yield ev.text;
      }
    }
    await logCall(opts, { status: "ok", inputTokens, outputTokens, startedAt });
  } catch (err) {
    const aborted = opts.signal?.aborted;
    await logCall(opts, {
      status: aborted ? "aborted" : "error",
      inputTokens,
      outputTokens,
      startedAt,
      error: aborted ? undefined : describeAIError(err),
    });
    throw err;
  }
}

/**
 * Stream văn bản về trình duyệt. Nếu lỗi giữa chừng, đoạn cuối stream sẽ là
 * dòng "⚠️ Lỗi AI: ..." để người dùng thấy ngay.
 */
export function streamAI(
  opts: RunOptions & { onFinish?: (fullText: string) => Promise<void> | void },
): ReadableStream<Uint8Array> {
  const model = opts.model || getProvider(opts.provider).defaultModel();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        for await (const text of run({ ...opts, model })) {
          full += text;
          controller.enqueue(encoder.encode(text));
        }
        await opts.onFinish?.(full);
      } catch (err) {
        if (!opts.signal?.aborted) {
          controller.enqueue(encoder.encode(`${full ? "\n\n" : ""}⚠️ Lỗi AI: ${describeAIError(err)}`));
        }
      } finally {
        controller.close();
      }
    },
  });
}

/** Gọi AI và chờ lấy toàn bộ kết quả (không stream) */
export async function generateAI(opts: RunOptions): Promise<string> {
  const model = opts.model || getProvider(opts.provider).defaultModel();
  let full = "";
  for await (const text of run({ ...opts, model })) full += text;
  return full;
}

/** Bắt AI trả về JSON, kiểm tra đúng cấu trúc bằng zod. Lỗi cấu trúc → ném lỗi. */
export async function generateJSON<T>(opts: Omit<RunOptions, "json">, shape: z.ZodType<T>): Promise<T> {
  const text = await generateAI({ ...opts, json: true });
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return shape.parse(JSON.parse(cleaned));
}

// ───────────────────────── Agent: AI gọi hàm của app ─────────────────────────

export function canWebSearch(): boolean {
  return geminiProvider.isConfigured();
}

/** Tra cứu web thời gian thực qua Gemini Google Search Grounding (có ghi nhật ký ai_calls) */
export async function webSearch(
  query: string,
  user: { id: string | null; workspaceId: string },
  signal?: AbortSignal,
): Promise<{ answer: string; sources: { title: string; url: string }[] }> {
  if (!geminiProvider.isConfigured()) {
    throw new Error("Chưa cấu hình GEMINI_API_KEY để bật tìm kiếm web.");
  }
  const startedAt = Date.now();
  const fallbackModel = process.env.GEMINI_SEARCH_MODEL || geminiProvider.defaultModel();
  try {
    const res = await geminiWebSearch(query, signal);
    await logCall(
      { provider: "gemini", model: res.model, feature: "tool:web_search", user, signal },
      { status: "ok", inputTokens: res.inputTokens, outputTokens: res.outputTokens, startedAt },
    );
    return { answer: res.answer, sources: res.sources };
  } catch (err) {
    const aborted = signal?.aborted;
    await logCall(
      { provider: "gemini", model: fallbackModel, feature: "tool:web_search", user, signal },
      {
        status: aborted ? "aborted" : "error",
        inputTokens: 0,
        outputTokens: 0,
        startedAt,
        error: aborted ? undefined : describeAIError(err),
      },
    );
    throw err;
  }
}

export type AgentTool = ToolSpec & {
  /** Mô tả ngắn hiện cho người dùng khi AI đang dùng công cụ, ví dụ "Đang tìm công việc" */
  label: (args: Record<string, unknown>) => string;
  run: (args: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>;
};

export type AgentEvent =
  | { type: "tool"; name: string; label: string; ok: boolean; link?: string }
  | { type: "text"; text: string };

/**
 * Vòng lặp agent: AI trả lời hoặc gọi công cụ → chạy công cụ → gửi kết quả lại → lặp,
 * tối đa `maxSteps` lượt. Trả về câu trả lời cuối cùng.
 */
export async function runAgent(
  opts: CallContext & {
    messages: ChatMessage[];
    tools: AgentTool[];
    maxSteps?: number;
    onEvent?: (ev: AgentEvent) => void;
  },
): Promise<string> {
  const provider = requireConfigured(opts.provider);
  const model = opts.model || provider.defaultModel();
  const ctx = { ...opts, model };
  const session = provider.createAgent({
    model,
    messages: opts.messages,
    tools: opts.tools.map(({ name, description, parameters }) => ({ name, description, parameters })),
  });
  const maxSteps = opts.maxSteps ?? 8;

  for (let i = 0; i < maxSteps; i++) {
    const startedAt = Date.now();
    let step;
    try {
      step = await session.step(opts.signal);
      await logCall(ctx, { status: "ok", inputTokens: step.inputTokens, outputTokens: step.outputTokens, startedAt });
    } catch (err) {
      const aborted = opts.signal?.aborted;
      await logCall(ctx, {
        status: aborted ? "aborted" : "error",
        inputTokens: 0,
        outputTokens: 0,
        startedAt,
        error: aborted ? undefined : describeAIError(err),
      });
      throw err;
    }

    if (step.toolCalls.length === 0) return step.text;

    const results: { call: ToolCall; result: unknown }[] = [];
    for (const call of step.toolCalls) {
      const tool = opts.tools.find((t) => t.name === call.name);
      if (!tool) {
        results.push({ call, result: { error: `Không có công cụ ${call.name}` } });
        continue;
      }
      try {
        const result = await tool.run(call.args, opts.signal);
        const link = (result as { link?: string } | null)?.link;
        opts.onEvent?.({ type: "tool", name: call.name, label: tool.label(call.args), ok: true, link });
        results.push({ call, result });
      } catch (err) {
        opts.onEvent?.({ type: "tool", name: call.name, label: tool.label(call.args), ok: false });
        results.push({ call, result: { error: err instanceof Error ? err.message : String(err) } });
      }
    }
    session.addToolResults(results);
  }
  return "Mình đã dùng hết số bước cho phép mà chưa xong. Bạn thử chia nhỏ yêu cầu nhé.";
}
