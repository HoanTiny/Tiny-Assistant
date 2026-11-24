/**
 * Bot Telegram cho WorkHub.
 *
 *   - Liên kết: mở link t.me/<bot>?start=<mã> (mã lấy ở trang Kết nối) → chat được gắn với workspace.
 *   - Nhắn một câu bất kỳ  → AI ghi thành công việc / ghi chú (giống ô Ctrl+K).
 *   - /viec                → việc quá hạn, hôm nay, đang làm.
 *   - /bantin              → bản tin sáng hôm nay (tạo nếu chưa có).
 *   - Bản tin tự động lúc 7h được gửi về mọi chat đã liên kết.
 *
 * Bot nhận tin bằng "long polling" (hỏi Telegram liên tục), không cần tên miền hay webhook,
 * nên chạy được cả trên máy cá nhân lẫn VPS. Mỗi bot token chỉ nên chạy ở MỘT nơi một lúc.
 */
import "server-only";
import { createHmac } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { clearFailures, lockedMinutes, recordFailure } from "@/lib/auth/guards";

const API = "https://api.telegram.org";

export function telegramToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

type TgResult<T> = { ok: boolean; result?: T; description?: string; error_code?: number };

export class TelegramError extends Error {
  constructor(
    message: string,
    public code?: number,
  ) {
    super(message);
  }
}

async function tg<T>(method: string, body: Record<string, unknown> = {}, signal?: AbortSignal): Promise<T> {
  const token = telegramToken();
  if (!token) throw new TelegramError("Chưa đặt TELEGRAM_BOT_TOKEN");
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = (await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }))) as TgResult<T>;
  if (!data.ok) throw new TelegramError(data.description ?? "Lỗi Telegram", data.error_code ?? res.status);
  return data.result as T;
}

// ───────────────────────── Thông tin bot ─────────────────────────

let botCache: { at: number; username: string } | null = null;

/** Tên bot (@username). Trả lỗi dễ hiểu nếu token sai. */
export async function getBotUsername(): Promise<string> {
  if (botCache && Date.now() - botCache.at < 10 * 60 * 1000) return botCache.username;
  const me = await tg<{ username: string }>("getMe");
  botCache = { at: Date.now(), username: me.username };
  return me.username;
}

// ───────────────────────── Mã liên kết ─────────────────────────

/** Mã liên kết cố định cho mỗi workspace (suy ra từ APP_SECRET, không cần lưu) */
export function linkCode(workspaceId: string): string {
  const secret = process.env.APP_SECRET ?? "";
  return createHmac("sha256", secret).update(`telegram-link:${workspaceId}`).digest("hex").slice(0, 10).toUpperCase();
}

async function findOwnerByCode(code: string) {
  const db = await getDb();
  const owners = await db
    .select({ workspaceId: schema.workspaceMembers.workspaceId, userId: schema.workspaceMembers.userId })
    .from(schema.workspaceMembers)
    .where(eq(schema.workspaceMembers.role, "owner"));
  return owners.find((o) => linkCode(o.workspaceId) === code.trim().toUpperCase()) ?? null;
}

// ───────────────────────── Chat đã liên kết ─────────────────────────

type ChatCreds = { chatId: number; name: string };
export type LinkedChat = { id: string; chatId: number; name: string; linkedAt: Date };

export async function listLinkedChats(workspaceId: string): Promise<LinkedChat[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.integrations)
    .where(and(eq(schema.integrations.workspaceId, workspaceId), eq(schema.integrations.provider, "telegram")));
  return rows.flatMap((r) => {
    try {
      const c = decryptJson<ChatCreds>(r.credentials);
      return [{ id: r.id, chatId: c.chatId, name: c.name, linkedAt: r.createdAt }];
    } catch {
      return [];
    }
  });
}

