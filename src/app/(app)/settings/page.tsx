import type { Metadata } from "next";
import { Suspense } from "react";
import { desc, eq } from "drizzle-orm";
import { KeyRound, Mail, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { getDb, schema } from "@/lib/db";
import { getProvider } from "@/lib/ai";
import { Badge, Card, PageHeader } from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import { AIDashboard, type CallRecord } from "./ai-dashboard";

export const metadata: Metadata = { title: "Cài đặt" };

async function SettingsContent() {
  const user = await requireUser();
  const db = await getDb();
  const rawCalls = await db
    .select()
    .from(schema.aiCalls)
    .where(eq(schema.aiCalls.workspaceId, user.workspaceId))
    .orderBy(desc(schema.aiCalls.createdAt))
    .limit(500);

  const calls: CallRecord[] = rawCalls.map((c) => ({
    id: c.id,
    provider: c.provider,
    model: c.model,
    feature: c.feature,
    inputTokens: c.inputTokens,
    outputTokens: c.outputTokens,
    durationMs: c.durationMs,
    status: c.status,
    error: c.error,
    createdAt: c.createdAt.toISOString(),
  }));

  const countByProvider = new Map<string, number>();
  for (const c of calls) countByProvider.set(c.provider, (countByProvider.get(c.provider) ?? 0) + 1);

  const providers = (["openai", "gemini"] as const).map((id) => {
    const p = getProvider(id);
    return {
      id,
      label: p.label,
      configured: p.isConfigured(),
      defaultModel: p.defaultModel(),
      calls: countByProvider.get(id) ?? 0,
    };
  });

  const initials = user.name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <>
      {/* Hàng đầu: Tài khoản + Trạng thái Hãng AI */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="flex flex-col justify-between p-5 xl:col-span-5">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2a85ff] to-[#6366f1] text-lg font-bold text-white shadow-xs">
              {initials || <UserRound size={22} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-bold text-foreground">{user.name}</h2>
                <Badge tone="accent">{user.role}</Badge>
              </div>
              <div className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <Mail size={13} className="shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-muted/60 px-3.5 py-2.5 text-xs">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <ShieldCheck size={14} className="text-primary" />
              Workspace
            </span>
            <span className="font-bold text-foreground">{user.workspaceName}</span>
          </div>
        </Card>

        <Card className="p-5 xl:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <KeyRound size={16} className="text-primary" />
              <h2 className="text-base font-bold">Kết nối hãng AI</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              Cấu hình API key trong <code className="rounded bg-muted px-1.5 py-0.5">.env.local</code>
            </span>
          </div>

          <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {providers.map((p) => (
              <div
                key={p.id}
                className="flex flex-col justify-between rounded-2xl border border-border/80 bg-muted/35 p-3.5 transition-colors hover:bg-muted/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 font-bold text-foreground">
                    <span
                      className={
                        p.id === "gemini"
                          ? "flex h-7 w-7 items-center justify-center rounded-xl bg-sky-100 text-[#2a85ff]"
                          : "flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"
                      }
                    >
                      <Sparkles size={14} />
                    </span>
                    {p.label}
                  </span>
                  {p.configured ? <Badge tone="success">Đã có key</Badge> : <Badge tone="warning">Chưa có key</Badge>}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate">
                    Mặc định: <code className="font-semibold text-foreground">{p.defaultModel}</code>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-foreground">{formatNumber(p.calls)} lượt</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Dashboard KPI, biểu đồ & nhật ký lọc được */}
      <AIDashboard calls={calls} />
    </>
  );
}

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Cài đặt & Thống kê AI"
        description="Quản lý tài khoản, trạng thái kết nối các hãng AI và theo dõi chi tiết hiệu suất, lưu lượng token."
      />
      <Suspense
        fallback={
          <div className="space-y-4" aria-busy="true">
            <div className="h-36 animate-pulse rounded-2xl bg-muted" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, idx) => (
                <div key={idx} className="h-28 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
            <div className="h-72 animate-pulse rounded-2xl bg-muted" />
          </div>
        }
      >
        <SettingsContent />
      </Suspense>
    </div>
  );
}
