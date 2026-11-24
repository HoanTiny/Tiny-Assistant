import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

/** Lấy danh sách cuộc trò chuyện AI gần đây cho thanh bên */
export async function getRecentConversations(workspaceId: string): Promise<ConversationSummary[]> {
  const db = await getDb();
  const { aiConversations } = schema;
  const rows = await db
    .select({ id: aiConversations.id, title: aiConversations.title, updatedAt: aiConversations.updatedAt })
    .from(aiConversations)
    .where(eq(aiConversations.workspaceId, workspaceId))
    .orderBy(desc(aiConversations.updatedAt))
    .limit(40);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
  }));
}
