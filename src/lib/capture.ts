/**
 * Nhập nhanh: một câu tự do → AI phân loại thành công việc hoặc ghi chú,
 * tách hạn chót, mức ưu tiên và tag. Không có AI thì lưu thẳng thành công việc.
 */
import "server-only";
import { z } from "zod";
import { generateJSON, resolveChoice, describeAIError } from "@/lib/ai";
import { addItemTags, createItem, type Ctx } from "@/lib/items";
import { dateContextForAI, parseLocalDateTime } from "@/lib/time";

const captureShape = z.object({
  type: z.enum(["task", "note"]),
  title: z.string().trim().min(1).max(200),
  content: z.string().optional().default(""),
  due: z.string().nullable().optional(),
  priority: z.coerce.number().int().min(0).max(3).optional().default(0),
  tags: z.array(z.string()).max(5).optional().default([]),
});

const CAPTURE_PROMPT = `Bạn là bộ phân loại "nhập nhanh" của ứng dụng quản lý công việc.
Người dùng gõ một câu ngắn. Hãy chuyển nó thành JSON với đúng các trường:
{
  "type": "task" | "note",      // task = việc cần làm/hành động; note = thông tin, ý tưởng, ghi chép
  "title": string,              // ngắn gọn ≤ 80 ký tự, giữ ngôn ngữ gốc, bỏ phần ngày giờ đã tách
  "content": string,            // chi tiết còn lại (link, ghi chú thêm); có thể rỗng
  "due": string | null,         // "YYYY-MM-DD" hoặc "YYYY-MM-DDTHH:mm" nếu có nhắc thời hạn, không thì null
  "priority": 0 | 1 | 2 | 3,    // 3 nếu có "gấp", "khẩn", "quan trọng", "ASAP"; mặc định 0
  "tags": string[]              // 0–3 chủ đề / dự án / lĩnh vực (vd "marketing", "video", "tài chính"); chữ thường, không dấu #; KHÔNG dùng động từ hay tên người
}
Quy đổi "mai", "thứ 6", "tuần sau", "cuối tháng", "3h chiều"... thành ngày giờ chính xác theo lịch bên dưới.
Chỉ trả về JSON, không giải thích.`;

export type CaptureResult = {
  item: { id: string; type: string; title: string; dueAt: string | null; priority: number; tags: string[] };
  usedAI: boolean;
  warning?: string;
};

export async function captureText(
  user: Ctx & { id: string },
  text: string,
  choice?: { provider?: unknown; model?: unknown },
): Promise<CaptureResult> {
  const ai = resolveChoice(choice?.provider, choice?.model);
  let parsed: z.infer<typeof captureShape> | null = null;
  let warning: string | undefined;

  if (ai) {
    try {
      parsed = await generateJSON(
        {
          ...ai,
          feature: "capture",
          fast: true,
          user: { id: user.userId, workspaceId: user.workspaceId },
          messages: [
            { role: "system", content: `${CAPTURE_PROMPT}\n\n${dateContextForAI()}` },
            { role: "user", content: text },
          ],
        },
        captureShape,
      );
    } catch (err) {
      warning = `AI không phân loại được (${describeAIError(err)}), đã lưu thành công việc.`;
    }
  } else {
    warning = "Chưa có API key AI nên đã lưu nguyên văn thành công việc.";
  }

  const values = parsed ?? { type: "task" as const, title: text.slice(0, 200), content: "", due: null, priority: 0, tags: [] };
  const dueAt = values.type === "task" ? parseLocalDateTime(values.due) : null;
  const item = await createItem(user, {
    type: values.type,
    title: values.title,
    content: values.content,
    status: values.type === "task" ? "todo" : null,
    priority: values.type === "task" ? values.priority : 0,
    dueAt,
    data: { source: "capture", raw: text },
  });
  await addItemTags(user.workspaceId, item.id, values.tags);

  return {
    item: {
      id: item.id,
      type: item.type,
      title: item.title,
      dueAt: item.dueAt?.toISOString() ?? null,
      priority: item.priority,
      tags: values.tags,
    },
    usedAI: Boolean(parsed),
    warning,
  };
}
