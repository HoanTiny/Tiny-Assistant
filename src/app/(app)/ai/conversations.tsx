import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { getDb, schema } from "@/lib/db";
import { buttonClass } from "@/components/ui";
import { cn, formatDateTime } from "@/lib/utils";

/** Danh sách cuộc trò chuyện AI gần đây */
export async function Conversations({ workspaceId, activeId }: { workspaceId: string; activeId?: string }) {
  const db = await getDb();
  const { aiConversations } = schema;
  const rows = await db
    .select({ id: aiConversations.id, title: aiConversations.title, updatedAt: aiConversations.updatedAt })
    .from(aiConversations)
    .where(eq(aiConversations.workspaceId, workspaceId))
    .orderBy(desc(aiConversations.updatedAt))
    .limit(30);

  return (
    <div className="space-y-2">
      <Link href="/ai" className={buttonClass("secondary", "sm", "w-full")}>
        <Plus size={14} /> Cuộc trò chuyện mới
      </Link>
      <ul className="space-y-0.5">
        {rows.map((c) => (
          <li key={c.id}>
            <Link
              href={`/ai/${c.id}`}
              className={cn(
                "block rounded-lg px-3 py-2 text-sm",
                c.id === activeId ? "bg-accent text-accent-foreground" : "hover:bg-muted",
              )}
            >
              <div className="truncate">{c.title}</div>
              <div className="text-xs text-muted-foreground">{formatDateTime(c.updatedAt)}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
