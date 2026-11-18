/**
 * Truy cập dữ liệu item — dùng chung cho mọi module.
 * Mọi hàm đều nhận workspaceId để không bao giờ đọc nhầm dữ liệu của workspace khác.
 */
import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Item, NewItem } from "@/lib/db/schema";
import { addDays, endOfDay, startOfDay } from "@/lib/time";

export type Ctx = { workspaceId: string; userId: string };

export async function listItems(
  workspaceId: string,
  type: string,
  opts: { status?: string; limit?: number } = {},
): Promise<Item[]> {
  const db = await getDb();
  const { items } = schema;
  return db
    .select()
    .from(items)
    .where(
      and(
        eq(items.workspaceId, workspaceId),
        eq(items.type, type),
        isNull(items.archivedAt),
        opts.status ? eq(items.status, opts.status) : undefined,
      ),
    )
    .orderBy(desc(items.priority), sql`${items.dueAt} asc nulls last`, desc(items.createdAt))
    .limit(opts.limit ?? 200);
}

export async function getItem(workspaceId: string, id: string): Promise<Item | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.items)
    .where(and(eq(schema.items.workspaceId, workspaceId), eq(schema.items.id, id)))
    .limit(1);
  return row ?? null;
}

export async function createItem(
  ctx: Ctx,
  values: Omit<NewItem, "id" | "workspaceId" | "createdBy" | "createdAt" | "updatedAt">,
): Promise<Item> {
  const db = await getDb();
  const [item] = await db
    .insert(schema.items)
    .values({ ...values, workspaceId: ctx.workspaceId, createdBy: ctx.userId })
    .returning();
  await logActivity(ctx, "item.created", item.id, { type: item.type, title: item.title });
  return item;
}

export async function updateItem(
  ctx: Ctx,
  id: string,
  values: Partial<Pick<Item, "title" | "content" | "status" | "priority" | "dueAt" | "data" | "archivedAt">>,
): Promise<Item | null> {
  const db = await getDb();
  const [item] = await db
    .update(schema.items)
    .set(values)
    .where(and(eq(schema.items.workspaceId, ctx.workspaceId), eq(schema.items.id, id)))
    .returning();
  if (item) await logActivity(ctx, "item.updated", item.id, { fields: Object.keys(values) });
  return item ?? null;
}

export async function linkItems(fromId: string, toId: string, kind = "related") {
  const db = await getDb();
  await db.insert(schema.itemLinks).values({ fromId, toId, kind }).onConflictDoNothing();
}

/** Các item liên kết với item này (cả 2 chiều) */
export async function getLinkedItems(workspaceId: string, id: string) {
  const db = await getDb();
  const { itemLinks, items } = schema;
  const links = await db
    .select()
    .from(itemLinks)
    .where(sql`${itemLinks.fromId} = ${id} or ${itemLinks.toId} = ${id}`);
  if (links.length === 0) return [];

  const otherIds = links.map((l) => (l.fromId === id ? l.toId : l.fromId));
  const rows = await db
    .select({ id: items.id, title: items.title, type: items.type })
    .from(items)
    .where(and(eq(items.workspaceId, workspaceId), inArray(items.id, otherIds), isNull(items.archivedAt)));
  return rows.map((r) => ({ ...r, kind: links.find((l) => l.fromId === r.id || l.toId === r.id)?.kind ?? "related" }));
}

export async function logActivity(ctx: Ctx, action: string, itemId: string | null, payload: Record<string, unknown> = {}) {
  const db = await getDb();
  await db.insert(schema.activityLog).values({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    itemId,
    action,
    payload,
  });
}

// ───────── Tag ─────────

