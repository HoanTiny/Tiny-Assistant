export type ProviderId = "openai" | "gemini";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "usage"; inputTokens: number; outputTokens: number };

export type StreamParams = {
  model: string;
  messages: ChatMessage[];
  /** Yêu cầu model trả về JSON hợp lệ */
  json?: boolean;
  /** Việc nhỏ (phân loại, trích xuất): giảm mức "suy nghĩ" để trả lời nhanh, rẻ hơn */
  fast?: boolean;
  signal?: AbortSignal;
};

/** Mô tả một hàm mà AI được phép gọi (tham số theo JSON Schema) */
export type ToolSpec = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type ToolCall = { id: string; name: string; args: Record<string, unknown> };

export type AgentStep = {
  text: string;
  toolCalls: ToolCall[];
  inputTokens: number;
  outputTokens: number;
};

/**
 * Một phiên "agent": AI trả lời hoặc yêu cầu gọi hàm, ta chạy hàm rồi gửi kết quả lại.
 * Mỗi provider tự giữ lịch sử hội thoại theo định dạng riêng của hãng.
 */
export interface AgentSession {
  step(signal?: AbortSignal): Promise<AgentStep>;
  addToolResults(results: { call: ToolCall; result: unknown }[]): void;
}

/**
 * Mỗi hãng AI là một "provider" cài đặt interface này.
 * Thêm hãng mới (Claude, DeepSeek, model chạy local...) = thêm 1 file trong providers/.
 */
export interface AIProvider {
  id: ProviderId;
  label: string;
  isConfigured(): boolean;
  defaultModel(): string;
  /** Danh sách model lấy trực tiếp từ API của hãng */
  listModels(): Promise<string[]>;
  stream(params: StreamParams): AsyncIterable<StreamEvent>;
  createAgent(params: { model: string; messages: ChatMessage[]; tools: ToolSpec[] }): AgentSession;
}

/** Thông tin provider gửi xuống giao diện */
export type ProviderInfo = {
  id: ProviderId;
  label: string;
  configured: boolean;
  defaultModel: string;
  models: string[];
};
