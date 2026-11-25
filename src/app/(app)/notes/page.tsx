import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { listItems } from "@/lib/items";
import { Button, Card, EmptyState, Input, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { createNote } from "../actions";

export const metadata: Metadata = { title: "Ghi chú" };

async function NotesList() {
  const user = await requireUser();
  const notes = (await listItems(user.workspaceId, "note")).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  if (notes.length === 0) return <EmptyState>Chưa có ghi chú nào.</EmptyState>;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {notes.map((n) => (
        <Link key={n.id} href={`/items/${n.id}`}>
          <Card className="h-full p-4 transition-colors hover:bg-muted/50">
            <div className="truncate font-medium">{n.title}</div>
            <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
              {n.content.replace(/[#*_`>\-\[\]]/g, "").slice(0, 240) || "(trống)"}
            </p>
            <div className="mt-2 text-xs text-muted-foreground">{formatDateTime(n.updatedAt)}</div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export default function NotesPage() {
  return (
    <>
      <PageHeader title="Ghi chú" description="Ghi chép, ý tưởng, biên bản họp... Viết bằng Markdown." />
      <Card className="p-4">
        <form action={createNote} className="flex gap-2">
          <Input name="title" placeholder="Tiêu đề ghi chú mới..." aria-label="Tiêu đề ghi chú" className="flex-1" />
          <Button type="submit">
            <Plus size={16} /> Tạo
          </Button>
        </form>
      </Card>

      <div className="mt-6">
        <Suspense
          fallback={
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-busy="true">
              {Array.from({ length: 4 }, (_, idx) => (
                <div key={idx} className="h-28 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          }
        >
          <NotesList />
        </Suspense>
      </div>
    </>
  );
}
