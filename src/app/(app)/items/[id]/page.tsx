import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ArrowUpRight, Link2 } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { getItem, getItemTags, getLinkedItems } from "@/lib/items";
import { ITEM_ACTIONS } from "@/lib/ai/prompts";
import { moduleForItemType } from "@/lib/modules";
import { Badge, Card } from "@/components/ui";
import { ItemAIPanel } from "@/components/ai/item-ai-panel";
import { formatDateTime } from "@/lib/utils";
import { archiveItem } from "../../actions";
import { ItemEditor } from "./item-editor";
import { ArchiveButton } from "./archive-button";

const LINK_LABEL: Record<string, string> = { derived_from: "Tạo từ", related: "Liên quan" };

async function ItemContent({ params }: { params: PageProps<"/items/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const item = await getItem(user.workspaceId, id);
  if (!item || item.archivedAt) notFound();

  const [linked, tagMap] = await Promise.all([getLinkedItems(user.workspaceId, item.id), getItemTags([item.id])]);
  const tags = tagMap.get(item.id) ?? [];
  const mod = moduleForItemType(item.type);
  const actions = Object.entries(ITEM_ACTIONS).map(([key, a]) => ({ key, label: a.label, description: a.description }));

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Thanh trên gọn nhẹ */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href={mod?.href ?? "/"}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
        >
          <ArrowLeft size={16} />
          <span>{mod?.label ?? "Quay lại"}</span>
        </Link>

        <ArchiveButton action={archiveItem.bind(null, item.id)} />
      </div>

      {/* Bố cục rộng toàn khung: vùng viết lớn bên trái + cột AI gọn 360px bên phải */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ItemEditor
          item={{
            id: item.id,
            type: item.type,
            title: item.title,
            content: item.content,
            status: item.status,
            priority: item.priority,
            dueAt: item.dueAt ? toDateInput(item.dueAt) : null,
          }}
          tags={tags}
          createdLabel={formatDateTime(item.createdAt)}
          updatedLabel={formatDateTime(item.updatedAt)}
        />

        <aside className="space-y-4 xl:sticky xl:top-6">
          <ItemAIPanel itemId={item.id} actions={actions} />
          {linked.length > 0 && (
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Link2 size={14} className="text-primary" /> Liên kết ({linked.length})
              </div>
              <ul className="space-y-1.5">
                {linked.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/items/${l.id}`}
                      className="group flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-sm transition-colors hover:bg-muted/60"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Badge>{LINK_LABEL[l.kind] ?? l.kind}</Badge>
                        <span className="truncate font-medium text-foreground group-hover:text-primary">{l.title}</span>
                      </span>
                      <ArrowUpRight size={14} className="shrink-0 text-muted-foreground group-hover:text-primary" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Trang chi tiết dùng chung cho mọi loại item (task, note, ...) */
export default function ItemPage({ params }: PageProps<"/items/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]" aria-busy="true">
          <div className="h-[520px] animate-pulse rounded-2xl bg-muted" />
          <div className="h-52 animate-pulse rounded-2xl bg-muted" />
        </div>
      }
    >
      <ItemContent params={params} />
    </Suspense>
  );
}

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
