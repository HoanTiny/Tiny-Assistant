"use client";

import { useTransition } from "react";
import { Circle, CircleCheck, CircleDot } from "lucide-react";
import { setTaskStatus } from "../actions";

const NEXT: Record<string, string> = { todo: "doing", doing: "done", done: "todo" };
const LABEL: Record<string, string> = { todo: "Cần làm", doing: "Đang làm", done: "Xong" };

/** Bấm để chuyển trạng thái: Cần làm → Đang làm → Xong → Cần làm */
export function TaskStatusButton({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const Icon = status === "done" ? CircleCheck : status === "doing" ? CircleDot : Circle;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setTaskStatus(id, NEXT[status] ?? "todo"))}
      title={`${LABEL[status] ?? status} — bấm để đổi`}
      aria-label={`Trạng thái: ${LABEL[status] ?? status}. Bấm để đổi`}
      className={
        status === "done"
          ? "text-primary"
          : status === "doing"
            ? "text-sky-500"
            : "text-muted-foreground hover:text-primary"
      }
    >
      <Icon size={24} strokeWidth={1.8} className={pending ? "animate-pulse" : ""} />
    </button>
  );
}
