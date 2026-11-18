import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { ChatView } from "@/components/ai/chat-view";
import { PageHeader } from "@/components/ui";
import { Conversations } from "./conversations";

export const metadata: Metadata = { title: "Trợ lý AI" };

export default async function AIPage({ searchParams }: PageProps<"/ai">) {
  const user = await requireUser();
  const { q } = await searchParams;
  const initialPrompt = typeof q === "string" ? q.slice(0, 5000) : undefined;
  return (
    <>
      <PageHeader title="Trợ lý AI" description="Trợ lý xem và sửa được công việc, ghi chú của bạn. Lịch sử được lưu lại." />
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="hidden lg:block">
          <Conversations workspaceId={user.workspaceId} />
        </div>
        <ChatView key={initialPrompt ?? "new"} initialMessages={[]} initialPrompt={initialPrompt} />
      </div>
    </>
  );
}
