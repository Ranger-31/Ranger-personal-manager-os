"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCreateTask, useDeleteTask, useUpdateTask } from "@/hooks/use-tasks";
import type { Category, Task, TaskInput, TaskStatus } from "@/lib/types";
import { addDays, cn } from "@/lib/utils";

/** タスクの追加・編集（削除は確認つき） */
export function TaskFormSheet({
  open,
  onOpenChange,
  task,
  today,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** null なら新規作成 */
  task: Task | null;
  today: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>{task ? "タスクを編集" : "タスクを追加"}</SheetTitle>
        </SheetHeader>
        {open && <TaskForm key={task?.id ?? "new"} task={task} today={today} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function TaskForm({ task, today, onDone }: { task: Task | null; today: string; onDone: () => void }) {
  const create = useCreateTask();
  const update = useUpdateTask();
  const remove = useDeleteTask();

  const [title, setTitle] = useState(task?.title ?? "");
  const [due, setDue] = useState<string>(task?.due_date ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo");
  const [category, setCategory] = useState<Category>(task?.category ?? "work");
  const [memo, setMemo] = useState(task?.memo ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = title.trim().length > 0;
  const tomorrow = addDays(today, 1);

  const submit = () => {
    if (!valid) return;
    const input: TaskInput = { title, due_date: due || null, status, category, memo };
    const opts = { onSuccess: onDone, onError: (e: Error) => setError(e.message) };
    if (task) update.mutate({ id: task.id, patch: input }, opts);
    else create.mutate(input, opts);
  };

  if (confirmDelete && task) {
    return (
      <div className="space-y-4 px-6 pt-2 pb-6">
        <div className="rounded-2xl bg-overdue-soft px-4 py-4">
          <p className="text-[15px] font-bold">「{task.title}」を削除しますか？</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-foreground/80">
            削除すると元に戻せません。完了した履歴として残したい場合は、削除せず「完了」にしてください。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
            やめる
          </Button>
          <Button
            className="bg-overdue hover:bg-overdue/90"
            disabled={remove.isPending}
            onClick={() => remove.mutate(task.id, { onSuccess: onDone })}
          >
            削除する
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 space-y-5 overflow-y-auto px-6 pt-3 pb-4">
        <Field label="タイトル（必須）">
          <input
            value={title}
            maxLength={60}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：報告書作成"
            className="h-12 w-full rounded-2xl bg-surface-muted px-4 text-[16px] outline-none placeholder:text-subtle focus:ring-2 focus:ring-accent/30"
          />
        </Field>

        <Field label="期限">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip active={due === today} onClick={() => setDue(today)}>
              今日
            </Chip>
            <Chip active={due === tomorrow} onClick={() => setDue(tomorrow)}>
              明日
            </Chip>
            <Chip active={due === ""} onClick={() => setDue("")}>
              なし
            </Chip>
            <input
              type="date"
              aria-label="期限の日付"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="tabular h-10 min-w-0 flex-1 rounded-xl bg-surface-muted px-3 text-[15px] outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
        </Field>

        <Field label="状態">
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: "todo", label: "未着手" },
              { value: "doing", label: "進行中" },
              { value: "done", label: "完了" },
            ]}
          />
        </Field>

        <Field label="区分">
          <Segmented
            value={category}
            onChange={setCategory}
            options={[
              { value: "work", label: "Work" },
              { value: "personal", label: "Personal" },
            ]}
          />
        </Field>

        <Field label="メモ（任意）">
          <textarea
            value={memo}
            maxLength={500}
            rows={3}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="例：〇〇部長へ提出、資料は共有フォルダ"
            className="w-full resize-none rounded-2xl bg-surface-muted px-4 py-3 text-[16px] leading-relaxed outline-none placeholder:text-subtle focus:ring-2 focus:ring-accent/30"
          />
        </Field>

        {error && <p className="rounded-xl bg-overdue-soft px-3 py-2 text-[13px] font-semibold text-overdue">{error}</p>}

        {task && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 text-[14px] font-semibold text-overdue"
          >
            <Trash2 className="size-4" />
            このタスクを削除
          </button>
        )}
      </div>
      <div className="border-t border-border px-6 pt-3 pb-4">
        <Button className="w-full" disabled={!valid || create.isPending || update.isPending} onClick={submit}>
          {task ? "保存する" : "追加する"}
        </Button>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11.5px] font-bold tracking-[0.06em] text-muted">{label}</p>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-10 rounded-full px-4 text-[13.5px] font-semibold transition-colors",
        active ? "bg-accent text-white" : "bg-surface-muted text-muted",
      )}
    >
      {children}
    </button>
  );
}
