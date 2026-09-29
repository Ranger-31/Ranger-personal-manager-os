import type { Task } from "@/lib/types";
import { fromDateKey } from "@/lib/utils";

/**
 * Tasks の区分け：期限切れ → 今日 → 今後 → 期限なし → 完了
 * 完了タスクは期限に関係なく「完了」へ（履歴として残す）
 */
export type TaskSectionKey = "overdue" | "today" | "upcoming" | "nodue" | "done";

export const TASK_SECTIONS: { key: TaskSectionKey; label: string }[] = [
  { key: "overdue", label: "期限切れ" },
  { key: "today", label: "今日" },
  { key: "upcoming", label: "今後" },
  { key: "nodue", label: "期限なし" },
  { key: "done", label: "完了" },
];

export function sectionOf(task: Task, today: string): TaskSectionKey {
  if (task.status === "done") return "done";
  if (!task.due_date) return "nodue";
  if (task.due_date < today) return "overdue";
  if (task.due_date === today) return "today";
  return "upcoming";
}

export function groupTasks(tasks: Task[], today: string): Record<TaskSectionKey, Task[]> {
  const out: Record<TaskSectionKey, Task[]> = { overdue: [], today: [], upcoming: [], nodue: [], done: [] };
  for (const t of tasks) out[sectionOf(t, today)].push(t);
  const byDue = (a: Task, b: Task) =>
    (a.due_date ?? "").localeCompare(b.due_date ?? "") || a.created_at.localeCompare(b.created_at);
  out.overdue.sort(byDue);
  out.today.sort((a, b) => a.created_at.localeCompare(b.created_at));
  out.upcoming.sort(byDue);
  out.nodue.sort((a, b) => a.created_at.localeCompare(b.created_at));
  out.done.sort((a, b) => (b.completed_at ?? b.updated_at).localeCompare(a.completed_at ?? a.updated_at));
  return out;
}

/** Today に出す：期限切れ＋今日が期限の未完了 */
export function tasksForToday(tasks: Task[], today: string): Task[] {
  const g = groupTasks(tasks, today);
  return [...g.overdue, ...g.today];
}

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

export function formatDue(dateKey: string): string {
  const d = fromDateKey(dateKey);
  return `${d.getMonth() + 1}/${d.getDate()}（${WEEK[d.getDay()]}）`;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((fromDateKey(to).getTime() - fromDateKey(from).getTime()) / 86_400_000);
}

/** 期限の表示（期限切れは超過日数つき） */
export function dueLabel(task: Task, today: string): { text: string; tone: "overdue" | "today" | "normal" | "none" } {
  if (!task.due_date) return { text: "期限なし", tone: "none" };
  const diff = daysBetween(today, task.due_date);
  if (task.status !== "done" && diff < 0) {
    return { text: `${formatDue(task.due_date)}・${-diff}日超過`, tone: "overdue" };
  }
  if (diff === 0) return { text: `今日 ${formatDue(task.due_date)}`, tone: task.status === "done" ? "normal" : "today" };
  if (diff === 1) return { text: `明日 ${formatDue(task.due_date)}`, tone: "normal" };
  return { text: formatDue(task.due_date), tone: "normal" };
}

export const STATUS_LABEL: Record<Task["status"], string> = {
  todo: "未着手",
  doing: "進行中",
  done: "完了",
};
