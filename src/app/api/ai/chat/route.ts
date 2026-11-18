import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { getDb, schema } from "@/lib/db";
import type { AiMessageMeta } from "@/lib/db/schema";
import { describeAIError, isProviderId, runAgent, type AgentEvent, type ChatMessage } from "@/lib/ai";
import { agentSystemPrompt, buildAgentTools } from "@/lib/agent-tools";

const bodySchema = z.object({
  conversationId: z.uuid().optional(),
  provider: z.string().refine(isProviderId, "Hãng AI không hợp lệ"),
  model: z.string().min(1).max(100),
  message: z.string().trim().min(1).max(50_000),
});

/**
 * Gửi 1 tin nhắn cho Trợ lý AI. Trợ lý có thể dùng công cụ để đọc/ghi dữ liệu.
 *
 * Trả về luồng NDJSON (mỗi dòng một sự kiện):
 *   {"type":"conversation","id":"..."}         – id cuộc trò chuyện
 *   {"type":"tool","label":"...","ok":true}    – AI vừa dùng một công cụ
 *   {"type":"text","text":"..."}               – câu trả lời
 *   {"type":"error","message":"..."}
 *   {"type":"done"}
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const { provider, model, message } = parsed.data;
  if (!isProviderId(provider)) return Response.json({ error: "Hãng AI không hợp lệ" }, { status: 400 });

  const db = await getDb();
  const { aiConversations, aiMessages } = schema;

  // Lấy hoặc tạo cuộc trò chuyện
  let conversationId = parsed.data.conversationId;
  if (conversationId) {
    const [conv] = await db
      .select({ id: aiConversations.id })
      .from(aiConversations)
      .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.workspaceId, user.workspaceId)))
      .limit(1);
    if (!conv) return Response.json({ error: "Không tìm thấy cuộc trò chuyện" }, { status: 404 });
    await db.update(aiConversations).set({ provider, model }).where(eq(aiConversations.id, conversationId));
  } else {
    const [conv] = await db
      .insert(aiConversations)
      .values({ workspaceId: user.workspaceId, userId: user.id, title: message.slice(0, 80), provider, model })
      .returning({ id: aiConversations.id });
    conversationId = conv.id;
  }
  const convId = conversationId;

  const history = await db
    .select({ role: aiMessages.role, content: aiMessages.content })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, convId))
    .orderBy(asc(aiMessages.createdAt));

  await db.insert(aiMessages).values({ conversationId: convId, role: "user", content: message });

  const messages: ChatMessage[] = [
    { role: "system", content: agentSystemPrompt(user.name) },
    // Giữ 40 tin gần nhất để không vượt giới hạn ngữ cảnh
    ...history.slice(-40),
    { role: "user", content: message },
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: object) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        } catch {
          /* trình duyệt đã ngắt kết nối */
        }
      };
      const tools: NonNullable<AiMessageMeta["tools"]> = [];
      send({ type: "conversation", id: convId });

      try {
        const text = await runAgent({
          provider,
          model,
          messages,
          tools: buildAgentTools({ workspaceId: user.workspaceId, userId: user.id }),
          feature: "chat",
          user: { id: user.id, workspaceId: user.workspaceId },
          signal: request.signal,
          onEvent: (ev: AgentEvent) => {
            if (ev.type === "tool") {
              tools.push({ name: ev.name, label: ev.label, ok: ev.ok, link: ev.link });
              send(ev);
            }
          },
        });
        send({ type: "text", text });
        await db.insert(aiMessages).values({ conversationId: convId, role: "assistant", content: text, meta: { tools } });
        await db.update(aiConversations).set({ updatedAt: new Date() }).where(eq(aiConversations.id, convId));
      } catch (err) {
        if (!request.signal.aborted) send({ type: "error", message: describeAIError(err) });
      } finally {
        send({ type: "done" });
        try {
          controller.close();
        } catch {
          /* đã đóng */
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
