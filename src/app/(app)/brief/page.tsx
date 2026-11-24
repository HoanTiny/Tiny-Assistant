import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { defaultProviderId } from "@/lib/ai";
import { getCurrentBriefs, listBriefs } from "@/lib/brief";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { BriefPanel } from "./brief-panel";

export const metadata: Metadata = { title: "Bản tin" };

const BRIEF_HOUR = Number(process.env.BRIEF_HOUR ?? 7);
const WEEKDAY = ["Chủ nhật", "thứ 2", "thứ 3", "thứ 4", "thứ 5", "thứ 6", "thứ 7"][Number(process.env.WEEKLY_REVIEW_DAY ?? 1)] ?? "thứ 2";

export default async function BriefPage() {
  const user = await requireUser();
  const [{ daily, weekly }, history] = await Promise.all([getCurrentBriefs(user.workspaceId), listBriefs(user.workspaceId)]);
  const aiReady = defaultProviderId() !== null;
  const auto = process.env.BRIEF_AUTO !== "off";

  const toProps = (i: typeof daily) => (i ? { id: i.id, content: i.content, updatedAt: i.updatedAt.toISOString() } : null);

  return (
    <>
      <PageHeader
        title="Bản tin"
        description={
          auto
            ? `App tự tạo bản tin lúc ${BRIEF_HOUR}h mỗi sáng và tổng kết tuần vào ${WEEKDAY} (khi app đang chạy).`
            : "Tự tạo theo lịch đang tắt (BRIEF_AUTO=off). Bạn vẫn có thể tạo thủ công."
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BriefPanel
          kind="daily"
          title="Bản tin sáng"
          description="Việc ưu tiên hôm nay, việc quá hạn, gợi ý sắp xếp thời gian"
          existing={toProps(daily)}
          aiReady={aiReady}
        />
        <BriefPanel
          kind="weekly"
          title="Tổng kết tuần"
          description="Tuần qua làm được gì, còn tồn gì, 3 ưu tiên tuần tới"
          existing={toProps(weekly)}
          aiReady={aiReady}
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-medium">Các bản trước</h2>
        {history.length === 0 ? (
          <EmptyState>Chưa có bản tin nào.</EmptyState>
        ) : (
          <Card className="divide-y">
            {history.map((b) => (
              <Link key={b.id} href={`/items/${b.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-muted/50">
                <span className="flex min-w-0 items-center gap-2">
                  <Badge tone={b.data.kind === "weekly" ? "accent" : "muted"}>{b.data.kind === "weekly" ? "Tuần" : "Ngày"}</Badge>
                  <span className="truncate">{b.title}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(b.updatedAt)}</span>
              </Link>
            ))}
          </Card>
        )}
      </section>
    </>
  );
}
