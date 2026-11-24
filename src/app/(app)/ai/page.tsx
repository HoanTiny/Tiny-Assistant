import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { ChatView } from "@/components/ai/chat-view";
import { getRecentConversations } from "./conversations";

export const metadata: Metadata = { title: "Trợ lý AI" };

export default async function AIPage({ searchParams }: PageProps<"/ai">) {
  const user = await requireUser();
  const [{ q }, conversations] = await Promise.all([searchParams, getRecentConversations(user.workspaceId)]);
  const initialPrompt = typeof q === "string" ? q.slice(0, 5000) : undefined;
  return (
    <ChatView
      key={initialPrompt ?? "new"}
      initialMessages={[]}
      initialPrompt={initialPrompt}
      conversations={conversations}
    />
  );
}
