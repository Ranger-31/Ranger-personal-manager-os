"use client";

import { Check } from "lucide-react";
import type { LogMap } from "@/lib/calc/routine";
import { isRoutineCompleted } from "@/lib/calc/routine";
import type { DailyFocus, Routine } from "@/lib/types";
import { cn } from "@/lib/utils";

/** TODAY FOCUS：今日の最重要（最大3件）。タップで該当Routineへスクロール */
export function TodayFocus({
  focus,
  routines,
  logs,
  onJump,
}: {
  focus: DailyFocus[];
  routines: Routine[];
  logs: LogMap;
  onJump: (routineId: string) => void;
}) {
  if (focus.length === 0) return null;
  const items = focus.slice(0, 3);

  return (
    <section className="mx-5 mt-6">
      <div className="mb-2.5 flex items-baseline justify-between px-1">
        <h2 className="text-[12px] font-bold tracking-[0.12em]">TODAY FOCUS</h2>
        <span className="text-[11.5px] text-muted">今日の最重要</span>
      </div>
      <ol className="overflow-hidden rounded-card bg-surface-muted">
        {items.map((f, i) => {
          const routine = routines.find((r) => r.id === f.routine_id);
          const log = routine ? logs[routine.id] : undefined;
          const done = routine ? isRoutineCompleted(routine, log) : false;
          const numeric = routine?.type === "numeric";
          return (
            <li key={f.id} className={cn(i > 0 && "border-t border-white")}>
              <button
                type="button"
                disabled={!routine}
                onClick={() => routine && onJump(routine.id)}
                className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left active:bg-black/[0.03]"
              >
                <span
                  className={cn(
                    "tabular w-6 text-[15px] font-bold",
                    done ? "text-accent" : "text-subtle",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[16px] font-semibold",
                    done && "text-muted line-through decoration-subtle/70",
                  )}
                >
                  {f.title}
                </span>
                {done ? (
                  <span className="flex size-6 items-center justify-center rounded-full bg-accent text-white">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                ) : numeric ? (
                  <span className="tabular text-[13px] font-semibold text-muted">
                    {log?.numeric_value ?? 0}/{routine?.target_number}
                    {routine?.unit}
                  </span>
                ) : (
                  <span className="size-6 rounded-full border-2 border-[#d5d9df]" />
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
