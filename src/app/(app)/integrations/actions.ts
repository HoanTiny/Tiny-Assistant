"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { listLinkedChats, sendMessage, unlinkChat } from "@/lib/telegram";

/** Gửi một tin thử tới chat Telegram đã liên kết */
export async function sendTelegramTest(integrationId: string): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser();
  const chat = (await listLinkedChats(user.workspaceId)).find((c) => c.id === integrationId);
  if (!chat) return { error: "Không tìm thấy chat này" };
  try {
    await sendMessage(chat.chatId, `✅ Tin thử từ WorkHub. Kết nối với <b>${user.workspaceName}</b> đang hoạt động.`);
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Không gửi được" };
  }
}

/** Ngắt kết nối một chat Telegram (chat đó sẽ không nhận bản tin, không ghi việc được nữa) */
export async function unlinkTelegram(integrationId: string) {
  const user = await requireUser();
  await unlinkChat(user.workspaceId, integrationId);
  refresh();
}
