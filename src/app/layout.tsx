import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const sans = Inter({
  variable: "--font-sans-face",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: { default: "WorkHub", template: "%s · WorkHub" },
  description: "Quản lý mọi công việc ở một nơi, có AI hỗ trợ",
};

// Áp dụng chế độ sáng/tối người dùng đã chọn trước khi trình duyệt vẽ trang (tránh nháy màu)
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("wh_theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${sans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
