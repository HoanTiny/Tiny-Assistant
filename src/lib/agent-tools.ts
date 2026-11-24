/**
 * Các "công cụ" Trợ lý AI được phép dùng để đọc/ghi dữ liệu WorkHub.
 *
 * Thêm công cụ mới = thêm 1 mục vào mảng trong buildAgentTools():
 *   name / description / parameters (JSON Schema) → để AI hiểu khi nào và cách gọi
 *   label → câu hiện cho người dùng khi AI đang dùng công cụ
 *   run   → code thật sự chạy (luôn giới hạn trong workspace của người dùng)
 *
 * Mọi thay đổi do AI tạo ra đều ghi vào nhật ký hoạt động như khi người dùng tự làm.
 * Không có công cụ xóa dữ liệu.
 */
import "server-only";
import { canWebSearch, webSearch, type AgentTool } from "@/lib/ai";
import type { Item } from "@/lib/db/schema";
import {
  addItemTags,
  createItem,
  getItem,
  getItemTags,
  listTasksBy,
  searchItems,
  updateItem,
  type Ctx,
  type TaskFilter,
} from "@/lib/items";
import { dateContextForAI, parseLocalDateTime, toLocalIso } from "@/lib/time";
import { fetchWeather } from "@/lib/weather";

const TASK_FILTERS: TaskFilter[] = ["overdue", "today", "next_7_days", "doing", "open", "high_priority", "done_last_7_days"];
const FILTER_LABEL: Record<TaskFilter, string> = {
  overdue: "việc quá hạn",
  today: "việc hôm nay",
  next_7_days: "việc 7 ngày tới",
  doing: "việc đang làm",
  open: "việc chưa xong",
  high_priority: "việc ưu tiên cao",
  done_last_7_days: "việc đã xong 7 ngày qua",
};

const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : undefined);
const short = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** Dạng gọn của item để AI đọc */
function compact(item: Item, tags?: string[]) {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    status: item.status,
    priority: item.priority,
    due: item.dueAt ? toLocalIso(item.dueAt) : null,
    tags: tags ?? [],
    updated: toLocalIso(item.updatedAt),
  };
}

async function compactList(list: Item[]) {
  const tags = await getItemTags(list.map((i) => i.id));
  return list.map((i) => compact(i, tags.get(i.id)));
}

