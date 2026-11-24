import Link from "next/link";
import { and, count, eq, gte, sql, sum } from "drizzle-orm";
import { AlarmClock, CalendarDays, CheckCheck, CheckSquare, ListTodo, NotebookPen, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { getDb, schema } from "@/lib/db";
import { listItems, recentActivity } from "@/lib/items";
import { getCurrentBriefs } from "@/lib/brief";
import { Markdown } from "@/components/markdown";
import { moduleForItemType, PRIORITIES } from "@/lib/modules";
import { Badge, Card, CardTitle, EmptyState, StatTile, buttonClass, priorityTone } from "@/components/ui";
import { cn, formatDateTime, formatDue, formatNumber } from "@/lib/utils";
import { addDays, endOfDay, weekdayName } from "@/lib/time";
import { TaskStatusButton } from "./tasks/task-status-button";

const ACTION_LABEL: Record<string, string> = {
  "item.created": "đã tạo",
  "item.updated": "đã cập nhật",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const db = await getDb();
  const { aiCalls } = schema;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [[usage], tasks, notes, activity, briefs] = await Promise.all([
    db
      .select({ calls: count(), tokens: sum(sql<number>`${aiCalls.inputTokens} + ${aiCalls.outputTokens}`) })
      .from(aiCalls)
      .where(and(eq(aiCalls.workspaceId, user.workspaceId), gte(aiCalls.createdAt, monthStart))),
    listItems(user.workspaceId, "task", { limit: 300 }),
    listItems(user.workspaceId, "note", { limit: 50 }),
    recentActivity(user.workspaceId, 6),
    getCurrentBriefs(user.workspaceId),
  ]);

  const open = tasks.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => t.dueAt && t.dueAt < now);
  const done7 = tasks.filter((t) => t.status === "done" && t.updatedAt >= addDays(now, -7));
  const upcoming = open
    .filter((t) => t.dueAt && t.dueAt >= now && t.dueAt <= endOfDay(addDays(now, 7)))
    .sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime())
    .slice(0, 6);
  const focus = open
    .filter((t) => t.priority >= 2 || (t.dueAt && t.dueAt <= endOfDay(now)) || t.status === "doing")
    .slice(0, 6);
  const recentNotes = [...notes].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 5);

  const hour = now.getHours();
  const greeting = hour < 11 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  const firstName = user.name.trim().split(/\s+/).at(-1) ?? user.name;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Tổng quan */}
          <Card className="p-5">
            <CardTitle
              aside={
                <Link href="/tasks" className={buttonClass("secondary", "sm")}>
                  Tất cả công việc
                </Link>
              }
            >
              {greeting}, {firstName}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {weekdayName(now)}, ngày {now.getDate()} tháng {now.getMonth() + 1} năm {now.getFullYear()}
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <StatTile icon={ListTodo} tint="sky" title="Việc đang mở" value={formatNumber(open.length)} />
              <StatTile icon={CheckCheck} tint="emerald" title="Xong trong 7 ngày" value={formatNumber(done7.length)} />
              <StatTile
                icon={AlarmClock}
                tint="purple"
                title="Đã trễ hạn"
                value={formatNumber(overdue.length)}
              />
            </div>
          </Card>

          {/* Bản tin sáng */}
          <Card className="p-5">
            <CardTitle
              aside={
                <Link href="/brief" className={buttonClass("secondary", "sm")}>
                  {briefs.daily ? "Xem đầy đủ" : "Tạo bản tin"}
                </Link>
              }
            >
              Bản tin sáng
            </CardTitle>
            <div className="mt-4">
              {briefs.daily ? (
                <div className="relative max-h-80 overflow-hidden">
                  <Markdown className="letter">{briefs.daily.content}</Markdown>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card" />
                </div>
              ) : (
                <EmptyState title="Chưa có bản tin hôm nay">App tự viết mỗi sáng khi đang chạy, hoặc bạn tạo ngay trên trang Bản tin.</EmptyState>
              )}
            </div>
          </Card>
        </div>

        {/* Sắp đến hạn */}
        <Card className="p-5 xl:w-[350px] xl:shrink-0">
          <CardTitle>Sắp đến hạn</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Việc có hạn trong 7 ngày tới</p>
          {upcoming.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Không có việc nào sắp đến hạn.</p>
          ) : (
            <ul className="mt-5 space-y-3">
              {upcoming.map((t) => (
                <li key={t.id}>
                  <Link href={`/items/${t.id}`} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-hover">
                    <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-field leading-none">
                      <span className="text-[10px] font-semibold text-muted-foreground">{weekdayName(t.dueAt!).replace("Thứ ", "T")}</span>
                      <span className="mt-1 text-lg font-bold text-foreground">{t.dueAt!.getDate()}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-foreground">{t.title}</span>
                      <span className="text-xs text-muted-foreground">{formatDue(t.dueAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/ai"
            className="mt-6 flex items-center gap-3 rounded-2xl bg-sky-100 p-4 text-neutral-900 transition-opacity hover:opacity-90"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white">
              <Sparkles size={18} />
            </span>
            <span className="min-w-0">
              <span className="block font-bold">Hỏi trợ lý AI</span>
              <span className="block text-xs font-semibold text-neutral-600">
                {formatNumber(Number(usage?.tokens ?? 0))} token, {formatNumber(usage?.calls ?? 0)} lượt tháng này
              </span>
            </span>
          </Link>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Việc hiện tại */}
        <Card className="p-5">
          <CardTitle
            aside={
              <Link href="/tasks" className={buttonClass("secondary", "sm")}>
                Xem tất cả
              </Link>
            }
          >
            Cần tập trung
          </CardTitle>
          {focus.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Không có việc gấp hay ưu tiên cao.</p>
          ) : (
            <ul className="mt-4">
              {focus.map((t, i) => {
                const late = t.dueAt && t.dueAt < now;
                return (
                  <li key={t.id} className={cn("flex items-center justify-between gap-3 py-3", i > 0 && "border-t")}>
                    <div className="flex min-w-0 items-center gap-3">
                      <TaskStatusButton id={t.id} status={t.status ?? "todo"} />
                      <div className="min-w-0">
                        <Link href={`/items/${t.id}`} className="block truncate font-bold text-foreground hover:text-primary">
                          {t.title}
                        </Link>
                        <div className={cn("mt-0.5 flex items-center gap-1 text-xs", late ? "font-semibold text-danger" : "text-muted-foreground")}>
                          <CalendarDays size={14} />
                          {t.dueAt ? `${late ? "Trễ, " : ""}${formatDue(t.dueAt)}` : "Chưa có hạn"}
                        </div>
                      </div>
                    </div>
                    {t.priority > 0 && <Badge tone={priorityTone(t.priority)}>{PRIORITIES[t.priority]?.label}</Badge>}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Hoạt động gần đây */}
        <Card className="p-5">
          <CardTitle>Hoạt động gần đây</CardTitle>
          {activity.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Việc bạn tạo hay sửa sẽ hiện ở đây.</p>
          ) : (
            <ol className="mt-5">
              {activity.map((a, i) => {
                const mod = a.itemType ? moduleForItemType(a.itemType) : undefined;
                const Icon = mod?.icon ?? CheckSquare;
                return (
                  <li key={a.id} className="relative flex gap-3 pb-5 last:pb-0">
                    {i < activity.length - 1 && <span className="absolute left-[17px] top-10 bottom-1 w-px bg-border" aria-hidden="true" />}
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-field text-foreground" aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0 pt-0.5 text-sm">
                      <div>
                        <span className="font-bold text-foreground">{user.name}</span>{" "}
                        <span className="text-muted-foreground">{ACTION_LABEL[a.action] ?? a.action}</span>{" "}
                        {a.itemId && a.itemTitle ? (
                          <Link href={`/items/${a.itemId}`} className="font-semibold text-primary hover:underline">
                            {a.itemTitle}
                          </Link>
                        ) : (
                          "một mục đã xóa"
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        {/* Ghi chú gần đây */}
        <Card className="p-5 md:col-span-2 xl:col-span-1">
          <CardTitle
            aside={
              <Link href="/notes" className={buttonClass("secondary", "sm")}>
                Xem tất cả
              </Link>
            }
          >
            Ghi chú gần đây
          </CardTitle>
          {recentNotes.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Chưa có ghi chú. Gõ Ctrl+K để ghi nhanh ý tưởng.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {recentNotes.map((n) => (
                <li key={n.id}>
                  <Link href={`/items/${n.id}`} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-hover">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 text-neutral-900" aria-hidden="true">
                      <NotebookPen size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-foreground">{n.title}</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(n.updatedAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
