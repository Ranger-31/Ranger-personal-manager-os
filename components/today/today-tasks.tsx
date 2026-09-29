"use client";

import { ChevronRight, ListTodo } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TaskRow } from "@/components/tasks/task-row";
import { useTasks, useUpdateTask } from "@/hooks/use-tasks";
import { tasksForToday } from "@/lib/tasks/grouping";
import { cn } from "@/lib/utils";

/**
 * Today に出す単発タスク（期限切れ＋今日期限の未完了のみ）。
 * Routine達成率・Streak には一切関係しない。タップで Tasks 側の編集を開く。
 */
export function TodayTasks({ today }: { today: string }) {
  const { data: tasks } = useTasks();
  const update = useUpdateTask();
  const router = useRouter();
  if (!tasks) return null;
  const list = tasksForToday(tasks, today);
  if (list.length === 0) return null;
  const overdue = list.filter((t) => t.due_date! < today).length;
  const dueToday = list.length - overdue;

  return (
    <section data-today-tasks className="mx-5 mt-5">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-1.5 text-[12px] font-bold tracking-[0.12em]">
          <ListTodo className="size-3.5" strokeWidth={2.6} />
          TASKS
          <span className="ml-1 text-[11.5px] font-medium tracking-normal text-muted">
            {overdue > 0 && <span className="font-bold text-overdue">期限切れ {overdue}</span>}
            {overdue > 0 && dueToday > 0 && "・"}
            {dueToday > 0 && `今日 ${dueToday}`}
          </span>
        </h2>
        <Link href="/tasks" className="flex items-center text-[12px] font-semibold text-muted">
          すべて
          <ChevronRight className="size-3.5" />
        </Link>
      </div>
      <ul className={cn("overflow-hidden rounded-card border", overdue ? "border-overdue/25" : "border-border")}>
        {list.map((t, i) => (
          <li key={t.id} className={cn(i > 0 && "border-t border-border")}>
            <TaskRow
              compact
              task={t}
              today={today}
              onToggle={(x) => update.mutate({ id: x.id, patch: { status: x.status === "done" ? "todo" : "done" } })}
              onEdit={(x) => router.push(`/tasks?edit=${x.id}`)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