export function buildAgentTools(ctx: Ctx): AgentTool[] {
  return [
    {
      name: "list_tasks",
      description:
        "Liệt kê công việc theo nhóm: overdue (quá hạn), today (hạn hôm nay), next_7_days, doing (đang làm), open (chưa xong), high_priority, done_last_7_days.",
      parameters: {
        type: "object",
        properties: {
          filter: { type: "string", enum: TASK_FILTERS },
          limit: { type: "integer", minimum: 1, maximum: 50 },
        },
        required: ["filter"],
      },
      label: (a) => `Xem ${FILTER_LABEL[a.filter as TaskFilter] ?? "công việc"}`,
      run: async (a) => {
        const filter = TASK_FILTERS.includes(a.filter as TaskFilter) ? (a.filter as TaskFilter) : "open";
        return { tasks: await compactList(await listTasksBy(ctx.workspaceId, filter, num(a.limit) ?? 30)) };
      },
    },
    {
      name: "search_items",
      description: "Tìm công việc / ghi chú / bản tin theo từ khóa trong tiêu đề hoặc nội dung. Bỏ query để lấy mục mới cập nhật.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          type: { type: "string", enum: ["task", "note", "brief"] },
          limit: { type: "integer", minimum: 1, maximum: 50 },
        },
      },
      label: (a) => (a.query ? `Tìm “${short(String(a.query))}”` : "Xem các mục gần đây"),
      run: async (a) => ({
        items: await compactList(
          await searchItems(ctx.workspaceId, { query: str(a.query), type: str(a.type), limit: num(a.limit) }),
        ),
      }),
    },
    {
      name: "get_item",
      description: "Đọc đầy đủ nội dung một mục theo id (lấy id từ list_tasks hoặc search_items).",
      parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      label: () => "Đọc chi tiết một mục",
      run: async (a) => {
        const item = await getItem(ctx.workspaceId, String(a.id));
        if (!item || item.archivedAt) return { error: "Không tìm thấy mục này" };
        const tags = await getItemTags([item.id]);
        return { ...compact(item, tags.get(item.id)), content: item.content.slice(0, 8000), link: `/items/${item.id}` };
      },
    },
    {
      name: "create_task",
      description: "Tạo công việc mới.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Ngắn gọn, ≤ 80 ký tự" },
          content: { type: "string", description: "Mô tả chi tiết (Markdown), có thể bỏ trống" },
          due: { type: "string", description: "YYYY-MM-DD hoặc YYYY-MM-DDTHH:mm" },
          priority: { type: "integer", minimum: 0, maximum: 3, description: "0 không, 1 thấp, 2 trung bình, 3 cao" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["title"],
      },
      label: (a) => `Tạo việc “${short(String(a.title ?? ""))}”`,
      run: async (a) => {
        const item = await createItem(ctx, {
          type: "task",
          status: "todo",
          title: String(a.title).slice(0, 200),
          content: str(a.content) ?? "",
          dueAt: parseLocalDateTime(a.due),
          priority: Math.min(3, Math.max(0, num(a.priority) ?? 0)),
          data: { source: "assistant" },
        });
        if (Array.isArray(a.tags)) await addItemTags(ctx.workspaceId, item.id, a.tags.map(String));
        return { ok: true, id: item.id, link: `/items/${item.id}` };
      },
    },
    {
      name: "create_note",
      description: "Tạo ghi chú mới (biên bản, ý tưởng, tóm tắt...).",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          content: { type: "string", description: "Nội dung Markdown" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["title", "content"],
      },
      label: (a) => `Tạo ghi chú “${short(String(a.title ?? ""))}”`,
      run: async (a) => {
        const item = await createItem(ctx, {
          type: "note",
          title: String(a.title).slice(0, 200),
          content: str(a.content) ?? "",
          data: { source: "assistant" },
        });
        if (Array.isArray(a.tags)) await addItemTags(ctx.workspaceId, item.id, a.tags.map(String));
        return { ok: true, id: item.id, link: `/items/${item.id}` };
      },
    },
    {
      name: "update_task",
      description:
        "Sửa một công việc: đổi trạng thái (todo/doing/done), hạn chót, ưu tiên, tiêu đề, hoặc thêm ghi chú vào cuối mô tả. Đặt due = \"\" để bỏ hạn.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          status: { type: "string", enum: ["todo", "doing", "done"] },
          due: { type: "string", description: "YYYY-MM-DD hoặc YYYY-MM-DDTHH:mm, chuỗi rỗng để bỏ hạn" },
          priority: { type: "integer", minimum: 0, maximum: 3 },
          append_content: { type: "string", description: "Đoạn thêm vào cuối mô tả" },
        },
        required: ["id"],
      },
      label: (a) => (a.status === "done" ? "Đánh dấu xong một việc" : "Cập nhật một việc"),
      run: async (a) => {
        const item = await getItem(ctx.workspaceId, String(a.id));
        if (!item || item.type !== "task" || item.archivedAt) return { error: "Không tìm thấy công việc này" };
        const values: Parameters<typeof updateItem>[2] = {};
        if (str(a.title)) values.title = String(a.title).slice(0, 200);
        if (["todo", "doing", "done"].includes(String(a.status))) values.status = String(a.status);
        if (a.due !== undefined) values.dueAt = a.due === "" || a.due === null ? null : parseLocalDateTime(a.due);
        if (num(a.priority) !== undefined) values.priority = Math.min(3, Math.max(0, num(a.priority)!));
        if (str(a.append_content)) values.content = `${item.content}\n\n${a.append_content}`.trim();
        await updateItem(ctx, item.id, values);
        return { ok: true, id: item.id, link: `/items/${item.id}` };
      },
    },
    {
      name: "get_weather",
      description:
        "Xem thời tiết thực tế hiện tại và dự báo 1–10 ngày tới cho một địa điểm/thành phố (ví dụ: Hà Nội, TP.HCM, Đà Nẵng, Tokyo...). Luôn gọi công cụ này khi người dùng hỏi về thời tiết, không tự đoán.",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "Tên thành phố hoặc địa điểm, ví dụ: Hà Nội, TP.HCM, Đà Nẵng" },
          days: { type: "integer", minimum: 1, maximum: 10, description: "Số ngày dự báo (mặc định 5)" },
        },
        required: ["location"],
      },
      label: (a) => `Xem thời tiết ${short(String(a.location ?? ""))}`,
      run: async (a, signal) => fetchWeather(String(a.location ?? ""), num(a.days) ?? 5, signal),
    },
    ...(canWebSearch()
      ? [
          {
            name: "web_search",
            description:
              "Tìm kiếm thông tin thực tế mới nhất trên Google (tin tức hôm nay, tỷ giá, giá vàng, sự kiện, kết quả thể thao, thông tin công nghệ/sản phẩm mới...). Không dùng cho dữ liệu trong WorkHub; với thời tiết hãy ưu tiên get_weather.",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string", description: "Câu truy vấn tìm kiếm rõ ràng, có thể kèm ngày/địa điểm nếu cần" },
              },
              required: ["query"],
            },
            label: (a: Record<string, unknown>) => `Tìm kiếm “${short(String(a.query ?? ""))}”`,
            run: async (a: Record<string, unknown>, signal?: AbortSignal) =>
              webSearch(String(a.query ?? ""), { id: ctx.userId, workspaceId: ctx.workspaceId }, signal),
          } satisfies AgentTool,
        ]
      : []),
  ];
}

