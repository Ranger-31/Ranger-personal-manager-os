import { MOCK_USER_ID } from "@/lib/mock/data";
import type { Task, TaskInput } from "@/lib/types";

/**
 * Tasks のローカル保存（Phase 1）
 *
 * 既存データを守るため、Routine・記録・Streak の保存キー（pmos:local:v2）とは
 * 完全に別のキーに保存する。このモジュールは既存キーを読み書きしない。
 * - アップデート後の初回はキーが無い → 空の一覧で開始（何も書き込まない）
 * - Routine側の「記録をリセット」はこのキーに触れない
 */
export const TASKS_STORAGE_KEY = "pmos:tasks:v1";

export type TaskStore = { version: 1; tasks: Task[] };

let memory: TaskStore | null = null;

/** バックアップ復元後に、端末の保存内容を読み直させる */
export function resetTaskCache() {
  memory = null;
}

function load(): TaskStore {
  if (memory) return memory;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(TASKS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as TaskStore;
        if (parsed && Array.isArray(parsed.tasks)) {
          memory = { version: 1, tasks: parsed.tasks };
          return memory;
        }
      }
    } catch {
      /* 読めない場合も既存キーは上書きしない。メモリ上で空として扱う */
    }
  }
  memory = { version: 1, tasks: [] };
  return memory;
}

function save(store: TaskStore) {
  memory = store;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    throw new Error("タスクを端末に保存できませんでした");
  }
}

const nowIso = () => new Date().toISOString();
const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function normalize(input: Partial<TaskInput>): Partial<TaskInput> {
  const out: Partial<TaskInput> = { ...input };
  if (input.title !== undefined) out.title = input.title.trim();
  if (input.memo !== undefined) out.memo = input.memo?.trim() ? input.memo.trim() : null;
  if (input.due_date !== undefined) out.due_date = input.due_date || null;
  return out;
}

export const taskStore = {
  async list(): Promise<Task[]> {
    return load().tasks;
  },

  async create(input: TaskInput): Promise<Task> {
    const n = normalize(input) as TaskInput;
    if (!n.title) throw new Error("タイトルは必須です");
    const now = nowIso();
    const task: Task = {
      id: uid(),
      user_id: MOCK_USER_ID,
      title: n.title,
      due_date: n.due_date ?? null,
      status: n.status ?? "todo",
      memo: n.memo ?? null,
      category: n.category ?? "work",
      completed_at: n.status === "done" ? now : null,
      created_at: now,
      updated_at: now,
    };
    const store = load();
    save({ ...store, tasks: [...store.tasks, task] });
    return task;
  },

  async update(id: string, patch: Partial<TaskInput>): Promise<Task> {
    const store = load();
    const prev = store.tasks.find((t) => t.id === id);
    if (!prev) throw new Error("タスクが見つかりません");
    const n = normalize(patch);
    if (n.title !== undefined && !n.title) throw new Error("タイトルは必須です");
    const next: Task = { ...prev, ...n, updated_at: nowIso() };
    // 完了日時：完了にした時だけ記録、再開したら消す
    if (next.status === "done" && prev.status !== "done") next.completed_at = next.updated_at;
    if (next.status !== "done") next.completed_at = null;
    save({ ...store, tasks: store.tasks.map((t) => (t.id === id ? next : t)) });
    return next;
  },

  async remove(id: string): Promise<void> {
    const store = load();
    save({ ...store, tasks: store.tasks.filter((t) => t.id !== id) });
  },
};
