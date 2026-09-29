"use client";

import { Check } from "lucide-react";
import type { LogMap } from "@/lib/calc/routine";
import { isRoutineCompleted } from "@/lib/calc/routine";
import type { RoutineSection } from "@/lib/today/grouping";
import { cn } from "@/lib/utils";
import { RoutineItem } from "./routine-item";

export function RoutineGroup({
  section,
  logs,
  highlightedId,
  onToggle,
  onSetNumber,
}: {
  section: RoutineSection;
  logs: LogMap;
  highlightedId: string | null;
  onToggle: (routineId: string, completed: boolean) => void;
  onSetNumber: (routineId: string, value: number) => void;
}) {
  const total = section.routines.length;
  const done = section.routines.filter((r) => isRoutineCompleted(r, logs[r.id])).length;
  const complete = total > 0 && done === total;

  return (
    <section className="mx-5 mt-6 first:mt-1">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-[12px] font-bold tracking-[0.12em]">{section.label}</h2>
        {complete ? (
          <span
            key="complete"
            className="animate-fade-up inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-[11.5px] font-bold text-accent"
          >
            <Check className="size-3" strokeWidth={3} />
            完了
          </span>
        ) : (
          <span className="tabular text-[13px] font-semibold text-muted">
            <span className="text-foreground">{done}</span>/{total}
          </span>
        )}
      </div>
      <ul
        className={cn(
          "overflow-hidden rounded-card border bg-surface transition-colors duration-500",
          complete ? "border-accent/25" : "border-border",
        )}
      >
        {section.routines.map((r, i) => (
          <li key={r.id} className={cn(i > 0 && "border-t border-border")}>
            <RoutineItem
              routine={r}
              log={logs[r.id]}
              highlighted={highlightedId === r.id}
              onToggle={onToggle}
              onSetNumber={onSetNumber}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