export function agentSystemPrompt(userName: string): string {
  const searchNote = canWebSearch()
    ? "\n- Khi câu hỏi cần thông tin thực tế mới nhất trên Internet (tin tức, tỷ giá, giá vàng, sự kiện, lịch thi đấu, kiến thức mới...), LUÔN gọi web_search để tra cứu, không đoán hay bịa. Có thể kèm đường dẫn nguồn ngắn gọn nếu hữu ích."
    : "";
  return `Bạn là trợ lý làm việc cá nhân của ${userName} trong ứng dụng WorkHub.
Trả lời bằng tiếng Việt, ngắn gọn, trình bày Markdown (gạch đầu dòng, in đậm ý chính).

Bạn có công cụ để đọc/ghi công việc, ghi chú và tra cứu thông tin thực tế:
- Khi câu hỏi liên quan đến dữ liệu của người dùng (việc, hạn, ghi chú, kế hoạch), LUÔN dùng công cụ để xem dữ liệu thật, không đoán.
- Khi được nhờ tạo/sửa, làm đúng yêu cầu rồi báo lại ngắn gọn đã làm gì. Nếu yêu cầu mơ hồ, hỏi lại trước khi ghi.
- Chỉ dùng id lấy từ kết quả công cụ, không tự bịa id. KHÔNG hiển thị id cho người dùng: gọi mục bằng tiêu đề (thêm hạn chót nếu cần phân biệt).
- Khi lập kế hoạch, ưu tiên: việc quá hạn → hạn hôm nay → ưu tiên cao → còn lại; ước lượng thời gian hợp lý.
- Khi nhắc tới một mục, ghi đúng tiêu đề của nó.
- Khi người dùng hỏi thời tiết, LUÔN gọi get_weather để lấy dự báo thực tế (nếu chưa rõ thành phố thì hỏi ngắn gọn 1 câu trước khi gọi).${searchNote}

${dateContextForAI()}`;
}
