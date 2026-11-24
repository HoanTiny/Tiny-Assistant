"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { addItemTags, createItem, getItem, getItemTags, linkItems, removeItemTag, updateItem } from "@/lib/items";
import { moduleForItemType, TASK_STATUSES } from "@/lib/modules";

const ctxOf = (u: { id: string; workspaceId: string }) => ({ userId: u.id, workspaceId: u.workspaceId });

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(`${v}T00:00:00`) : null));

const taskStatus = z.enum(TASK_STATUSES.map((s) => s.value) as [string, ...string[]]);

// ───────── Công việc ─────────

const newTaskSchema = z.object({
  title: z.string().trim().min(1).max(500),
  priority: z.coerce.number().int().min(0).max(3).default(0),
  dueAt: optionalDate,
});

export async function createTask(formData: FormData) {
  const user = await requireUser();
  const parsed = newTaskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await createItem(ctxOf(user), { type: "task", status: "todo", ...parsed.data });
  refresh();
}

export async function setTaskStatus(id: string, status: string) {
  const user = await requireUser();
  const parsed = taskStatus.safeParse(status);
  if (!parsed.success) return;
  await updateItem(ctxOf(user), id, { status: parsed.data });
  refresh();
}

// ───────── Ghi chú ─────────

export async function createNote(formData: FormData) {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim() || "Ghi chú mới";
  const note = await createItem(ctxOf(user), { type: "note", title: title.slice(0, 500) });
  redirect(`/items/${note.id}`);
}

// ───────── Item chung ─────────

export type SaveState = { ok?: boolean; error?: string; savedAt?: number } | undefined;

const saveSchema = z.object({
  id: z.uuid(),
  /** Đổi loại: chỉ giữa công việc và ghi chú */
  type: z.enum(["task", "note"]).optional(),
  title: z.string().trim().min(1, "Tiêu đề không được trống").max(500),
  content: z.string().max(200_000).default(""),
  status: z.string().optional(),
  priority: z.coerce.number().int().min(0).max(3).optional(),
  dueAt: optionalDate,
});

export async function saveItem(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const user = await requireUser();
  const parsed = saveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { id, type, status, ...rest } = parsed.data;
  const item = await getItem(user.workspaceId, id);
  if (!item) return { error: "Không tìm thấy mục" };

  // Chỉ công việc và ghi chú được đổi qua lại; các loại khác (bản tin...) giữ nguyên
  const canSwitch = item.type === "task" || item.type === "note";
  const nextType = canSwitch && type ? type : item.type;

  const values: Parameters<typeof updateItem>[2] = { ...rest };
  if (nextType !== item.type) values.type = nextType;

  if (nextType === "task") {
    values.status = status && taskStatus.safeParse(status).success ? status : (item.status ?? "todo");
  } else {
    // Ghi chú không có trạng thái, ưu tiên, hạn chót
    values.status = null;
    values.priority = 0;
    values.dueAt = null;
  }

  await updateItem(ctxOf(user), id, values);
  refresh();
  return { ok: true, savedAt: Date.now() };
}

export async function archiveItem(id: string) {
  const user = await requireUser();
  const item = await updateItem(ctxOf(user), id, { archivedAt: new Date() });
  redirect(moduleForItemType(item?.type ?? "")?.href ?? "/");
}

/** Đưa mục đã ẩn trở lại danh sách */
export async function restoreItem(id: string) {
  const user = await requireUser();
  await updateItem(ctxOf(user), id, { archivedAt: null });
  refresh();
}

// ───────── Tag ─────────

const tagName = z
  .string()
  .trim()
  .transform((s) => s.replace(/^#+/, "").toLowerCase())
  .pipe(z.string().min(1, "Tag trống").max(40, "Tag tối đa 40 ký tự"));

export async function addTagToItem(itemId: string, name: string): Promise<{ tags?: string[]; error?: string }> {
  const user = await requireUser();
  const parsed = tagName.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const item = await getItem(user.workspaceId, itemId);
  if (!item) return { error: "Không tìm thấy mục" };
  await addItemTags(user.workspaceId, itemId, [parsed.data]);
  refresh();
  return { tags: (await getItemTags([itemId])).get(itemId) ?? [] };
}

export async function removeTagFromItem(itemId: string, name: string): Promise<{ tags?: string[]; error?: string }> {
  const user = await requireUser();
  const item = await getItem(user.workspaceId, itemId);
  if (!item) return { error: "Không tìm thấy mục" };
  await removeItemTag(user.workspaceId, itemId, name);
  refresh();
  return { tags: (await getItemTags([itemId])).get(itemId) ?? [] };
}

/** Lưu kết quả AI thành một ghi chú mới, liên kết với item gốc */
export async function saveAiResultAsNote(sourceId: string, title: string, content: string): Promise<string | null> {
  const user = await requireUser();
  const source = await getItem(user.workspaceId, sourceId);
  if (!source) return null;
  const note = await createItem(ctxOf(user), {
    type: "note",
    title: `${title}: ${source.title}`.slice(0, 500),
    content,
    data: { source: "ai" },
  });
  await linkItems(note.id, source.id, "derived_from");
  refresh();
  return note.id;
}
