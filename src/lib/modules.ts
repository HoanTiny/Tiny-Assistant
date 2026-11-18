/**
 * Danh sách module hiển thị trên thanh bên.
 *
 * Thêm module mới:
 *   1. Thêm một mục vào MODULES (key, nhãn, đường dẫn, icon, itemType nếu module lưu dữ liệu dạng item).
 *   2. Tạo trang tại src/app/(app)/<đường-dẫn>/page.tsx — có thể chép từ module "tasks" hoặc "notes".
 *   3. Dữ liệu dùng chung bảng `items` với type = itemType, trường riêng để trong `data`.
 */
import {
  CheckSquare,
  LayoutDashboard,
  Newspaper,
  NotebookPen,
  Plug,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type ModuleDef = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Giá trị `items.type` mà module này quản lý */
  itemType?: string;
};

export const MODULES: ModuleDef[] = [
  { key: "dashboard", label: "Tổng quan", href: "/", icon: LayoutDashboard },
  { key: "brief", label: "Bản tin", href: "/brief", icon: Newspaper, itemType: "brief" },
  { key: "tasks", label: "Công việc", href: "/tasks", icon: CheckSquare, itemType: "task" },
  { key: "notes", label: "Ghi chú", href: "/notes", icon: NotebookPen, itemType: "note" },
  { key: "ai", label: "Trợ lý AI", href: "/ai", icon: Sparkles },
];

export const SYSTEM_LINKS: ModuleDef[] = [
  { key: "integrations", label: "Kết nối", href: "/integrations", icon: Plug },
  { key: "settings", label: "Cài đặt", href: "/settings", icon: Settings },
];

export function moduleForItemType(type: string): ModuleDef | undefined {
  return MODULES.find((m) => m.itemType === type);
}

export const TASK_STATUSES = [
  { value: "todo", label: "Cần làm" },
  { value: "doing", label: "Đang làm" },
  { value: "done", label: "Xong" },
] as const;

export const PRIORITIES = [
  { value: 0, label: "Không" },
  { value: 1, label: "Thấp" },
  { value: 2, label: "Trung bình" },
  { value: 3, label: "Cao" },
] as const;
