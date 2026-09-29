import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  className,
  tone = "accent",
}: {
  value: number; // 0-100
  className?: string;
  tone?: "accent" | "muted";
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-accent-track", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          tone === "accent" ? "bg-accent" : "bg-subtle",
        )}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}
