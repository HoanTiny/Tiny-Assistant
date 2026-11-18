/**
 * Bộ component giao diện cơ bản. Viết theo phong cách shadcn/ui:
 * có thể thêm component shadcn sau này bằng `npx shadcn@latest add <tên>`.
 */
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "bg-card border hover:bg-muted",
  ghost: "hover:bg-muted",
  danger: "bg-danger text-white hover:opacity-90",
};
const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  icon: "h-8 w-8",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-pointer",
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

const fieldClass =
  "w-full rounded-lg border bg-card px-3 text-sm placeholder:text-muted-foreground focus:outline-2 focus:outline-primary focus:-outline-offset-1";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldClass, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldClass, "py-2", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldClass, "h-10 pr-8", className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium", className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-xl border bg-card", className)} {...props} />;
}

export function Badge({
  className,
  tone = "muted",
  ...props
}: ComponentProps<"span"> & { tone?: "muted" | "accent" | "success" | "warning" | "danger" }) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    accent: "bg-accent text-accent-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    danger: "bg-danger/15 text-danger",
  };
  return (
    <span
      className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", tones[tone], className)}
      {...props}
    />
  );
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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
