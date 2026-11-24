/**
 * Bộ component giao diện cơ bản, theo hệ thiết kế kiểu Ecme:
 * nút/ô nhập cao 48px bo 12px chữ đậm, thẻ trắng bo 16px, nhãn màu pastel.
 * Màu lấy từ token trong globals.css nên tự đổi theo chế độ sáng/tối.
 */
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "xs" | "sm" | "md" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary:
    "bg-card text-foreground border border-border-strong hover:border-primary hover:text-primary hover:ring-1 hover:ring-primary dark:bg-muted dark:border-muted",
  ghost: "text-muted-foreground hover:bg-hover hover:text-foreground",
  danger: "bg-danger text-white hover:opacity-90",
};
const buttonSizes: Record<ButtonSize, string> = {
  xs: "h-8 px-3 text-xs rounded-lg",
  sm: "h-10 px-3.5 text-sm rounded-xl",
  md: "h-12 px-5 text-sm rounded-xl",
  icon: "h-10 w-10 rounded-full",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-bold transition active:scale-[0.98] cursor-pointer",
    "disabled:pointer-events-none disabled:opacity-50",
    buttonVariants[variant],
    buttonSizes[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

/** Ô nhập kiểu Ecme: nền xám, chữ đậm vừa; khi bấm vào nền trong suốt, viền xanh */
const fieldClass =
  "w-full appearance-none rounded-xl border border-field bg-field px-3 text-sm font-semibold text-foreground transition duration-150 placeholder:font-medium placeholder:text-muted-foreground/80 focus:border-primary focus:bg-transparent focus:outline-none focus:ring-1 focus:ring-primary";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldClass, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldClass, "min-h-28 py-3 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldClass, "select-chevron h-12 pr-10", className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-semibold text-foreground", className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border bg-card dark:border-card", className)} {...props} />;
}

/** Tiêu đề khối trong thẻ (tương đương h4 của Ecme) */
export function CardTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-xl font-bold">{children}</h2>
      {aside}
    </div>
  );
}

export type Tint = "sky" | "emerald" | "purple" | "rose" | "amber";

const TINT_BG: Record<Tint, string> = {
  sky: "bg-sky-100",
  emerald: "bg-emerald-100",
  purple: "bg-purple-100",
  rose: "bg-rose-100",
  amber: "bg-amber-100",
};

/** Thẻ số liệu nền pastel + icon tròn đen (giữ màu sáng ở cả chế độ tối, như Ecme) */
export function StatTile({
  icon: Icon,
  tint,
  title,
  value,
  sub,
}: {
  icon: LucideIcon;
  tint: Tint;
  title: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className={cn("flex h-full items-center justify-between gap-3 rounded-2xl p-4 text-neutral-900", TINT_BG[tint])}>
      <div className="min-w-0">
        <div className="mb-3 font-bold">{title}</div>
        <div className="text-4xl font-bold tabular-nums leading-none">{value}</div>
        {sub && <div className="mt-2 truncate text-xs font-semibold text-neutral-600">{sub}</div>}
      </div>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white" aria-hidden="true">
        <Icon size={22} />
      </span>
    </div>
  );
}

/** Ô icon nhỏ màu nhạt */
export function IconTile({ icon: Icon, tint = "sky", size = "md" }: { icon: LucideIcon; tint?: Tint; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-neutral-900",
        TINT_BG[tint],
        size === "md" ? "h-12 w-12" : "h-9 w-9",
      )}
      aria-hidden="true"
    >
      <Icon size={size === "md" ? 22 : 18} />
    </span>
  );
}

type Tone = "muted" | "accent" | "success" | "warning" | "danger" | "orange" | "violet";

/** Nhãn (tag) kiểu Ecme: nền màu -200, chữ đậm tối ở cả hai chế độ */
export function Badge({ className, tone = "muted", ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  const tones: Record<Tone, string> = {
    muted: "border-border bg-field text-muted-foreground",
    accent: "border-transparent bg-sky-200 text-neutral-900",
    success: "border-transparent bg-emerald-200 text-neutral-900",
    warning: "border-transparent bg-amber-200 text-neutral-900",
    danger: "border-transparent bg-red-200 text-neutral-900",
    orange: "border-transparent bg-orange-200 text-neutral-900",
    violet: "border-transparent bg-purple-200 text-neutral-900",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-semibold leading-none",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Màu nhãn theo mức ưu tiên: Cao đỏ, Trung bình cam, Thấp tím */
export function priorityTone(p: number): Tone {
  return p >= 3 ? "danger" : p === 2 ? "orange" : p === 1 ? "violet" : "muted";
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-4 sm:mb-6">
      <div className="min-w-0">
        <h1 className="line-clamp-2 text-2xl font-bold">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </header>
  );
}

/** Tiêu đề nhỏ cho từng phần trong trang */
export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold">{children}</h2>
      {aside}
    </div>
  );
}

export function EmptyState({ title, children }: { title?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border-strong px-6 py-10 text-center">
      {title && <p className="font-bold">{title}</p>}
      {children && <div className="mt-1 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={cn("rounded-md border bg-card px-1.5 py-px font-sans text-[11px] font-semibold text-muted-foreground", className)}>
      {children}
    </kbd>
  );
}
