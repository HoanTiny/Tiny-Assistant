import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { captureText } from "@/lib/capture";

const bodySchema = z.object({
  text: z.string().trim().min(1).max(5000),
  provider: z.string().optional(),
  model: z.string().max(100).optional(),
});

/** Nhập nhanh: nhận một câu, AI phân loại rồi lưu thành công việc / ghi chú */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Nội dung trống hoặc quá dài" }, { status: 400 });

  const result = await captureText(
    { id: user.id, userId: user.id, workspaceId: user.workspaceId },
    parsed.data.text,
    { provider: parsed.data.provider, model: parsed.data.model },
  );
  return Response.json(result);
}
