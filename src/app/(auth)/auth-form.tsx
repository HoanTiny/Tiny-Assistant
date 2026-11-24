"use client";

import { useActionState } from "react";
import { Button, Input, Label } from "@/components/ui";
import type { FormState } from "./actions";

type Field = { name: string; label: string; type?: string; autoComplete?: string; placeholder?: string };

export function AuthForm({
  action,
  title,
  description,
  fields,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  title: string;
  description?: string;
  fields: Field[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <div>
      <h1 className="text-3xl font-bold">{title}</h1>
      {description && <p className="mt-1 font-semibold text-foreground">{description}</p>}
      <form action={formAction} className="mt-8 space-y-5">
        {fields.map((f) => (
          <div key={f.name} className="space-y-1.5">
            <Label htmlFor={f.name} className="text-muted-foreground">{f.label}</Label>
            <Input
              id={f.name}
              name={f.name}
              type={f.type ?? "text"}
              autoComplete={f.autoComplete}
              placeholder={f.placeholder}
              required
              
            />
          </div>
        ))}
        {state?.error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger">
            {state.error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Đang xử lý..." : submitLabel}
        </Button>
      </form>
    </div>
  );
}
