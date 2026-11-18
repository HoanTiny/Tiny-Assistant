import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Archive, Link2 } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { getItem, getItemTags, getLinkedItems } from "@/lib/items";
import { ITEM_ACTIONS } from "@/lib/ai/prompts";
import { moduleForItemType } from "@/lib/modules";
import { Badge, Button, Card } from "@/components/ui";
import { ItemAIPanel } from "@/components/ai/item-ai-panel";
import { formatDateTime } from "@/lib/utils";
import { archiveItem } from "../../actions";
import { ItemEditor } from "./item-editor";

const LINK_LABEL: Record<string, string> = { derived_from: "Tạo từ", related: "Liên quan" };

/** Trang chi tiết dùng chung cho mọi loại item (task, note, ...) */
export default async function ItemPage({ params }: PageProps<"/items/[id]">) {
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
    <>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href={mod?.href ?? "/"} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} /> {mod?.label ?? "Quay lại"}
        </Link>
        <form action={archiveItem.bind(null, item.id)}>
          <Button type="submit" variant="ghost" size="sm" title="Lưu trữ (ẩn khỏi danh sách)">
            <Archive size={14} /> Lưu trữ
          </Button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
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
          />
          {tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <Badge key={t} tone="accent">
                  #{t}
                </Badge>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Tạo {formatDateTime(item.createdAt)} · Sửa lần cuối {formatDateTime(item.updatedAt)}
          </p>
        </div>

        <aside className="space-y-4 lg:col-span-2">
          <ItemAIPanel itemId={item.id} actions={actions} />
          {linked.length > 0 && (
            <Card className="p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Link2 size={14} /> Liên kết
              </div>
              <ul className="space-y-1.5">
                {linked.map((l) => (
                  <li key={l.id} className="flex items-center gap-2 text-sm">
                    <Badge>{LINK_LABEL[l.kind] ?? l.kind}</Badge>
                    <Link href={`/items/${l.id}`} className="truncate hover:text-primary">
                      {l.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
