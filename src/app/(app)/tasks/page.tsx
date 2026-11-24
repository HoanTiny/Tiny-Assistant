import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { listItems } from "@/lib/items";
import { PRIORITIES, TASK_STATUSES } from "@/lib/modules";
import { Badge, Card, PageHeader, priorityTone } from "@/components/ui";
import { cn, formatDue } from "@/lib/utils";
import { QuickAddTask } from "./quick-add-task";
import { TaskStatusButton } from "./task-status-button";

export const metadata: Metadata = { title: "Công việc" };

const DOT: Record<string, string> = { todo: "bg-muted-foreground/50", doing: "bg-primary", done: "bg-success" };

export default async function TasksPage() {
  const user = await requireUser();
  const tasks = await listItems(user.workspaceId, "task");
  const now = new Date();

  return (
    <>
      <PageHeader title="Công việc" description="Bấm vào vòng tròn để đổi trạng thái, bấm tên để xem chi tiết và dùng AI." />
      <Card className="mb-6 p-4">
        <QuickAddTask />
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {TASK_STATUSES.map((s) => {
          const group = tasks.filter((t) => (t.status ?? "todo") === s.value);
          return (
            <Card key={s.value} className="flex flex-col">
              <div className="flex items-center gap-2.5 border-b px-5 py-4">
                <span className={cn("h-2.5 w-2.5 rounded-full", DOT[s.value])} aria-hidden="true" />
                <h2 className="text-lg font-bold">{s.label}</h2>
                <Badge className="ml-auto">{group.length}</Badge>
              </div>
              {group.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">Không có việc nào.</p>
              ) : (
                <ul className="divide-y">
                  {group.map((t) => {
                    const late = s.value !== "done" && t.dueAt && t.dueAt < now;
                    return (
                      <li key={t.id} className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-hover">
                        <span className="mt-0.5">
                          <TaskStatusButton id={t.id} status={t.status ?? "todo"} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/items/${t.id}`}
                            className={cn(
                              "block truncate text-sm font-bold hover:text-primary",
                              s.value === "done" && "font-medium text-muted-foreground line-through",
                            )}
                          >
                            {t.title}
                          </Link>
                          {(t.priority > 0 || t.dueAt) && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {t.priority > 0 && (
                                <Badge tone={priorityTone(t.priority)}>
                                  {PRIORITIES[t.priority]?.label}
                                </Badge>
                              )}
                              {t.dueAt && <Badge tone={late ? "danger" : "muted"}>{late ? `Trễ, ${formatDue(t.dueAt)}` : formatDue(t.dueAt)}</Badge>}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
