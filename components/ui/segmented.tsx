"use client";

import { cn } from "@/lib/utils";

/**
 * セグメントコントロール（ALL / WORK / PERSONAL 切替、フォームの単一選択に使用）
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  size?: "sm" | "md";
  "aria-label"?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("grid gap-1 rounded-full bg-surface-muted p-1", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full font-semibold tracking-wide transition-all",
              size === "md" ? "h-9 text-[12.5px]" : "h-8 text-[12px]",
              active
                ? "bg-surface text-foreground shadow-[0_1px_3px_rgba(16,24,40,0.12)]"
                : "text-muted",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
