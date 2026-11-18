/**
 * Schema dữ liệu lõi của WorkHub.
 *
 * Nguyên tắc:
 * - Mọi dữ liệu nghiệp vụ đều thuộc một `workspace` → sau này mở rộng cho nhóm chỉ cần thêm thành viên.
 * - Mọi "thứ" (task, note, nội dung, tài liệu...) là một `item` có `type` = key của module.
 *   Trường riêng của từng module để trong `data` (jsonb) → thêm module mới không cần đổi schema.
 * - Tag, liên kết giữa item, nhật ký hoạt động dùng chung cho mọi module → AI đọc được toàn cảnh.
 */
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ───────────────────────── Người dùng & phiên đăng nhập ─────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    /** sha256 của token trong cookie — DB bị lộ cũng không dùng được để đăng nhập */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ───────────────────────── Workspace (sẵn sàng cho nhóm) ─────────────────────────

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export type WorkspaceRole = "owner" | "admin" | "member";

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<WorkspaceRole>().notNull().default("member"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })],
);

// ───────────────────────── Item: đơn vị dữ liệu chung ─────────────────────────

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** key của module: "task", "note", ... */
    type: text("type").notNull(),
    title: text("title").notNull(),
    /** Nội dung dạng Markdown */
    content: text("content").notNull().default(""),
    status: text("status"),
    /** 0 = không, 1 = thấp, 2 = trung bình, 3 = cao */
    priority: integer("priority").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }),
    /** Trường riêng của từng module */
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    parentId: uuid("parent_id"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    index("items_ws_type_idx").on(t.workspaceId, t.type),
    index("items_parent_idx").on(t.parentId),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
  },
  (t) => [uniqueIndex("tags_ws_name_idx").on(t.workspaceId, t.name)],
);

export const itemTags = pgTable(
  "item_tags",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.tagId] })],
);

/** Liên kết có hướng giữa 2 item, ví dụ: note "derived_from" task */
export const itemLinks = pgTable(
  "item_links",
  {
    fromId: uuid("from_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    toId: uuid("to_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("related"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.fromId, t.toId, t.kind] })],
);

export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("activity_ws_created_idx").on(t.workspaceId, t.createdAt)],
);

// ───────────────────────── AI ─────────────────────────

/** Nhật ký mọi lần gọi AI: để theo dõi chi phí và debug */
export const aiCalls = pgTable(
  "ai_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    /** Tính năng đã gọi AI: "chat", "item:evaluate", ... */
    feature: text("feature").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    status: text("status").$type<"ok" | "error" | "aborted">().notNull(),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("ai_calls_ws_created_idx").on(t.workspaceId, t.createdAt)],
);

export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("ai_conv_ws_updated_idx").on(t.workspaceId, t.updatedAt)],
);

export type AiMessageMeta = {
  tools?: { name: string; label: string; ok: boolean; link?: string }[];
};

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant">().notNull(),
    content: text("content").notNull(),
    /** Thông tin thêm, ví dụ các công cụ AI đã dùng khi trả lời */
    meta: jsonb("meta").$type<AiMessageMeta>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("ai_msg_conv_idx").on(t.conversationId, t.createdAt)],
);

// ───────────────────────── Kết nối dịch vụ ngoài ─────────────────────────

export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** key trong integrations registry: "google", "notion", ... */
    provider: text("provider").notNull(),
    /** Tên tài khoản hiển thị, ví dụ email Google đã kết nối */
    accountLabel: text("account_label").notNull().default(""),
    /** JSON token/khóa đã MÃ HÓA bằng APP_SECRET (xem lib/crypto.ts) */
    credentials: text("credentials").notNull(),
    scopes: text("scopes").array().notNull().default(sql`'{}'::text[]`),
    status: text("status").$type<"active" | "error" | "revoked">().notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("integrations_ws_provider_account_idx").on(
      t.workspaceId,
      t.provider,
      t.accountLabel,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type AiCall = typeof aiCalls.$inferSelect;
