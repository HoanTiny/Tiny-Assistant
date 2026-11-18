import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { getItem } from "@/lib/items";
import { isProviderId, streamAI } from "@/lib/ai";
import { buildItemActionMessages, isItemAction } from "@/lib/ai/prompts";

const bodySchema = z.object({
  itemId: z.uuid(),
  action: z.string(),
  provider: z.string(),
  model: z.string().min(1).max(100),
});

/** Chạy một hành động AI (đánh giá, tóm tắt...) trên một item, stream kết quả về */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  const { itemId, action, provider, model } = parsed.data;
  if (!isItemAction(action)) return Response.json({ error: "Hành động không hợp lệ" }, { status: 400 });
  if (!isProviderId(provider)) return Response.json({ error: "Hãng AI không hợp lệ" }, { status: 400 });

  const item = await getItem(user.workspaceId, itemId);
  if (!item) return Response.json({ error: "Không tìm thấy mục" }, { status: 404 });

  const stream = streamAI({
    provider,
    model,
    messages: buildItemActionMessages(item, action),
    feature: `item:${action}`,
    user: { id: user.id, workspaceId: user.workspaceId },
    signal: request.signal,
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
