import type { Metadata } from "next";
import { ArchiveRestore, CheckSquare } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { listArchived } from "@/lib/items";
import { moduleForItemType } from "@/lib/modules";
import { Badge, Card, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { restoreItem } from "../actions";

export const metadata: Metadata = { title: "Đã ẩn" };

/** Các mục đã ẩn khỏi danh sách; khôi phục để chúng xuất hiện lại */
export default async function ArchivedPage() {
  const user = await requireUser();
  const items = await listArchived(user.workspaceId);

  return (
    <>
      <PageHeader title="Đã ẩn" description="Các mục bạn đã ẩn khỏi danh sách. Khôi phục để chúng xuất hiện lại như cũ." />

      {items.length === 0 ? (
        <EmptyState title="Không có mục nào bị ẩn">Khi bạn bấm “Ẩn khỏi danh sách” ở một mục, mục đó sẽ nằm ở đây.</EmptyState>
      ) : (
        <Card>
          <ul className="divide-y">
            {items.map((it) => {
              const mod = moduleForItemType(it.type);
              const Icon = mod?.icon ?? CheckSquare;
              return (
                <li key={it.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-field text-muted-foreground" aria-hidden="true">
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-foreground">{it.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge>{mod?.label ?? it.type}</Badge>
                      <span>Ẩn lúc {formatDateTime(it.archivedAt)}</span>
                    </div>
                  </div>
                  <form action={restoreItem.bind(null, it.id)}>
                    <button type="submit" className={buttonClass("secondary", "sm")}>
                      <ArchiveRestore size={15} /> Khôi phục
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
