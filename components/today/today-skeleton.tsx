export function TodaySkeleton() {
  const block = "animate-pulse rounded-card bg-surface-muted";
  return (
    <div aria-busy className="px-5 pt-[calc(env(safe-area-inset-top)+18px)]">
      <div className="h-4 w-28 animate-pulse rounded bg-surface-muted" />
      <div className="mt-2 h-8 w-48 animate-pulse rounded-lg bg-surface-muted" />
      <div className={`${block} mt-5 h-[190px]`} />
      <div className={`${block} mt-6 h-[160px]`} />
      <div className="mt-6 h-11 animate-pulse rounded-full bg-surface-muted" />
      <div className={`${block} mt-4 h-[230px]`} />
    </div>
  );
}
