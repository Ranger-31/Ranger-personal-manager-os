import { STORAGE_KEY, type Store } from "@/lib/repo/mock-repository";
import { TASKS_STORAGE_KEY, type TaskStore } from "@/lib/repo/task-store";
import type { Routine, RoutineLog, Task } from "@/lib/types";

/**
 * バックアップ（書き出し／読み込み）
 *
 * 対象：端末に保存されている全データ
 *   - pmos:local:v2 … Routine・記録（Streakは記録から算出）・Focus
 *   - pmos:tasks:v1 … Tasks
 * 既存の保存形式はそのまま、2つのキーの中身を1ファイルにまとめる。
 *
 * 安全のためのルール
 *   1. parseBackup は検証だけを行い、端末のデータには一切触れない
 *   2. applyBackup は「置き換える」確定後にだけ呼ぶ。書き込み前に現状を控え、
 *      どちらかの書き込みに失敗したら両方を元に戻す（片方だけ復元される状態を作らない）
 */

/** 既存の保存キー（各ストアの定義をそのまま使う） */
export const ROUTINE_KEY = STORAGE_KEY;
export const TASKS_KEY = TASKS_STORAGE_KEY;
export const BACKUP_APP = "personal-manager-os";
export const BACKUP_FORMAT = 1;

export type BackupFile = {
  app: typeof BACKUP_APP;
  format: typeof BACKUP_FORMAT;
  exportedAt: string;
  data: {
    /** pmos:local:v2 の中身（保存前の端末では null） */
    routineStore: Store | null;
    /** pmos:tasks:v1 の中身（タスク未作成なら null） */
    taskStore: TaskStore | null;
  };
};

export type DataSummary = {
  routines: number;
  logDays: number;
  logs: number;
  tasks: number;
  openTasks: number;
  doneTasks: number;
  firstDate: string | null;
  lastDate: string | null;
};

export class BackupError extends Error {}

/** localStorage 互換の最小インターフェース（テストでも使えるように） */
export type KV = Pick<Storage, "getItem" | "setItem" | "removeItem">;

// ---------------------------------------------------------------- 書き出し

export function readCurrent(kv: KV): BackupFile["data"] {
  const parse = <T,>(raw: string | null): T | null => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  };
  return {
    routineStore: parse<Store>(kv.getItem(ROUTINE_KEY)),
    taskStore: parse<TaskStore>(kv.getItem(TASKS_KEY)),
  };
}

export function buildBackup(kv: KV, now = new Date()): BackupFile {
  return { app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt: now.toISOString(), data: readCurrent(kv) };
}

export function summarize(data: BackupFile["data"]): DataSummary {
  const logs = Object.values(data.routineStore?.logs ?? {});
  const dates = [...new Set(logs.map((l) => l.log_date))].sort();
  const tasks = data.taskStore?.tasks ?? [];
  return {
    routines: data.routineStore?.routines.length ?? 0,
    logDays: dates.length,
    logs: logs.length,
    tasks: tasks.length,
    openTasks: tasks.filter((t) => t.status !== "done").length,
    doneTasks: tasks.filter((t) => t.status === "done").length,
    firstDate: dates[0] ?? null,
    lastDate: dates.at(-1) ?? null,
  };
}

// ---------------------------------------------------------------- 検証

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isStr = (v: unknown): v is string => typeof v === "string";
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const oneOf = <T extends string>(v: unknown, list: readonly T[]): v is T => isStr(v) && (list as readonly string[]).includes(v);
const numOrNull = (v: unknown) => v === null || (typeof v === "number" && Number.isFinite(v));

function checkRoutine(r: unknown, i: number): asserts r is Routine {
  const bad = (f: string) => {
    throw new BackupError(`Routine ${i + 1}件目の「${f}」が正しくありません`);
  };
  if (!isObj(r)) bad("データ");
  const x = r as Record<string, unknown>;
  if (!isStr(x.id) || !x.id) bad("ID");
  if (!isStr(x.title) || !x.title.trim()) bad("名前");
  if (!oneOf(x.category, ["work", "personal"] as const)) bad("区分");
  if (!oneOf(x.time_of_day, ["morning", "work", "evening", "anytime"] as const)) bad("時間帯");
  if (!oneOf(x.type, ["boolean", "numeric"] as const)) bad("種類");
  if (!oneOf(x.frequency, ["daily", "weekdays", "custom"] as const)) bad("頻度");
  if (typeof x.is_critical !== "boolean") bad("必須");
  if (typeof x.is_active !== "boolean") bad("有効");
  if (!numOrNull(x.target_number)) bad("目標");
  if (!isStr(x.created_at)) bad("作成日時");
}

