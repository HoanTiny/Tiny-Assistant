/**
 * Bản tin sáng (hằng ngày) và Tổng kết tuần.
 *
 * - Tạo thủ công trên trang /brief (stream kết quả).
 * - Tự tạo theo lịch: src/instrumentation.ts gọi runScheduledBriefs() mỗi 10 phút
 *   (khi app chạy liên tục: máy cá nhân, VPS). Trên Vercel/serverless dùng /api/cron/brief.
 *
 * Mỗi bản tin được lưu thành một item type "brief", data = { kind, key }.
 */
import "server-only";
import { and, desc, eq, gte, sql, sum } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Item } from "@/lib/db/schema";
import { defaultProviderId, generateAI, getProvider, type ChatMessage } from "@/lib/ai";
import { createItem, listTasksBy, searchItems, updateItem, type Ctx } from "@/lib/items";
import { addDays, dateContextForAI, dateKey, startOfDay, startOfWeek, toLocalIso } from "@/lib/time";

export type BriefKind = "daily" | "weekly";

export function isBriefKind(v: unknown): v is BriefKind {
  return v === "daily" || v === "weekly";
}

/** Khóa duy nhất của bản tin: ngày (daily) hoặc thứ 2 đầu tuần (weekly) */
export function briefKey(kind: BriefKind, now = new Date()): string {
  return kind === "daily" ? dateKey(now) : dateKey(startOfWeek(now));
}

export function briefTitle(kind: BriefKind, now = new Date()): string {
  const fmt = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" });
  if (kind === "daily") return `Bản tin sáng ${fmt.format(now)}`;
  return `Tổng kết tuần ${fmt.format(addDays(now, -7))} – ${fmt.format(addDays(now, -1))}`;
}

const PRIORITY = ["", "ưu tiên thấp", "ưu tiên TB", "ƯU TIÊN CAO"];

function taskLine(t: Item): string {
  const bits = [
    t.dueAt ? `hạn ${toLocalIso(t.dueAt)}` : null,
    PRIORITY[t.priority] || null,
    t.status === "doing" ? "đang làm" : null,
  ].filter(Boolean);
  return `- ${t.title}${bits.length ? ` (${bits.join(", ")})` : ""}`;
}

function section(title: string, list: Item[], empty = "(không có)"): string {
  return `### ${title} [${list.length}]\n${list.length ? list.map(taskLine).join("\n") : empty}`;
}

async function buildMessages(workspaceId: string, kind: BriefKind, userName: string, now: Date): Promise<ChatMessage[]> {
  const [overdue, today, week, doing, high, done7] = await Promise.all([
    listTasksBy(workspaceId, "overdue", 30, now),
    listTasksBy(workspaceId, "today", 30, now),
    listTasksBy(workspaceId, "next_7_days", 40, now),
    listTasksBy(workspaceId, "doing", 20, now),
    listTasksBy(workspaceId, "high_priority", 20, now),
    listTasksBy(workspaceId, "done_last_7_days", 50, now),
  ]);
  const todayIds = new Set(today.map((t) => t.id));
  const upcoming = week.filter((t) => !todayIds.has(t.id));
  const notes = (await searchItems(workspaceId, { type: "note", limit: 8 })).filter(
    (n) => n.updatedAt >= addDays(now, kind === "daily" ? -2 : -7),
  );

  let data: string;
  let instruction: string;

  if (kind === "daily") {
    const doneYesterday = done7.filter((t) => t.updatedAt >= startOfDay(addDays(now, -1)));
    data = [
      section("Quá hạn", overdue),
      section("Hạn hôm nay", today),
      section("Đang làm", doing),
      section("Ưu tiên cao chưa xong", high),
      section("Sắp tới (7 ngày)", upcoming),
      section("Đã xong từ hôm qua", doneYesterday),
      `### Ghi chú mới cập nhật\n${notes.map((n) => `- ${n.title}`).join("\n") || "(không có)"}`,
    ].join("\n\n");
    instruction = `Viết BẢN TIN BUỔI SÁNG cho ${userName}. Cấu trúc Markdown:
## Tóm tắt nhanh
1–2 câu về khối lượng việc hôm nay.
## Ưu tiên hôm nay
Tối đa 5 việc theo thứ tự nên làm, mỗi việc 1 dòng kèm lý do ngắn.
## Cần chú ý
Việc quá hạn, rủi ro trễ, việc treo lâu ở "đang làm". Bỏ mục này nếu không có gì.
## Gợi ý sắp xếp thời gian
Chia khung sáng / chiều hợp lý.
Tối đa 250 từ, giọng tích cực, thực tế. Nếu gần như không có dữ liệu, gợi ý người dùng nhập việc bằng Ctrl+K.`;
  } else {
    const db = await getDb();
    const [usage] = await db
      .select({ tokens: sum(sql<number>`${schema.aiCalls.inputTokens} + ${schema.aiCalls.outputTokens}`) })
      .from(schema.aiCalls)
      .where(and(eq(schema.aiCalls.workspaceId, workspaceId), gte(schema.aiCalls.createdAt, addDays(now, -7))));
    const open = await listTasksBy(workspaceId, "open", 100, now);
    data = [
      section("Đã xong 7 ngày qua", done7),
      section("Đang quá hạn", overdue),
      section("Đang làm", doing),
      section("Hạn trong 7 ngày tới", week),
      `### Tổng số việc chưa xong: ${open.length}`,
      `### Ghi chú tạo/sửa trong tuần\n${notes.map((n) => `- ${n.title}`).join("\n") || "(không có)"}`,
      `### Token AI đã dùng 7 ngày qua: ${Number(usage?.tokens ?? 0)}`,
    ].join("\n\n");
    instruction = `Viết TỔNG KẾT TUẦN cho ${userName}. Cấu trúc Markdown:
## Tuần qua
Đã hoàn thành gì (kèm con số), điểm nổi bật.
## Chưa xong / trễ hạn
Việc còn tồn, nguyên nhân có thể.
## Nhận xét
Nhịp làm việc, điều làm tốt, điều nên cải thiện (thẳng thắn, có căn cứ từ dữ liệu).
## 3 ưu tiên cho tuần tới
Cụ thể, đo được.
Tối đa 350 từ.`;
  }

  return [
    {
      role: "system",
      content: `Bạn là trợ lý làm việc cá nhân trong ứng dụng WorkHub. Trả lời bằng tiếng Việt, Markdown, ngắn gọn, chỉ dựa trên dữ liệu được cung cấp, không bịa thêm việc.\n${dateContextForAI(now)}`,
    },
    { role: "user", content: `${instruction}\n\n---\nDỮ LIỆU:\n\n${data}` },
  ];
}

