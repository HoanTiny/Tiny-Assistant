import "server-only";
import { GoogleGenAI, type Content, type GenerateContentConfig } from "@google/genai";
import type { AIProvider, ChatMessage, ToolCall } from "../types";

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  // v1beta: bản API hỗ trợ đầy đủ system instruction, JSON mode, function calling
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, apiVersion: "v1beta" });
  return client;
}

/** Gemini tách riêng system instruction; vai "assistant" gọi là "model" */
function toGemini(messages: ChatMessage[]): { systemInstruction?: string; contents: Content[] } {
  const systemInstruction = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const contents: Content[] = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  return { systemInstruction: systemInstruction || undefined, contents };
}

export const geminiProvider: AIProvider = {
  id: "gemini",
  label: "Google Gemini",

  isConfigured: () => Boolean(process.env.GEMINI_API_KEY),

  defaultModel: () => process.env.GEMINI_DEFAULT_MODEL || "gemini-2.5-flash",

  async listModels() {
    const ids: string[] = [];
    const pager = await getClient().models.list();
    for await (const m of pager) {
      const id = m.name?.replace(/^models\//, "");
      if (!id || !id.startsWith("gemini")) continue;
      if (m.supportedActions && !m.supportedActions.includes("generateContent")) continue;
      if (/(embedding|image|banana|tts|audio|live|omni)/i.test(id)) continue;
      ids.push(id);
    }
    return ids.sort().reverse();
  },

  async *stream({ model, messages, json, fast, signal }) {
    const { systemInstruction, contents } = toGemini(messages);
    const stream = await getClient().models.generateContentStream({
      model,
      contents,
      config: {
        systemInstruction,
        abortSignal: signal,
        ...(json ? { responseMimeType: "application/json" } : {}),
        // Gemini 2.5 Flash cho tắt hẳn phần "suy nghĩ" → nhanh hơn nhiều với việc phân loại
        ...(fast && /^gemini-2\.5-flash/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    });

    let usage: { inputTokens: number; outputTokens: number } | null = null;
    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) yield { type: "text", text };
      if (chunk.usageMetadata) {
        usage = {
          inputTokens: chunk.usageMetadata.promptTokenCount ?? 0,
          // thoughtsTokenCount: token "suy nghĩ" của model, cũng bị tính phí như output
          outputTokens:
            (chunk.usageMetadata.candidatesTokenCount ?? 0) + (chunk.usageMetadata.thoughtsTokenCount ?? 0),
        };
      }
    }
    if (usage) yield { type: "usage", ...usage };
  },

  createAgent({ model, messages, tools }) {
    const { systemInstruction, contents } = toGemini(messages);
    const config: GenerateContentConfig = {
      systemInstruction,
      tools: [
        {
          functionDeclarations: tools.map((t) => ({
            name: t.name,
            description: t.description,
            parametersJsonSchema: t.parameters,
          })),
        },
      ],
    };
    // Gemini có thể không trả id cho lời gọi hàm → ghi nhớ để trả kết quả đúng định dạng
    const callsWithoutId = new Set<string>();

    return {
      async step(signal) {
        const res = await getClient().models.generateContent({
          model,
          contents,
          config: { ...config, abortSignal: signal },
        });
        const content = res.candidates?.[0]?.content;
        // Giữ nguyên toàn bộ nội dung model trả về (kể cả "thought signature") để gửi lại ở bước sau
        if (content) contents.push({ ...content, role: "model" });

        const toolCalls: ToolCall[] = (res.functionCalls ?? []).map((c, i) => {
          const id = c.id ?? `${c.name}-${contents.length}-${i}`;
          if (!c.id) callsWithoutId.add(id);
          return { id, name: c.name ?? "", args: c.args ?? {} };
        });
        const text = (content?.parts ?? [])
          .filter((p) => p.text && !p.thought)
          .map((p) => p.text)
          .join("");
        const u = res.usageMetadata;
        return {
          text,
          toolCalls,
          inputTokens: u?.promptTokenCount ?? 0,
          outputTokens: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0),
        };
      },
      addToolResults(results) {
        contents.push({
          role: "user",
          parts: results.map((r) => ({
            functionResponse: {
              ...(callsWithoutId.has(r.call.id) ? {} : { id: r.call.id }),
              name: r.call.name,
              response: { result: r.result },
            },
          })),
        });
      },
    };
  },
};