async function linkChat(workspaceId: string, chatId: number, name: string) {
  const db = await getDb();
  await db
    .insert(schema.integrations)
    .values({
      workspaceId,
      provider: "telegram",
      accountLabel: String(chatId),
      credentials: encryptJson({ chatId, name } satisfies ChatCreds),
    })
    .onConflictDoUpdate({
      target: [schema.integrations.workspaceId, schema.integrations.provider, schema.integrations.accountLabel],
      set: { credentials: encryptJson({ chatId, name } satisfies ChatCreds), status: "active", updatedAt: new Date() },
    });
}

export async function unlinkChat(workspaceId: string, integrationId: string) {
  const db = await getDb();
  await db
    .delete(schema.integrations)
    .where(
      and(
        eq(schema.integrations.workspaceId, workspaceId),
        eq(schema.integrations.provider, "telegram"),
        eq(schema.integrations.id, integrationId),
      ),
    );
}

/** Chat này thuộc workspace nào (và chủ sở hữu là ai) */
async function ownerOfChat(chatId: number) {
  const db = await getDb();
  const [row] = await db
    .select({ workspaceId: schema.integrations.workspaceId, userId: schema.workspaceMembers.userId, name: schema.users.name })
    .from(schema.integrations)
    .innerJoin(
      schema.workspaceMembers,
      and(eq(schema.workspaceMembers.workspaceId, schema.integrations.workspaceId), eq(schema.workspaceMembers.role, "owner")),
    )
    .innerJoin(schema.users, eq(schema.users.id, schema.workspaceMembers.userId))
    .where(and(eq(schema.integrations.provider, "telegram"), eq(schema.integrations.accountLabel, String(chatId))))
    .limit(1);
  return row ?? null;
}

