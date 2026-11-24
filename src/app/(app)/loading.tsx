export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-10 w-72 animate-pulse rounded-xl bg-muted" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded bg-muted" />
      <div className="mt-8 h-48 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
