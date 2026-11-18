"use client";

import { useActionState, useState } from "react";
import { Eye, Pencil } from "lucide-react";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { PRIORITIES, TASK_STATUSES } from "@/lib/modules";
import { saveItem } from "../../actions";

type EditableItem = {
  id: string;
  type: string;
  title: string;
  content: string;
  status: string | null;
  priority: number;
  dueAt: string | null; // yyyy-mm-dd
};

export function ItemEditor({ item }: { item: EditableItem }) {
  const [state, action, pending] = useActionState(saveItem, undefined);
  const [content, setContent] = useState(item.content);
  const [preview, setPreview] = useState(item.type === "note" && item.content.length > 0);
  const isTask = item.type === "task";

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={item.id} />
      <Input name="title" defaultValue={item.title} required aria-label="Tiêu đề" className="h-12 text-lg font-semibold" />

      {isTask && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="status">Trạng thái</Label>
            <Select id="status" name="status" defaultValue={item.status ?? "todo"}>
              {TASK_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="priority">Ưu tiên</Label>
            <Select id="priority" name="priority" defaultValue={String(item.priority)}>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dueAt">Hạn chót</Label>
            <Input id="dueAt" name="dueAt" type="date" defaultValue={item.dueAt ?? ""} />
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b px-3 py-1.5">
          <span className="text-xs text-muted-foreground">{isTask ? "Mô tả" : "Nội dung"} · Markdown</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setPreview((p) => !p)}>
            {preview ? <Pencil size={14} /> : <Eye size={14} />} {preview ? "Sửa" : "Xem trước"}
          </Button>
        </div>
        {/* Textarea luôn nằm trong form để giá trị được gửi kể cả khi đang xem trước */}
        <Textarea
          name="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={isTask ? 8 : 16}
          placeholder={isTask ? "Mô tả chi tiết, ghi chú, link..." : "Viết gì đó..."}
          className={preview ? "hidden" : "rounded-none border-0 font-mono text-[13px] focus:outline-none"}
          aria-label="Nội dung"
        />
        {preview && (
          <div className="min-h-40 p-4">
            {content ? <Markdown>{content}</Markdown> : <p className="text-sm text-muted-foreground">(trống)</p>}
          </div>
        )}
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Đang lưu..." : "Lưu"}
        </Button>
        {state?.ok && !pending && <span className="text-sm text-success">Đã lưu</span>}
        {state?.error && <span className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
