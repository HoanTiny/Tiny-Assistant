import { NextResponse, type NextRequest } from "next/server";

/**
 * Kiểm tra nhanh (lạc quan): chưa có cookie phiên → chuyển về /login.
 * Kiểm tra thật (phiên còn hạn, thuộc user nào) nằm ở lib/auth/dal.ts.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("wh_session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Bỏ qua trang đăng nhập/thiết lập, API (tự kiểm tra và trả 401) và file tĩnh
  matcher: ["/((?!login|setup|api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|webp)$).*)"],
};