export async function briefMessages(user: { workspaceId: string; name: string }, kind: BriefKind, now = new Date()) {
  return buildMessages(user.workspaceId, kind, user.name, now);
}

async function findBrief(workspaceId: string, kind: BriefKind, key: string): Promise<Item | null> {
  const db = await getDb();
  const { items } = schema;
  const [row] = await db
    .select()
    .from(items)
    .where(
      and(
        eq(items.workspaceId, workspaceId),
        eq(items.type, "brief"),
        sql`${items.archivedAt} is null`,
        sql`${items.data}->>'kind' = ${kind}`,
        sql`${items.data}->>'key' = ${key}`,
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Lưu bản tin; nếu đã có bản cùng kỳ thì ghi đè nội dung */
export async function saveBrief(ctx: Ctx, kind: BriefKind, content: string, now = new Date()): Promise<Item | null> {
  const key = briefKey(kind, now);
  const existing = await findBrief(ctx.workspaceId, kind, key);
  if (existing) return updateItem(ctx, existing.id, { content, title: briefTitle(kind, now) });
  return createItem(ctx, { type: "brief", title: briefTitle(kind, now), content, data: { kind, key } });
}

export async function getCurrentBriefs(workspaceId: string, now = new Date()) {
  const [daily, weekly] = await Promise.all([
    findBrief(workspaceId, "daily", briefKey("daily", now)),
    findBrief(workspaceId, "weekly", briefKey("weekly", now)),
  ]);
  return { daily, weekly };
}

export async function listBriefs(workspaceId: string, limit = 30): Promise<Item[]> {
  const db = await getDb();
  const { items } = schema;
  return db
    .select()
    .from(items)
    .where(and(eq(items.workspaceId, workspaceId), eq(items.type, "brief"), sql`${items.archivedAt} is null`))
    .orderBy(desc(items.createdAt))
    .limit(limit);
}

// ───────────────────────── Tự tạo theo lịch ─────────────────────────

const BRIEF_HOUR = Number(process.env.BRIEF_HOUR ?? 7);
/** 0 = Chủ nhật, 1 = Thứ 2 ... Mặc định tổng kết tuần vào sáng thứ 2 */
const WEEKLY_DAY = Number(process.env.WEEKLY_REVIEW_DAY ?? 1);

let running = false;

/**
 * Tạo bản tin còn thiếu cho mọi workspace (dùng chủ sở hữu làm người tạo).
 * Gọi bao nhiêu lần cũng được: bản đã có thì bỏ qua.
 */
export async function runScheduledBriefs(now = new Date()): Promise<{ created: string[] }> {
  const created: string[] = [];
  if (running || now.getHours() < BRIEF_HOUR) return { created };
  const providerId = defaultProviderId();
  if (!providerId) return { created };

  running = true;
  try {
    const db = await getDb();
    const owners = await db
      .select({ workspaceId: schema.workspaceMembers.workspaceId, userId: schema.users.id, name: schema.users.name })
      .from(schema.workspaceMembers)
      .innerJoin(schema.users, eq(schema.users.id, schema.workspaceMembers.userId))
      .where(eq(schema.workspaceMembers.role, "owner"));

    for (const o of owners) {
      const kinds: BriefKind[] = ["daily"];
      if (now.getDay() === WEEKLY_DAY) kinds.push("weekly");
      for (const kind of kinds) {
        if (await findBrief(o.workspaceId, kind, briefKey(kind, now))) continue;
        try {
          const content = await generateAI({
            provider: providerId,
            model: getProvider(providerId).defaultModel(),
            feature: `brief:${kind}:auto`,
            user: { id: o.userId, workspaceId: o.workspaceId },
            messages: await buildMessages(o.workspaceId, kind, o.name, now),
          });
          if (content.trim()) {
            await saveBrief({ workspaceId: o.workspaceId, userId: o.userId }, kind, content, now);
            created.push(`${o.workspaceId}:${kind}`);
          }
        } catch (err) {
          console.error(`[brief] Không tạo được bản tin ${kind}:`, err);
        }
      }
    }
  } finally {
    running = false;
  }
  return { created };
}
