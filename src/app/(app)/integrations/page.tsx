import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/dal";
import { getDb, schema } from "@/lib/db";
import { INTEGRATIONS, missingEnv } from "@/lib/integrations";
import { Badge, Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Kết nối" };

const AUTH_LABEL = { oauth2: "Đăng nhập OAuth", api_key: "API key", bot_token: "Bot token" };

export default async function IntegrationsPage() {
  const user = await requireUser();
  const db = await getDb();
  const connected = await db
    .select({ provider: schema.integrations.provider })
    .from(schema.integrations)
    .where(eq(schema.integrations.workspaceId, user.workspaceId));
  const connectedSet = new Set(connected.map((c) => c.provider));

  return (
    <>
      <PageHeader
        title="Kết nối dịch vụ"
        description="Khung kết nối đã sẵn sàng (lưu token mã hóa, mỗi dịch vụ một mục). Từng kết nối sẽ được làm khi bạn cần."
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {INTEGRATIONS.map((i) => {
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
    </>
  );
}
