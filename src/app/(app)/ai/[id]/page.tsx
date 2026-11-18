import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/dal";
import { getDb, schema } from "@/lib/db";
import { ChatView } from "@/components/ai/chat-view";
import { PageHeader } from "@/components/ui";
import { Conversations } from "../conversations";

export default async function ConversationPage({ params }: PageProps<"/ai/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const db = await getDb();
  const { aiConversations, aiMessages } = schema;
  const [conv] = await db
    .select()
    .from(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.workspaceId, user.workspaceId)))
    .limit(1);
  if (!conv) notFound();

  const messages = await db
    .select({ id: aiMessages.id, role: aiMessages.role, content: aiMessages.content, meta: aiMessages.meta })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, id))
    .orderBy(asc(aiMessages.createdAt));

  return (
    <>
      <PageHeader title={conv.title} description={`${conv.provider} · ${conv.model}`} />
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="hidden lg:block">
          <Conversations workspaceId={user.workspaceId} activeId={id} />
        </div>
        <ChatView
          key={id}
          conversationId={id}
          initialMessages={messages.map(({ meta, ...m }) => ({ ...m, tools: meta.tools }))}
        />
      </div>
    </>
  );
}
