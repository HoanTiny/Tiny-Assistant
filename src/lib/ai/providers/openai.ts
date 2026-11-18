import "server-only";
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type { AIProvider, ToolCall } from "../types";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

// Bỏ các model không dùng cho chat văn bản
const NON_CHAT = /(audio|realtime|live|tts|transcribe|whisper|dall-e|image|embedding|moderation|search|computer-use|instruct|codex|babbage|davinci)/i;
// Bản chụp có ngày (gpt-5-2025-08-07...) trùng với tên gốc → ẩn cho gọn
const SNAPSHOT = /-\d{4}-\d{2}-\d{2}$/;

/** Model có "suy nghĩ" (reasoning) và cho chỉnh mức suy nghĩ */
const isReasoning = (model: string) => /^(gpt-5|gpt-6|o\d)/.test(model) && !/-pro\b/.test(model);

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

export const openaiProvider: AIProvider = {
  id: "openai",
  label: "OpenAI",

  isConfigured: () => Boolean(process.env.OPENAI_API_KEY),

  defaultModel: () => process.env.OPENAI_DEFAULT_MODEL || "gpt-5-mini",

  async listModels() {
    const ids: string[] = [];
    for await (const m of getClient().models.list()) {
      if (/^(gpt-|o\d|chatgpt-)/.test(m.id) && !NON_CHAT.test(m.id) && !SNAPSHOT.test(m.id)) ids.push(m.id);
    }
    return ids.sort().reverse();
  },

  async *stream({ model, messages, json, fast, signal }) {
    const stream = await getClient().chat.completions.create(
      {
        model,
        messages,
        stream: true,
        stream_options: { include_usage: true },
        ...(json ? { response_format: { type: "json_object" as const } } : {}),
        ...(fast && isReasoning(model) ? { reasoning_effort: "low" as const } : {}),
      },
      { signal },
    );

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) yield { type: "text", text };
      if (chunk.usage) {
        yield {
          type: "usage",
          inputTokens: chunk.usage.prompt_tokens ?? 0,
          outputTokens: chunk.usage.completion_tokens ?? 0,
        };
      }
    }
  },

  createAgent({ model, messages, tools }) {
    const history: ChatCompletionMessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));
    const oaTools: ChatCompletionTool[] = tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

    return {
      async step(signal) {
        const res = await getClient().chat.completions.create({ model, messages: history, tools: oaTools }, { signal });
        const msg = res.choices[0]?.message;
        const toolCalls: ToolCall[] = [];
        for (const tc of msg?.tool_calls ?? []) {
          if (tc.type === "function") {
            toolCalls.push({ id: tc.id, name: tc.function.name, args: parseArgs(tc.function.arguments) });
          }
        }
        // Lưu lại đúng lượt trả lời (kể cả yêu cầu gọi hàm) để gửi kèm ở bước sau
        history.push({ role: "assistant", content: msg?.content ?? null, tool_calls: msg?.tool_calls });
        return {
          text: msg?.content ?? "",
          toolCalls,
          inputTokens: res.usage?.prompt_tokens ?? 0,
          outputTokens: res.usage?.completion_tokens ?? 0,
        };
      },
      addToolResults(results) {
        for (const r of results) {
          history.push({ role: "tool", tool_call_id: r.call.id, content: JSON.stringify(r.result) });
        }
      },
    };
  },
};
