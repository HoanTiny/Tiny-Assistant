import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { resolveChoice, streamAI } from "@/lib/ai";
import { briefMessages, isBriefKind, saveBrief } from "@/lib/brief";

const bodySchema = z.object({
  kind: z.string(),
  provider: z.string().optional(),
  model: z.string().max(100).optional(),
});

/** Tạo (hoặc tạo lại) bản tin sáng / tổng kết tuần, stream nội dung về rồi lưu */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isBriefKind(parsed.data.kind)) {
    return Response.json({ error: "Loại bản tin không hợp lệ" }, { status: 400 });
  }
  const kind = parsed.data.kind;
  const choice = resolveChoice(parsed.data.provider, parsed.data.model);
  if (!choice) return Response.json({ error: "Chưa có API key AI nào. Thêm vào .env.local." }, { status: 400 });

  const now = new Date();
  const stream = streamAI({
    ...choice,
    feature: `brief:${kind}`,
    user: { id: user.id, workspaceId: user.workspaceId },
    signal: request.signal,
    messages: await briefMessages(user, kind, now),
    onFinish: async (text) => {
      if (text.trim() && !text.startsWith("⚠️")) {
        await saveBrief({ workspaceId: user.workspaceId, userId: user.id }, kind, text, now);
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
