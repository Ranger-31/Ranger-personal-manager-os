"use client";

import { Check, Crosshair } from "lucide-react";
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
    <section className="mx-5 mt-5">
      {/* 通常Routineと区別する「今日絶対に意識する3項目」。将来 Manager AI の提案枠として使う */}
      <div className="overflow-hidden rounded-card border border-accent/20 bg-focus">
        <div className="flex items-center justify-between px-4 pt-3.5 pb-1.5">
          <h2 className="flex items-center gap-1.5 text-[12px] font-bold tracking-[0.12em] text-accent">
            <Crosshair className="size-3.5" strokeWidth={2.6} />
            TODAY FOCUS
          </h2>
          <span className="text-[11.5px] font-medium text-accent/70">今日の最重要3項目</span>
        </div>
        <ol>
          {items.map((f, i) => {
            const routine = routines.find((r) => r.id === f.routine_id);
            const log = routine ? logs[routine.id] : undefined;
            const done = routine ? isRoutineCompleted(routine, log) : false;
            const numeric = routine?.type === "numeric";
            return (
              <li key={f.id} className={cn(i > 0 && "border-t border-accent/10")}>
                <button
                  type="button"
                  disabled={!routine}
                  onClick={() => routine && onJump(routine.id)}
                  className="flex w-full items-center gap-3.5 px-4 py-3 text-left active:bg-accent/[0.05]"
                >
                  <span className="tabular w-6 text-[15px] font-bold text-accent">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-[16px] font-bold",
                      done && "font-semibold text-done line-through decoration-done/40",
                    )}
                  >
                    {f.title}
                  </span>
                  {done ? (
                    <span className="flex size-6 items-center justify-center rounded-full bg-accent text-white">
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                  ) : numeric ? (
                    <span className="tabular text-[13px] font-semibold text-accent/80">
                      {log?.numeric_value ?? 0}/{routine?.target_number}
                      {routine?.unit}
                    </span>
                  ) : (
                    <span className="size-6 rounded-full border-2 border-accent/35 bg-surface" />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
