export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-9 w-56 animate-pulse rounded-xl bg-muted" />
      <div className="h-11 animate-pulse rounded-xl bg-muted" />
      <div className="h-11 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
