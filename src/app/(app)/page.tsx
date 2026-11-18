import Link from "next/link";
import { and, count, eq, gte, isNull, ne, sql, sum } from "drizzle-orm";
import { ArrowRight, Newspaper, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { getDb, schema } from "@/lib/db";
import { listItems, recentActivity } from "@/lib/items";
import { getCurrentBriefs } from "@/lib/brief";
import { Markdown } from "@/components/markdown";
import { moduleForItemType } from "@/lib/modules";
import { Badge, Card, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { formatDateTime, formatDue, formatNumber } from "@/lib/utils";
import { QuickAddTask } from "./tasks/quick-add-task";

const ACTION_LABEL: Record<string, string> = {
  "item.created": "Đã tạo",
  "item.updated": "Đã sửa",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const db = await getDb();
  const { items, aiCalls } = schema;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [[openTasks], [notes], [usage], tasks, activity, briefs] = await Promise.all([
    db
      .select({ n: count() })
      .from(items)
      .where(and(eq(items.workspaceId, user.workspaceId), eq(items.type, "task"), ne(items.status, "done"), isNull(items.archivedAt))),
    db
      .select({ n: count() })
      .from(items)
      .where(and(eq(items.workspaceId, user.workspaceId), eq(items.type, "note"), isNull(items.archivedAt))),
    db
      .select({
        calls: count(),
        tokens: sum(sql<number>`${aiCalls.inputTokens} + ${aiCalls.outputTokens}`),
      })
      .from(aiCalls)
      .where(and(eq(aiCalls.workspaceId, user.workspaceId), gte(aiCalls.createdAt, monthStart))),
    listItems(user.workspaceId, "task", { limit: 50 }),
    recentActivity(user.workspaceId, 8),
    getCurrentBriefs(user.workspaceId),
  ]);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const focus = tasks.filter((t) => t.status !== "done" && (t.priority >= 3 || (t.dueAt && t.dueAt <= endOfToday))).slice(0, 6);

  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";

  return (
    <>
      <PageHeader title={`${greeting}, ${user.name}`} description="Tổng quan công việc của bạn hôm nay" />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Việc đang mở" value={formatNumber(openTasks?.n ?? 0)} href="/tasks" />
        <Stat label="Ghi chú" value={formatNumber(notes?.n ?? 0)} href="/notes" />
        <Stat
          label="AI tháng này"
          value={`${formatNumber(Number(usage?.tokens ?? 0))} token`}
          sub={`${formatNumber(usage?.calls ?? 0)} lượt gọi`}
          href="/settings"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <Card className="mb-6 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-medium">
                <Newspaper size={16} className="text-primary" /> Bản tin sáng
              </h2>
              <Link href="/brief" className="text-xs text-muted-foreground hover:text-primary">
                {briefs.daily ? "Xem đầy đủ →" : "Tạo bản tin →"}
              </Link>
            </div>
            {briefs.daily ? (
              <div className="relative max-h-56 overflow-hidden">
                <Markdown>{briefs.daily.content}</Markdown>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có bản tin hôm nay.</p>
            )}
          </Card>

          <h2 className="mb-3 font-medium">Cần tập trung</h2>
          <Card className="p-4">
            <QuickAddTask />
            <div className="mt-3">
              {focus.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Không có việc gấp hoặc ưu tiên cao. Tuyệt!
                </p>
              ) : (
                <ul className="divide-y">
                  {focus.map((t) => (
                    <li key={t.id}>
                      <Link href={`/items/${t.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-primary">
                        <span className="truncate">{t.title}</span>
                        <span className="flex shrink-0 gap-2">
                          {t.priority >= 3 && <Badge tone="danger">Ưu tiên cao</Badge>}
                          {t.dueAt && <Badge tone={t.dueAt < new Date() ? "warning" : "muted"}>{formatDue(t.dueAt)}</Badge>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Sparkles size={18} />
              </span>
              <div>
                <div className="text-sm font-medium">Trợ lý AI</div>
                <div className="text-xs text-muted-foreground">Hỏi, lên kế hoạch, viết nội dung với OpenAI hoặc Gemini</div>
              </div>
            </div>
            <Link href="/ai" className={buttonClass("secondary", "sm")}>
              Mở trợ lý <ArrowRight size={14} />
            </Link>
          </Card>
        </section>

        <section className="lg:col-span-2">
          <h2 className="mb-3 font-medium">Hoạt động gần đây</h2>
          {activity.length === 0 ? (
            <EmptyState>Chưa có hoạt động nào.</EmptyState>
          ) : (
            <Card className="divide-y">
              {activity.map((a) => (
                <div key={a.id} className="px-4 py-2.5 text-sm">
                  <div className="truncate">
                    <span className="text-muted-foreground">{ACTION_LABEL[a.action] ?? a.action} </span>
                    {a.itemId && a.itemTitle ? (
                      <Link href={`/items/${a.itemId}`} className="hover:text-primary">
                        {a.itemTitle}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {a.itemType ? `${moduleForItemType(a.itemType)?.label ?? a.itemType} · ` : ""}
                    {formatDateTime(a.createdAt)}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </section>
      </div>
    </>
  );
}

function Stat({ label, value, sub, href }: { label: string; value: string; sub?: string; href: string }) {
  return (
    <Link href={href}>
      <Card className="p-4 transition-colors hover:bg-muted/50">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </Card>
    </Link>
  );
}
