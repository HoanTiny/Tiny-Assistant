import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { ChatView } from "@/components/ai/chat-view";
import { getRecentConversations } from "./conversations";

export const metadata: Metadata = { title: "Trợ lý AI" };

async function AIWorkspace({ searchParams }: { searchParams: PageProps<"/ai">["searchParams"] }) {
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

export default function AIPage({ searchParams }: PageProps<"/ai">) {
  return (
    <Suspense
      fallback={<div className="h-[calc(100vh-7.5rem)] min-h-[560px] w-full animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <AIWorkspace searchParams={searchParams} />
    </Suspense>
  );
}
