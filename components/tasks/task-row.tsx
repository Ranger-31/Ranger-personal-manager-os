"use client";

import { Check, StickyNote } from "lucide-react";
import { dueLabel } from "@/lib/tasks/grouping";
import type { Task } from "@/lib/types";
import { cn, haptic } from "@/lib/utils";

/** タスク1行：左の丸で完了／再開、行タップで編集 */
export function TaskRow({
  task,
  today,
  onToggle,
  onEdit,
  compact = false,
}: {
  task: Task;
  today: string;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  compact?: boolean;
}) {
  const done = task.status === "done";
  const due = dueLabel(task, today);
  return (
    <div data-task={task.title} className={cn("flex items-center gap-3 px-4", compact ? "min-h-[52px] py-2" : "min-h-[60px] py-2.5")}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${task.title}を${done ? "再開" : "完了"}にする`}
        onClick={() => {
          if (!done) haptic();
          onToggle(task);
        }}
        className="-m-2 p-2"
      >
        <span
          aria-hidden
          className={cn(
            "flex size-[24px] items-center justify-center rounded-full border-2 transition-colors",
            done ? "animate-pop border-accent bg-accent text-white" : due.tone === "overdue" ? "border-overdue/60" : "border-[#d5d9df]",
          )}
        >
          {done && <Check className="size-[14px]" strokeWidth={3.2} />}
        </span>
      </button>
      <button type="button" onClick={() => onEdit(task)} className="min-w-0 flex-1 text-left" aria-label={`${task.title}を編集`}>
        <p className={cn("truncate text-[15.5px] font-medium", done && "text-done line-through decoration-done/40")}>{task.title}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[12px]">
          <span
            data-due-tone={due.tone}
            className={cn(
              "tabular",
              due.tone === "overdue" && "font-bold text-overdue",
              due.tone === "today" && "font-bold text-accent",
              (due.tone === "normal" || due.tone === "none") && "text-muted",
            )}
          >
            {due.text}
          </span>
          {task.status === "doing" && (
            <span className="rounded-full bg-accent-soft px-1.5 py-px text-[10.5px] font-bold text-accent">進行中</span>
          )}
          {!compact && (
            <span className="rounded-full bg-surface-muted px-1.5 py-px text-[10.5px] font-semibold text-muted">
              {task.category === "work" ? "Work" : "Personal"}
            </span>
          )}
          {task.memo && <StickyNote aria-label="メモあり" className="size-3 text-subtle" />}
          {done && task.completed_at && (
            <span className="text-muted">・{formatDone(task.completed_at)}完了</span>
          )}
        </p>
      </button>
    </div>
  );
}

function formatDone(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
