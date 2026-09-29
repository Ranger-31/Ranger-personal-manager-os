"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useTasks, useUpdateTask } from "@/hooks/use-tasks";
import { useTodayKey } from "@/hooks/use-today";
import { TASK_SECTIONS, groupTasks, type TaskSectionKey } from "@/lib/tasks/grouping";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TaskFormSheet } from "./task-form-sheet";
import { TaskRow } from "./task-row";

/** Tasks 画面：期限切れ → 今日 → 今後 → 期限なし → 完了 */
export function TasksView() {
  const today = useTodayKey();
  const { data: tasks, isPending } = useTasks();
  const update = useUpdateTask();
  const params = useSearchParams();
  const router = useRouter();

  const [sheetState, setSheet] = useState<{ open: boolean; task: Task | null } | null>(null);
  const [showDone, setShowDone] = useState(false);

  // Today から ?edit=<id> で開いたら、そのタスクの編集シートを出す
  const editId = params.get("edit");
  const deepTask = editId ? (tasks?.find((x) => x.id === editId) ?? null) : null;
  const sheet = sheetState ?? (deepTask ? { open: true, task: deepTask } : { open: false, task: null });

  const groups = useMemo(() => (today && tasks ? groupTasks(tasks, today) : null), [tasks, today]);

  if (!today || isPending || !groups) {
    return (
      <div className="px-5 pt-[calc(env(safe-area-inset-top)+18px)]">
        <div className="h-7 w-28 animate-pulse rounded-lg bg-surface-muted" />
        <div className="mt-5 h-40 animate-pulse rounded-card bg-surface-muted" />
      </div>
    );
  }

  const open = (tasks ?? []).filter((t) => t.status !== "done").length;
  const toggle = (t: Task) =>
    update.mutate({ id: t.id, patch: { status: t.status === "done" ? "todo" : "done" } });
  const edit = (t: Task) => setSheet({ open: true, task: t });

  return (
    <div className="pb-6">
      <header className="px-5 pt-[calc(env(safe-area-inset-top)+14px)]">
        <p className="text-[12.5px] font-medium text-muted">単発タスク（Routineとは別集計）</p>
        <h1 className="text-[24px] leading-tight font-bold tracking-tight">Tasks</h1>
        <p className="tabular mt-1 text-[13px] text-muted">
          未完了 <span className="font-bold text-foreground">{open}</span>
          {groups.overdue.length > 0 && (
            <>
              {" ・ "}
              <span className="font-bold text-overdue">期限切れ {groups.overdue.length}</span>
            </>
          )}
        </p>
      </header>

      {(tasks ?? []).length === 0 && (
        <div className="mx-5 mt-6 rounded-card border border-dashed border-border px-5 py-8 text-center">
          <p className="text-[15px] font-semibold">タスクはまだありません</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            「報告書作成」「移動手段手配」など、期限のある単発の業務を＋から追加できます。
          </p>
        </div>
      )}

      {TASK_SECTIONS.map(({ key, label }) => {
        const list = groups[key];
        if (!list.length) return null;
        const isDone = key === "done";
        return (
          <section key={key} data-section={key} className="mx-5 mt-6">
            <button
              type="button"
              disabled={!isDone}
              onClick={() => setShowDone((v) => !v)}
              className="mb-2 flex w-full items-center justify-between px-1 text-left"
            >
              <h2 className={cn("text-[12px] font-bold tracking-[0.12em]", key === "overdue" && "text-overdue")}>
                {label}
              </h2>
              <span className="tabular flex items-center gap-1 text-[13px] font-semibold text-muted">
                {list.length}
                {isDone && <ChevronDown className={cn("size-4 transition-transform", showDone && "rotate-180")} />}
              </span>
            </button>
            {(!isDone || showDone) && (
              <ul
                className={cn(
                  "overflow-hidden rounded-card border",
                  key === "overdue" ? "border-overdue/25" : "border-border",
                )}
              >
                {list.map((t: Task, i) => (
                  <li key={t.id} className={cn(i > 0 && "border-t border-border")}>
                    <TaskRow task={t} today={today} onToggle={toggle} onEdit={edit} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <button
        type="button"
        aria-label="タスクを追加"
        onClick={() => setSheet({ open: true, task: null })}
        className="fixed right-[max(20px,calc(50vw-195px))] bottom-[calc(84px+env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_24px_rgba(31,122,92,0.35)] transition-transform active:scale-90"
      >
        <Plus className="size-6" strokeWidth={2.4} />
      </button>

      <TaskFormSheet
        open={sheet.open}
        task={sheet.task}
        today={today}
        onOpenChange={(o) => {
          setSheet({ open: o, task: sheet.task });
          if (!o && editId) router.replace("/tasks", { scroll: false });
        }}
      />
    </div>
  );
}

export type { TaskSectionKey };
