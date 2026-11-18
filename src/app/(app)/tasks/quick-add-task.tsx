"use client";

import { useRef } from "react";
import { Plus } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { PRIORITIES } from "@/lib/modules";
import { createTask } from "../actions";

export function QuickAddTask() {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await createTask(fd);
        formRef.current?.reset();
      }}
      className="flex flex-wrap gap-2"
    >
      <Input name="title" placeholder="Thêm việc mới..." required className="min-w-48 flex-1" aria-label="Tên công việc" />
      <Select name="priority" defaultValue="0" className="w-auto" aria-label="Ưu tiên">
        {PRIORITIES.map((p) => (
          <option key={p.value} value={p.value}>
            {p.value === 0 ? "Ưu tiên" : p.label}
          </option>
        ))}
      </Select>
      <Input name="dueAt" type="date" className="w-auto" aria-label="Hạn chót" />
      <Button type="submit">
        <Plus size={16} /> Thêm
      </Button>
    </form>
  );
}
