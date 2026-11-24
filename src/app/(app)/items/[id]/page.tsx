import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Archive, ArrowUpRight, ChevronRight, Link2 } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { getItem, getItemTags, getLinkedItems } from "@/lib/items";
import { ITEM_ACTIONS } from "@/lib/ai/prompts";
import { moduleForItemType } from "@/lib/modules";
import { Badge, Card } from "@/components/ui";
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
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      {/* Thanh breadcrumb tối giản */}
      <div className="flex items-center justify-between gap-3">
        <nav aria-label="Điều hướng" className="flex min-w-0 items-center gap-1.5 text-sm">
          <Link
            href={mod?.href ?? "/"}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            <ArrowLeft size={15} />
            <span>{mod?.label ?? "Quay lại"}</span>
          </Link>
          <ChevronRight size={14} className="shrink-0 text-muted-foreground/50" />
          <span className="truncate font-semibold text-foreground/80">{item.title}</span>
        </nav>

        <form action={archiveItem.bind(null, item.id)} className="shrink-0">
          <button
            type="submit"
            title="Mục này sẽ không còn hiện trong danh sách. Dữ liệu vẫn được giữ lại."
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <Archive size={14} />
            <span>Ẩn khỏi danh sách</span>
          </button>
        </form>
      </div>

      {/* Bố cục studio 2 cột: tài liệu chính + AI Copilot bên phải */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 xl:col-span-8">
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
            typeLabel={mod?.label ?? item.type}
            tags={tags}
            createdLabel={formatDateTime(item.createdAt)}
            updatedLabel={formatDateTime(item.updatedAt)}
          />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:col-span-5 xl:col-span-4">
          <ItemAIPanel itemId={item.id} actions={actions} />
          {linked.length > 0 && (
            <Card className="rounded-3xl border-border/80 p-5 shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)]">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Link2 size={14} className="text-primary" /> Mục liên kết ({linked.length})
              </div>
              <ul className="space-y-2">
                {linked.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/items/${l.id}`}
                      className="group flex items-center justify-between gap-2 rounded-2xl border border-border/70 bg-muted/25 px-3 py-2.5 text-sm transition-all hover:border-primary/40 hover:bg-muted/60"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Badge>{LINK_LABEL[l.kind] ?? l.kind}</Badge>
                        <span className="truncate font-semibold text-foreground group-hover:text-primary">{l.title}</span>
                      </span>
                      <ArrowUpRight
                        size={14}
                        className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary"
                      />
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

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
