import type { Metadata } from "next";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/dal";
import { getDb, schema } from "@/lib/db";
import { INTEGRATIONS, missingEnv } from "@/lib/integrations";
import { Badge, Card, PageHeader } from "@/components/ui";
import { TelegramCard } from "./telegram-card";

export const metadata: Metadata = { title: "Kết nối" };

const AUTH_LABEL = { oauth2: "Đăng nhập OAuth", api_key: "API key", bot_token: "Bot token" };

async function IntegrationsList() {
  const user = await requireUser();
  const db = await getDb();
  const connected = await db
    .select({ provider: schema.integrations.provider })
    .from(schema.integrations)
    .where(eq(schema.integrations.workspaceId, user.workspaceId));
  const connectedSet = new Set(connected.map((c) => c.provider));

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {INTEGRATIONS.filter((i) => i.key !== "telegram").map((i) => {
        const missing = missingEnv(i);
        return (
          <Card key={i.key} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium">{i.name}</div>
              {connectedSet.has(i.key) ? (
                <Badge tone="success">Đã kết nối</Badge>
              ) : i.status === "planned" ? (
                <Badge>Sắp có</Badge>
              ) : (
                <Badge tone="accent">Có thể kết nối</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{i.description}</p>
            <div className="mt-3 text-xs text-muted-foreground">
              {AUTH_LABEL[i.auth]}
              {missing.length > 0 && (
                <>
                  {" · Cần "}
                  {missing.map((v) => (
                    <code key={v} className="mr-1 rounded bg-muted px-1">
                      {v}
                    </code>
                  ))}
                </>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader
        title="Kết nối dịch vụ"
        description="Nối WorkHub với các dịch vụ bạn đang dùng. Token được mã hóa trước khi lưu."
      />
      <div className="mb-6">
        <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-muted" aria-busy="true" />}>
          <TelegramCard />
        </Suspense>
      </div>
      <h2 className="mb-3 text-lg font-bold">Sắp có</h2>
      <Suspense
        fallback={
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-busy="true">
            {Array.from({ length: 4 }, (_, idx) => (
              <div key={idx} className="h-28 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        }
      >
        <IntegrationsList />
      </Suspense>
    </>
  );
}
