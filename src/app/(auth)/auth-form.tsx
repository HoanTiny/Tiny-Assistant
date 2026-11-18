"use client";

import { useActionState } from "react";
import { Button, Card, Input, Label } from "@/components/ui";
import type { FormState } from "./actions";

type Field = { name: string; label: string; type?: string; autoComplete?: string };

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
    <Card className="p-6">
      <h1 className="text-lg font-semibold">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <form action={formAction} className="mt-5 space-y-4">
        {fields.map((f) => (
          <div key={f.name} className="space-y-1.5">
            <Label htmlFor={f.name}>{f.label}</Label>
            <Input id={f.name} name={f.name} type={f.type ?? "text"} autoComplete={f.autoComplete} required />
          </div>
        ))}
        {state?.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Đang xử lý..." : submitLabel}
        </Button>
      </form>
    </Card>
  );
}
