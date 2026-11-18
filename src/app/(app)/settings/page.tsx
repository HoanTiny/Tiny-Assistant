import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/dal";
import { getDb, schema } from "@/lib/db";
import { getProvider } from "@/lib/ai";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatDateTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Cài đặt" };

export default async function SettingsPage() {
  const user = await requireUser();
  const db = await getDb();
  const calls = await db
    .select()
    .from(schema.aiCalls)
    .where(eq(schema.aiCalls.workspaceId, user.workspaceId))
    .orderBy(desc(schema.aiCalls.createdAt))
    .limit(50);

  const providers = (["openai", "gemini"] as const).map((id) => {
    const p = getProvider(id);
    return { id, label: p.label, configured: p.isConfigured(), defaultModel: p.defaultModel() };
  });

  return (
    <>
      <PageHeader title="Cài đặt" />

      <section className="mb-8">
        <h2 className="mb-3 font-medium">Tài khoản</h2>
        <Card className="grid gap-2 p-4 text-sm sm:grid-cols-3">
          <Field label="Tên" value={user.name} />
          <Field label="Email" value={user.email} />
          <Field label="Workspace" value={`${user.workspaceName} (${user.role})`} />
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 font-medium">Hãng AI</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          API key đặt trong file <code>.env.local</code> (không lưu trong database, không gửi xuống trình duyệt). Sửa xong cần
          khởi động lại app.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {providers.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{p.label}</span>
                {p.configured ? <Badge tone="success">Đã có key</Badge> : <Badge tone="warning">Chưa có key</Badge>}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Model mặc định: <code>{p.defaultModel}</code>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-medium">Nhật ký gọi AI (50 lần gần nhất)</h2>
        {calls.length === 0 ? (
          <EmptyState>Chưa có lần gọi AI nào.</EmptyState>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Thời gian</th>
                  <th className="px-4 py-2 font-medium">Tính năng</th>
                  <th className="px-4 py-2 font-medium">Model</th>
                  <th className="px-4 py-2 text-right font-medium">Token vào/ra</th>
                  <th className="px-4 py-2 text-right font-medium">Thời gian chạy</th>
                  <th className="px-4 py-2 font-medium">Kết quả</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {calls.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap px-4 py-2">{formatDateTime(c.createdAt)}</td>
                    <td className="px-4 py-2">{c.feature}</td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <span className="text-muted-foreground">{c.provider}/</span>
                      {c.model}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                      {formatNumber(c.inputTokens)} / {formatNumber(c.outputTokens)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{(c.durationMs / 1000).toFixed(1)}s</td>
                    <td className="px-4 py-2">
                      {c.status === "ok" ? (
                        <Badge tone="success">OK</Badge>
                      ) : c.status === "aborted" ? (
                        <Badge>Đã dừng</Badge>
                      ) : (
                        <Badge tone="danger" title={c.error ?? ""}>
                          Lỗi
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="truncate">{value}</div>
    </div>
  );
}
