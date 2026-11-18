import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { listItems } from "@/lib/items";
import { PRIORITIES, TASK_STATUSES } from "@/lib/modules";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { cn, formatDue } from "@/lib/utils";
import { QuickAddTask } from "./quick-add-task";
import { TaskStatusButton } from "./task-status-button";

export const metadata: Metadata = { title: "Công việc" };

export default async function TasksPage() {
  const user = await requireUser();
  const tasks = await listItems(user.workspaceId, "task");
  const now = new Date();

  return (
    <>
      <PageHeader title="Công việc" description="Bấm vào vòng tròn để đổi trạng thái, bấm tên để xem chi tiết và dùng AI." />
      <Card className="p-4">
        <QuickAddTask />
      </Card>

      <div className="mt-6 space-y-6">
        {TASK_STATUSES.map((s) => {
          const group = tasks.filter((t) => (t.status ?? "todo") === s.value);
          return (
            <section key={s.value}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                {s.label} <Badge>{group.length}</Badge>
              </h2>
              {group.length === 0 ? (
                <EmptyState>Không có việc nào.</EmptyState>
              ) : (
                <Card className="divide-y">
                  {group.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                      <TaskStatusButton id={t.id} status={t.status ?? "todo"} />
                      <Link
                        href={`/items/${t.id}`}
                        className={cn("min-w-0 flex-1 truncate text-sm hover:text-primary", s.value === "done" && "text-muted-foreground line-through")}
                      >
                        {t.title}
                      </Link>
                      <div className="flex shrink-0 gap-2">
                        {t.priority > 0 && (
                          <Badge tone={t.priority >= 3 ? "danger" : t.priority === 2 ? "warning" : "muted"}>
                            {PRIORITIES[t.priority]?.label}
                          </Badge>
                        )}
                        {t.dueAt && (
                          <Badge tone={s.value !== "done" && t.dueAt < now ? "warning" : "muted"}>{formatDue(t.dueAt)}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </Card>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