// ───────────────────────── Gửi tin ─────────────────────────

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Chuyển Markdown đơn giản (kết quả AI) sang HTML mà Telegram hiểu */
export function markdownToTelegramHtml(md: string): string {
  return md
    .split("\n")
    .map((line) => {
      let l = escapeHtml(line);
      const heading = l.match(/^#{1,6}\s+(.*)$/);
      if (heading) return `<b>${heading[1]}</b>`;
      l = l
        .replace(/^(\s*)[-*]\s+\[ \]\s+/, "$1☐ ")
        .replace(/^(\s*)[-*]\s+\[[xX]\]\s+/, "$1☑ ")
        .replace(/^(\s*)[-*]\s+/, "$1• ");
      return l
        .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Chia tin dài theo dòng (Telegram giới hạn 4096 ký tự mỗi tin) */
function chunk(text: string, max = 3800): string[] {
  const parts: string[] = [];
  let cur = "";
  for (const line of text.split("\n")) {
    if (cur && cur.length + line.length + 1 > max) {
      parts.push(cur);
      cur = "";
    }
    cur = cur ? `${cur}\n${line}` : line.slice(0, max);
  }
  if (cur) parts.push(cur);
  return parts;
}

export async function sendMessage(chatId: number, html: string) {
  for (const part of chunk(html)) {
    await tg("sendMessage", { chat_id: chatId, text: part, parse_mode: "HTML", link_preview_options: { is_disabled: true } });
  }
}

/** Gửi một bản Markdown tới mọi chat đã liên kết với workspace. Lỗi từng chat không làm hỏng chat khác. */
export async function notifyWorkspace(workspaceId: string, markdown: string) {
  if (!telegramToken()) return;
  const chats = await listLinkedChats(workspaceId);
  const html = markdownToTelegramHtml(markdown);
  for (const c of chats) {
    try {
      await sendMessage(c.chatId, html);
    } catch (err) {
      console.error(`[telegram] Không gửi được tới chat ${c.chatId}:`, err);
    }
  }
}

// ───────────────────────── Xử lý tin nhắn đến ─────────────────────────

const HELP = `<b>WorkHub bot</b>
• Nhắn một câu bất kỳ để ghi việc hoặc ghi chú, ví dụ: <i>Thứ 6 gửi báo cáo cho anh Nam, gấp</i>
• /viec – việc quá hạn, hôm nay và đang làm
• /bantin – bản tin sáng hôm nay
• /help – xem lại hướng dẫn`;

const NOT_LINKED = `Chat này chưa kết nối với WorkHub.
Mở WorkHub → <b>Kết nối</b> → <b>Telegram</b>, bấm nút mở bot (hoặc gửi <code>/start MÃ</code> với mã hiển thị ở đó).`;

function appLink(path: string): string | null {
  const base = process.env.APP_URL || (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : "");
  return base ? `${base.replace(/\/$/, "")}${path}` : null;
}

type TgMessage = { chat: { id: number; type: string; title?: string; first_name?: string; username?: string }; text?: string };

async function reply(chatId: number, html: string) {
  try {
    await sendMessage(chatId, html);
  } catch (err) {
    console.error("[telegram] Không trả lời được:", err);
  }
}

export async function handleMessage(msg: TgMessage) {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  if (!text) return;

  const [command, ...args] = text.split(/\s+/);
  const cmd = command.startsWith("/") ? command.slice(1).split("@")[0].toLowerCase() : null;

  // /start <mã>: liên kết chat với workspace (giới hạn số lần thử sai để không dò được mã)
  if (cmd === "start") {
    const code = args[0];
    if (!code) {
      const owner = await ownerOfChat(chatId);
      return reply(chatId, owner ? HELP : NOT_LINKED);
    }
    const keys = [`tg-link:${chatId}`];
    const wait = lockedMinutes(keys);
    if (wait) return reply(chatId, `Nhập sai mã quá nhiều lần. Thử lại sau ${wait} phút.`);
    const owner = await findOwnerByCode(code);
    if (!owner) {
      recordFailure(keys);
      return reply(chatId, "Mã liên kết không đúng. Lấy mã ở WorkHub → Kết nối → Telegram.");
    }
    clearFailures(keys);
    const name = msg.chat.title || [msg.chat.first_name, msg.chat.username && `@${msg.chat.username}`].filter(Boolean).join(" ") || String(chatId);
    await linkChat(owner.workspaceId, chatId, name);
    return reply(chatId, `✅ Đã kết nối với WorkHub.\n\n${HELP}`);
  }

  const owner = await ownerOfChat(chatId);
  if (!owner) return reply(chatId, NOT_LINKED);
  const ctx = { id: owner.userId, userId: owner.userId, workspaceId: owner.workspaceId };

  if (cmd === "help") return reply(chatId, HELP);

  if (cmd === "viec" || cmd === "today") {
    const { listTasksBy } = await import("@/lib/items");
    const { formatDue } = await import("@/lib/utils");
    const [overdue, today, doing] = await Promise.all([
      listTasksBy(owner.workspaceId, "overdue", 10),
      listTasksBy(owner.workspaceId, "today", 10),
      listTasksBy(owner.workspaceId, "doing", 10),
    ]);
    const line = (t: { title: string; dueAt: Date | null; priority: number }) =>
      `• ${escapeHtml(t.title)}${t.dueAt ? ` <i>(${formatDue(t.dueAt)})</i>` : ""}${t.priority >= 3 ? " ❗" : ""}`;
    const sections = [
      overdue.length ? `<b>⚠️ Quá hạn</b>\n${overdue.map(line).join("\n")}` : null,
      today.length ? `<b>📅 Hôm nay</b>\n${today.map(line).join("\n")}` : null,
      doing.length ? `<b>⏳ Đang làm</b>\n${doing.map(line).join("\n")}` : null,
    ].filter(Boolean);
    return reply(chatId, sections.length ? sections.join("\n\n") : "Không có việc quá hạn, đến hạn hôm nay hay đang làm. 🎉");
  }

  if (cmd === "bantin" || cmd === "brief") {
    const { briefMessages, getCurrentBriefs, saveBrief } = await import("@/lib/brief");
    const { daily } = await getCurrentBriefs(owner.workspaceId);
    if (daily) return reply(chatId, markdownToTelegramHtml(daily.content));
    const { defaultProviderId, generateAI } = await import("@/lib/ai");
    const provider = defaultProviderId();
    if (!provider) return reply(chatId, "Chưa có bản tin hôm nay và chưa cấu hình API key AI để tạo.");
    await reply(chatId, "Đang viết bản tin, chờ chút…");
    try {
      const content = await generateAI({
        provider,
        feature: "brief:daily:telegram",
        user: { id: owner.userId, workspaceId: owner.workspaceId },
        messages: await briefMessages({ workspaceId: owner.workspaceId, name: owner.name }, "daily"),
      });
      await saveBrief(ctx, "daily", content);
      return reply(chatId, markdownToTelegramHtml(content));
    } catch (err) {
      console.error("[telegram] Lỗi tạo bản tin:", err);
      return reply(chatId, "Không tạo được bản tin lúc này. Thử lại sau.");
    }
  }

  if (cmd) return reply(chatId, HELP);

  // Câu thường → ghi nhanh như ô Ctrl+K
  const { captureText } = await import("@/lib/capture");
  const { formatDue } = await import("@/lib/utils");
  const result = await captureText(ctx, text);
  const it = result.item;
  const kind = it.type === "task" ? "công việc" : "ghi chú";
  const details = [
    it.dueAt ? `hạn ${formatDue(it.dueAt)}` : null,
    it.priority >= 3 ? "ưu tiên cao" : null,
    it.tags.length ? it.tags.map((t) => `#${t}`).join(" ") : null,
  ].filter(Boolean);
  const link = appLink(`/items/${it.id}`);
  return reply(
    chatId,
    `✅ Đã thêm ${kind}: <b>${escapeHtml(it.title)}</b>${details.length ? `\n${escapeHtml(details.join(", "))}` : ""}` +
      (link ? `\n<a href="${link}">Mở trong WorkHub</a>` : "") +
      (result.warning ? `\n<i>${escapeHtml(result.warning)}</i>` : ""),
  );
}

// ───────────────────────── Vòng nhận tin (long polling) ─────────────────────────

const pollState = globalThis as unknown as { __workhubTelegram?: { running: boolean } };

/** Bắt đầu nhận tin từ Telegram. Gọi một lần khi server khởi động (src/instrumentation.ts). */
export function startTelegramPolling() {
  if (!telegramToken() || process.env.TELEGRAM_POLLING === "off") return;
  if (pollState.__workhubTelegram?.running) return;
  pollState.__workhubTelegram = { running: true };

  void (async () => {
    let offset = 0;
    let warnedConflict = false;
    try {
      // Bot từng đặt webhook thì getUpdates không chạy được → xóa webhook (không xóa tin đang chờ)
      await tg("deleteWebhook", { drop_pending_updates: false });
      console.log(`[telegram] Bot @${await getBotUsername()} đang nhận tin nhắn`);
    } catch (err) {
      console.error("[telegram] Không khởi động được bot (kiểm tra TELEGRAM_BOT_TOKEN):", err);
    }

    for (;;) {
      try {
        const updates = await tg<{ update_id: number; message?: TgMessage }[]>(
          "getUpdates",
          { offset, timeout: 30, allowed_updates: ["message"] },
          AbortSignal.timeout(40_000),
        );
        warnedConflict = false;
        for (const u of updates) {
          offset = u.update_id + 1;
          if (u.message) {
            try {
              await handleMessage(u.message);
            } catch (err) {
              console.error("[telegram] Lỗi xử lý tin nhắn:", err);
            }
          }
        }
      } catch (err) {
        const conflict = err instanceof TelegramError && err.code === 409;
        if (conflict && !warnedConflict) {
          console.error("[telegram] Bot token đang được dùng ở nơi khác (một máy khác cũng đang chạy bot). Đặt TELEGRAM_POLLING=off ở một nơi.");
          warnedConflict = true;
        } else if (!conflict && !(err instanceof Error && err.name === "TimeoutError")) {
          console.error("[telegram] Lỗi nhận tin, thử lại sau:", err instanceof Error ? err.message : err);
        }
        await new Promise((r) => setTimeout(r, conflict ? 30_000 : 5_000));
      }
    }
  })();
}