/** Gắn tag cho item (tạo tag mới nếu chưa có). Tên tag được chuẩn hóa chữ thường. */
export async function addItemTags(workspaceId: string, itemId: string, names: string[]) {
  const clean = [...new Set(names.map((n) => n.trim().toLowerCase().replace(/^#/, "")).filter(Boolean))].slice(0, 10);
  if (clean.length === 0) return;
  const db = await getDb();
  const { tags, itemTags } = schema;
  await db
    .insert(tags)
    .values(clean.map((name) => ({ workspaceId, name })))
    .onConflictDoNothing();
  const rows = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.workspaceId, workspaceId), inArray(tags.name, clean)));
  await db
    .insert(itemTags)
    .values(rows.map((t) => ({ itemId, tagId: t.id })))
    .onConflictDoNothing();
}

export async function getItemTags(itemIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (itemIds.length === 0) return map;
  const db = await getDb();
  const { tags, itemTags } = schema;
  const rows = await db
    .select({ itemId: itemTags.itemId, name: tags.name })
    .from(itemTags)
    .innerJoin(tags, eq(tags.id, itemTags.tagId))
    .where(inArray(itemTags.itemId, itemIds))
    .orderBy(asc(tags.name));
  for (const r of rows) map.set(r.itemId, [...(map.get(r.itemId) ?? []), r.name]);
  return map;
}

// ───────── Tìm kiếm ─────────

/** Tìm theo từ khóa trong tiêu đề / nội dung (không phân biệt hoa thường) */
export async function searchItems(
  workspaceId: string,
  opts: { query?: string; type?: string; limit?: number },
): Promise<Item[]> {
  const db = await getDb();
  const { items } = schema;
  const q = opts.query?.trim();
  return db
    .select()
    .from(items)
    .where(
      and(
        eq(items.workspaceId, workspaceId),
        isNull(items.archivedAt),
        opts.type ? eq(items.type, opts.type) : undefined,
        q ? or(ilike(items.title, `%${q}%`), ilike(items.content, `%${q}%`)) : undefined,
      ),
    )
    .orderBy(desc(items.updatedAt))
    .limit(Math.min(opts.limit ?? 20, 50));
}

// ───────── Công việc theo nhóm thời gian ─────────

export type TaskFilter = "overdue" | "today" | "next_7_days" | "doing" | "open" | "high_priority" | "done_last_7_days";

export async function listTasksBy(workspaceId: string, filter: TaskFilter, limit = 30, now = new Date()): Promise<Item[]> {
  const db = await getDb();
  const { items } = schema;
  const base = [eq(items.workspaceId, workspaceId), eq(items.type, "task"), isNull(items.archivedAt)];
  const open = ne(items.status, "done");
  const cond = {
    overdue: and(open, isNotNull(items.dueAt), lt(items.dueAt, startOfDay(now))),
    today: and(open, gte(items.dueAt, startOfDay(now)), lte(items.dueAt, endOfDay(now))),
    next_7_days: and(open, gte(items.dueAt, startOfDay(now)), lte(items.dueAt, endOfDay(addDays(now, 7)))),
    doing: eq(items.status, "doing"),
    open,
    high_priority: and(open, gte(items.priority, 3)),
    done_last_7_days: and(eq(items.status, "done"), gte(items.updatedAt, addDays(now, -7))),
  }[filter];

  return db
    .select()
    .from(items)
    .where(and(...base, cond))
    .orderBy(
      ...(filter === "done_last_7_days"
        ? [desc(items.updatedAt)]
        : [sql`${items.dueAt} asc nulls last`, desc(items.priority), desc(items.createdAt)]),
    )
    .limit(limit);
}

export async function recentActivity(workspaceId: string, limit = 10) {
  const db = await getDb();
  const { activityLog, items } = schema;
  return db
    .select({
      id: activityLog.id,
      action: activityLog.action,
      createdAt: activityLog.createdAt,
      itemId: activityLog.itemId,
      itemTitle: items.title,
      itemType: items.type,
    })
    .from(activityLog)
    .leftJoin(items, eq(items.id, activityLog.itemId))
    .where(eq(activityLog.workspaceId, workspaceId))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);
}
