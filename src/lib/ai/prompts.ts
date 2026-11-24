/**
 * Thư viện prompt cho các nút AI trên item.
 * Thêm hành động mới = thêm 1 mục vào ITEM_ACTIONS (giao diện tự hiện nút).
 */
import type { Item } from "@/lib/db/schema";
import type { ChatMessage } from "./types";

export const SYSTEM_PROMPT = `Bạn là trợ lý làm việc cá nhân trong ứng dụng WorkHub.
Trả lời bằng tiếng Việt, ngắn gọn, đi thẳng vào việc, trình bày bằng Markdown (tiêu đề ngắn, gạch đầu dòng).
Nếu thiếu thông tin để kết luận chắc chắn, hãy nói rõ giả định của bạn.`;

export type ItemActionKey = "evaluate" | "summarize" | "breakdown" | "improve";

export const ITEM_ACTIONS: Record<ItemActionKey, { label: string; description: string; instruction: string }> = {
  evaluate: {
    label: "Đánh giá",
    description: "Chấm điểm 1–10, nêu điểm mạnh, rủi ro và việc nên làm tiếp",
    instruction: `Đánh giá mục này. Trả về:
1. **Điểm tổng thể** (1–10) và một câu lý do.
2. **Điểm mạnh** (tối đa 3 ý).
3. **Vấn đề / rủi ro** (tối đa 3 ý).
4. **Đề xuất ưu tiên** (Cao / Trung bình / Thấp) và việc nên làm tiếp theo.`,
  },
  summarize: {
    label: "Tóm tắt",
    description: "Rút gọn thành tối đa 5 ý chính",
    instruction: "Tóm tắt mục này trong tối đa 5 gạch đầu dòng, giữ lại số liệu và hạn chót quan trọng.",
  },
  breakdown: {
    label: "Chia nhỏ việc",
    description: "Tách thành checklist các bước nhỏ, mỗi bước 30–90 phút",
    instruction:
      "Chia mục này thành checklist các bước cụ thể, mỗi bước làm được trong khoảng 30–90 phút, theo thứ tự nên làm. Có thể nhóm bằng tiêu đề `###`; mỗi bước là một dòng phẳng dạng `- [ ] bước (ước lượng thời gian)`, không lồng thêm gạch đầu dòng.",
  },
  improve: {
    label: "Viết lại hay hơn",
    description: "Viết lại rõ ràng, chuyên nghiệp hơn, giữ nguyên ý",
    instruction:
      "Viết lại nội dung mục này cho rõ ràng, mạch lạc, chuyên nghiệp hơn, giữ nguyên ý. Chỉ trả về nội dung đã viết lại.",
  },
};

export function isItemAction(key: unknown): key is ItemActionKey {
  return typeof key === "string" && key in ITEM_ACTIONS;
}

const PRIORITY_LABEL = ["Không", "Thấp", "Trung bình", "Cao"];

/** Đưa item thành văn bản để AI đọc */
export function itemToContext(item: Item): string {
  const lines = [`Loại: ${item.type}`, `Tiêu đề: ${item.title}`];
  if (item.status) lines.push(`Trạng thái: ${item.status}`);
  if (item.priority) lines.push(`Ưu tiên: ${PRIORITY_LABEL[item.priority] ?? item.priority}`);
  if (item.dueAt) lines.push(`Hạn: ${item.dueAt.toISOString().slice(0, 10)}`);
  lines.push(`Ngày tạo: ${item.createdAt.toISOString().slice(0, 10)}`);
  lines.push("", "Nội dung:", item.content.trim() || "(trống)");
  return lines.join("\n");
}

export function buildItemActionMessages(item: Item, action: ItemActionKey, today = new Date()): ChatMessage[] {
  return [
    { role: "system", content: `${SYSTEM_PROMPT}\nHôm nay là ${today.toISOString().slice(0, 10)}.` },
    {
      role: "user",
      content: `${ITEM_ACTIONS[action].instruction}\n\n---\n${itemToContext(item)}`,
    },
  ];
}
