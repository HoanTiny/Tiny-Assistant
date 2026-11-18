import { getCurrentUser } from "@/lib/auth/dal";
import { listProviders } from "@/lib/ai";

/** Danh sách hãng AI + model khả dụng, cho bộ chọn model trên giao diện */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });

  return Response.json({ providers: await listProviders() });
}
