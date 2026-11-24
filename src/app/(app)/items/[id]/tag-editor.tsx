"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { addTagToItem, removeTagFromItem } from "../../actions";

/** Thêm / bỏ tag trên trang chi tiết. Lưu ngay, không cần bấm "Lưu thay đổi". */
export function TagEditor({ itemId, initialTags }: { itemId: string; initialTags: string[] }) {
  const [tags, setTags] = useState(initialTags);
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const add = () => {
    const name = value.trim();
    if (!name) {
      setAdding(false);
      return;
    }
    startTransition(async () => {
      const res = await addTagToItem(itemId, name);
      if (res.error) {
        setError(res.error);
        return;
      }
      setTags(res.tags ?? tags);
      setValue("");
      setError(null);
      inputRef.current?.focus();
    });
  };

  const remove = (name: string) =>
    startTransition(async () => {
      const res = await removeTagFromItem(itemId, name);
      if (res.error) setError(res.error);
      else setTags(res.tags ?? tags.filter((t) => t !== name));
    });

  return (
    <>
      {tags.map((t) => (
        <span
          key={t}
          className="group inline-flex h-9 items-center gap-1 rounded-full bg-accent pl-3 pr-1.5 text-xs font-semibold text-accent-foreground"
        >
          #{t}
          <button
            type="button"
            onClick={() => remove(t)}
            disabled={pending}
            aria-label={`Bỏ tag ${t}`}
            title="Bỏ tag"
            className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full opacity-60 transition hover:bg-card hover:opacity-100"
          >
            <X size={12} />
          </button>
        </span>
      ))}

      {adding ? (
        <span className="inline-flex h-9 items-center rounded-full border border-primary bg-card pl-3 pr-1.5">
          <span className="text-xs font-semibold text-muted-foreground">#</span>
          <input
            ref={inputRef}
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              // Enter thêm tag; không để Enter gửi form chính
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                add();
              } else if (e.key === "Escape") {
                setAdding(false);
                setValue("");
                setError(null);
              }
            }}
            onBlur={() => !value.trim() && setAdding(false)}
            disabled={pending}
            placeholder="tên tag"
            aria-label="Tên tag mới"
            maxLength={40}
            className="w-28 bg-transparent px-1 text-xs font-semibold text-foreground outline-none focus-visible:outline-none placeholder:font-normal"
          />
          <button
            type="button"
            onClick={add}
            disabled={pending}
            className="inline-flex h-6 cursor-pointer items-center rounded-full bg-primary px-2.5 text-[11px] font-bold text-white hover:bg-primary-hover disabled:opacity-60"
          >
            Thêm
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          title="Tag được lưu ngay khi thêm"
          className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-full border border-dashed border-border-strong px-3 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Plus size={13} /> Tag
        </button>
      )}

      {error && <span className="text-xs font-semibold text-danger">{error}</span>}
    </>
  );
}