function checkLog(key: string, l: unknown) {
  const bad = () => {
    throw new BackupError(`記録データ（${key}）が正しくありません`);
  };
  if (!isObj(l)) bad();
  const x = l as Record<string, unknown>;
  if (!isStr(x.routine_id) || !isStr(x.log_date) || !DATE.test(x.log_date)) bad();
  if (key !== `${x.log_date}|${x.routine_id}`) bad();
  if (typeof x.is_completed !== "boolean" || !numOrNull(x.numeric_value)) bad();
}

function checkTask(t: unknown, i: number): asserts t is Task {
  const bad = (f: string) => {
    throw new BackupError(`Task ${i + 1}件目の「${f}」が正しくありません`);
  };
  if (!isObj(t)) bad("データ");
  const x = t as Record<string, unknown>;
  if (!isStr(x.id) || !x.id) bad("ID");
  if (!isStr(x.title) || !x.title.trim()) bad("タイトル");
  if (!oneOf(x.status, ["todo", "doing", "done"] as const)) bad("状態");
  if (!oneOf(x.category, ["work", "personal"] as const)) bad("区分");
  if (!(x.due_date === null || (isStr(x.due_date) && DATE.test(x.due_date)))) bad("期限");
  if (!(x.memo === null || isStr(x.memo))) bad("メモ");
  if (!isStr(x.created_at) || !isStr(x.updated_at)) bad("日時");
}

/**
 * ファイルの中身を検証して読み込む。端末のデータには触れない。
 * 不正なら BackupError を投げる。
 */
export function parseBackup(text: string): { backup: BackupFile; summary: DataSummary } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError("ファイルを読み取れませんでした（JSON形式ではありません）");
  }
  if (!isObj(raw) || raw.app !== BACKUP_APP) {
    throw new BackupError("Personal Manager OS のバックアップファイルではありません");
  }
  if (raw.format !== BACKUP_FORMAT) {
    throw new BackupError("対応していないバックアップ形式です");
  }
  if (!isStr(raw.exportedAt) || Number.isNaN(Date.parse(raw.exportedAt))) {
    throw new BackupError("バックアップの作成日時が正しくありません");
  }
  if (!isObj(raw.data)) throw new BackupError("バックアップの中身がありません");

  const rs = raw.data.routineStore;
  if (rs !== null) {
    if (!isObj(rs) || !Array.isArray(rs.routines) || !isObj(rs.logs) || !Array.isArray(rs.focus) || !isStr(rs.seededOn)) {
      throw new BackupError("Routine・記録データの形式が正しくありません");
    }
    rs.routines.forEach(checkRoutine);
    const ids = new Set((rs.routines as Routine[]).map((r) => r.id));
    if (ids.size !== rs.routines.length) throw new BackupError("RoutineのIDが重複しています");
    for (const [k, l] of Object.entries(rs.logs)) checkLog(k, l);
  }

  const ts = raw.data.taskStore;
  if (ts !== null) {
    if (!isObj(ts) || ts.version !== 1 || !Array.isArray(ts.tasks)) {
      throw new BackupError("Tasksデータの形式が正しくありません");
    }
    ts.tasks.forEach(checkTask);
    if (new Set((ts.tasks as Task[]).map((t) => t.id)).size !== ts.tasks.length) {
      throw new BackupError("TaskのIDが重複しています");
    }
  }
  if (rs === undefined || ts === undefined) throw new BackupError("バックアップの中身が不足しています");

  const backup = raw as unknown as BackupFile;
  return { backup, summary: summarize(backup.data) };
}

// ---------------------------------------------------------------- 置き換え（確定後のみ）

/**
 * 端末のデータをバックアップの内容で置き換える。
 * 書き込み前に現状を控え、途中で失敗したら両キーとも元の状態に戻す。
 */
export function applyBackup(kv: KV, backup: BackupFile): void {
  const prev = { routine: kv.getItem(ROUTINE_KEY), tasks: kv.getItem(TASKS_KEY) };
  const next = {
    routine: backup.data.routineStore ? JSON.stringify(backup.data.routineStore) : null,
    tasks: backup.data.taskStore ? JSON.stringify(backup.data.taskStore) : null,
  };
  const put = (key: string, v: string | null) => (v === null ? kv.removeItem(key) : kv.setItem(key, v));
  try {
    put(ROUTINE_KEY, next.routine);
    put(TASKS_KEY, next.tasks);
    // 書き込み結果を確認（ストレージが黙って失敗する端末への対策）
    if (kv.getItem(ROUTINE_KEY) !== next.routine || kv.getItem(TASKS_KEY) !== next.tasks) {
      throw new Error("verify failed");
    }
  } catch {
    try {
      put(ROUTINE_KEY, prev.routine);
      put(TASKS_KEY, prev.tasks);
    } catch {
      /* 元に戻す操作も失敗した場合は何もしない（元データは上書き前のまま残っている可能性が高い） */
    }
    throw new BackupError("復元できませんでした（端末に保存できません）。元のデータはそのまま残しています");
  }
}

// ---------------------------------------------------------------- 表示用

export function backupFileName(now = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `pmos-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

export type { Routine, RoutineLog, Task };
