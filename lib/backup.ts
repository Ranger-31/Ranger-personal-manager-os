import { STORAGE_KEY, type Store } from "@/lib/repo/mock-repository";
import { TASKS_STORAGE_KEY, type TaskStore } from "@/lib/repo/task-store";
import type { Routine, RoutineLog, Task } from "@/lib/types";

/**
 * バックアップ（書き出し／読み込み）
 *
 * 対象：端末に保存されている全データを丸ごと
 *   - pmos:local:v2 … Routine・記録（Streakは記録から算出）・Focus
 *   - pmos:tasks:v1 … Tasks
 * 既存の保存形式は変更せず、2つの保存先の中身をそのまま1ファイルにまとめる。
 * 保存先が未作成（まだ一度も保存していない）の場合は null として扱う。
 *
 * 安全のためのルール
 *   1. parseBackup は検証だけを行い、端末のデータには一切触れない（Routine側・Tasks側の両方を検証）
 *   2. applyBackup は「置き換える」確定後にだけ呼ぶ
 *   3. localStorage に複数の保存先をまとめて書き込む仕組み（トランザクション）は無い。
 *      書き込み前に現状を控え、失敗したら元に戻す処理を試みるが、元に戻す処理自体も
 *      容量不足などで失敗しうる。その場合は成功扱いにせず、状況と控えを呼び出し元へ返す。
 */

/** 既存の保存キー（各ストアの定義をそのまま使う） */
export const ROUTINE_KEY = STORAGE_KEY;
export const TASKS_KEY = TASKS_STORAGE_KEY;
export const BACKUP_APP = "personal-manager-os";
/** バックアップ形式のバージョン。形式を変える時はここを上げ、読み込み側で対応する */
export const BACKUP_FORMAT_VERSION = 1;

export type BackupFile = {
  app: typeof BACKUP_APP;
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  exportedAt: string;
  /** どの保存先の中身か（互換性の確認用） */
  sources: {
    routine: { key: string; present: boolean };
    tasks: { key: string; present: boolean };
  };
  data: {
    /** pmos:local:v2 の中身（保存先が未作成なら null） */
    routineStore: Store | null;
    /** pmos:tasks:v1 の中身（保存先が未作成なら null） */
    taskStore: TaskStore | null;
  };
};

export type DataSummary = {
  routines: number;
  logDays: number;
  logs: number;
  focus: number;
  tasks: number;
  openTasks: number;
  doneTasks: number;
  firstDate: string | null;
  lastDate: string | null;
  /** どちらかの保存先に何か入っているか */
  hasData: boolean;
};

export class BackupError extends Error {}

/** localStorage 互換の最小インターフェース（テストでも使えるように） */
export type KV = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** 端末の保存先の生の中身（控え） */
export type Snapshot = { routine: string | null; tasks: string | null };

export function takeSnapshot(kv: KV): Snapshot {
  return { routine: kv.getItem(ROUTINE_KEY), tasks: kv.getItem(TASKS_KEY) };
}

// ---------------------------------------------------------------- 書き出し

/** 端末の保存内容を読む。中身が壊れていて読めない場合は、黙って空扱いにせずエラーにする */
export function readCurrent(kv: KV): BackupFile["data"] {
  const parse = <T,>(raw: string | null, label: string): T | null => {
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new BackupError(`端末の${label}データを読み取れません`);
    }
  };
  const snap = takeSnapshot(kv);
  return {
    routineStore: parse<Store>(snap.routine, "Routine・記録"),
    taskStore: parse<TaskStore>(snap.tasks, "Tasks"),
  };
}

export function buildBackup(kv: KV, now = new Date()): BackupFile {
  const data = readCurrent(kv);
  return {
    app: BACKUP_APP,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    sources: {
      routine: { key: ROUTINE_KEY, present: data.routineStore !== null },
      tasks: { key: TASKS_KEY, present: data.taskStore !== null },
    },
    data,
  };
}

/** 控え（生の文字列）からバックアップファイルを作る。復旧できなかった時の退避用 */
export function backupFromSnapshot(snap: Snapshot, now = new Date()): string {
  const kv: KV = {
    getItem: (k) => (k === ROUTINE_KEY ? snap.routine : k === TASKS_KEY ? snap.tasks : null),
    setItem: () => {},
    removeItem: () => {},
  };
  return JSON.stringify(buildBackup(kv, now), null, 2);
}

export function summarize(data: BackupFile["data"]): DataSummary {
  const logs = Object.values(data.routineStore?.logs ?? {});
  const dates = [...new Set(logs.map((l) => l.log_date))].sort();
  const tasks = data.taskStore?.tasks ?? [];
  const routines = data.routineStore?.routines.length ?? 0;
  return {
    routines,
    logDays: dates.length,
    logs: logs.length,
    focus: data.routineStore?.focus.length ?? 0,
    tasks: tasks.length,
    openTasks: tasks.filter((t) => t.status !== "done").length,
    doneTasks: tasks.filter((t) => t.status === "done").length,
    firstDate: dates[0] ?? null,
    lastDate: dates.at(-1) ?? null,
    hasData: routines > 0 || logs.length > 0 || tasks.length > 0,
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

function checkFocus(f: unknown, i: number) {
  const x = f as Record<string, unknown>;
  if (!isObj(f) || !isStr(x.id) || !isStr(x.title) || !isStr(x.focus_date) || !DATE.test(x.focus_date)) {
    throw new BackupError(`Focus ${i + 1}件目が正しくありません`);
  }
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

/** Routine側（pmos:local:v2）の検証。null（保存先未作成）も可 */
function checkRoutineStore(rs: unknown) {
  if (rs === null) return;
  if (!isObj(rs) || !Array.isArray(rs.routines) || !isObj(rs.logs) || !Array.isArray(rs.focus) || !isStr(rs.seededOn)) {
    throw new BackupError("Routine・記録データの形式が正しくありません");
  }
  rs.routines.forEach(checkRoutine);
  if (new Set((rs.routines as Routine[]).map((r) => r.id)).size !== rs.routines.length) {
    throw new BackupError("RoutineのIDが重複しています");
  }
  for (const [k, l] of Object.entries(rs.logs)) checkLog(k, l);
  rs.focus.forEach(checkFocus);
}

/** Tasks側（pmos:tasks:v1）の検証。null（保存先未作成）も可 */
function checkTaskStore(ts: unknown) {
  if (ts === null) return;
  if (!isObj(ts) || ts.version !== 1 || !Array.isArray(ts.tasks)) {
    throw new BackupError("Tasksデータの形式が正しくありません");
  }
  ts.tasks.forEach(checkTask);
  if (new Set((ts.tasks as Task[]).map((t) => t.id)).size !== ts.tasks.length) {
    throw new BackupError("TaskのIDが重複しています");
  }
}

/**
 * ファイルの中身を検証して読み込む。端末のデータには触れない。
 * Routine側・Tasks側の両方を検証し、1つでも不正なら BackupError を投げる。
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
  if (typeof raw.formatVersion !== "number") {
    throw new BackupError("バックアップ形式のバージョンがありません");
  }
  if (raw.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new BackupError("新しいバージョンのアプリで作られたバックアップです。アプリを更新してから読み込んでください");
  }
  if (raw.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new BackupError("対応していないバックアップ形式です");
  }
  if (!isStr(raw.exportedAt) || Number.isNaN(Date.parse(raw.exportedAt))) {
    throw new BackupError("バックアップの作成日時が正しくありません");
  }
  const src = raw.sources;
  if (
    !isObj(src) || !isObj(src.routine) || !isObj(src.tasks) ||
    src.routine.key !== ROUTINE_KEY || src.tasks.key !== TASKS_KEY
  ) {
    throw new BackupError("バックアップの保存先情報がこのアプリと一致しません");
  }
  if (!isObj(raw.data) || !("routineStore" in raw.data) || !("taskStore" in raw.data)) {
    throw new BackupError("バックアップの中身が不足しています");
  }
  const { routineStore, taskStore } = raw.data;
  if ((routineStore !== null) !== src.routine.present || (taskStore !== null) !== src.tasks.present) {
    throw new BackupError("バックアップの中身と保存先情報が一致しません");
  }
  checkRoutineStore(routineStore);
  checkTaskStore(taskStore);

  const backup = raw as unknown as BackupFile;
  return { backup, summary: summarize(backup.data) };
}

// ---------------------------------------------------------------- 置き換え（確定後のみ）

export type ApplyResult =
  /** 置き換え完了（書き込み後の内容も確認済み） */
  | { status: "ok" }
  /** 置き換えに失敗し、元のデータに戻したことを確認済み */
  | { status: "rolledBack"; snapshot: Snapshot }
  /** 置き換えにも、元に戻す処理にも失敗。端末の状態は不確か */
  | { status: "failed"; snapshot: Snapshot; state: { routine: KeyState; tasks: KeyState } };

/** 各保存先がいま何になっているか */
export type KeyState = "original" | "backup" | "unknown";

const put = (kv: KV, key: string, v: string | null) => (v === null ? kv.removeItem(key) : kv.setItem(key, v));

function stateOf(kv: KV, key: string, original: string | null, target: string | null): KeyState {
  try {
    const v = kv.getItem(key);
    if (v === original) return "original";
    if (v === target) return "backup";
  } catch {
    /* noop */
  }
  return "unknown";
}

/** 控えの内容へ戻す。戻せたことを読み直して確認できた場合だけ true */
export function restoreSnapshot(kv: KV, snap: Snapshot): boolean {
  let ok = true;
  for (const [key, v] of [
    [ROUTINE_KEY, snap.routine],
    [TASKS_KEY, snap.tasks],
  ] as const) {
    try {
      if (kv.getItem(key) !== v) put(kv, key, v);
    } catch {
      ok = false; // 片方が失敗しても、もう片方は戻しにいく
    }
  }
  try {
    return ok && kv.getItem(ROUTINE_KEY) === snap.routine && kv.getItem(TASKS_KEY) === snap.tasks;
  } catch {
    return false;
  }
}

/**
 * 端末のデータをバックアップの内容で置き換える。
 * 失敗時は元に戻す処理を試み、その結果をそのまま返す（成功を装わない）。
 */
export function applyBackup(kv: KV, backup: BackupFile): ApplyResult {
  const snapshot = takeSnapshot(kv);
  const target: Snapshot = {
    routine: backup.data.routineStore ? JSON.stringify(backup.data.routineStore) : null,
    tasks: backup.data.taskStore ? JSON.stringify(backup.data.taskStore) : null,
  };
  try {
    put(kv, ROUTINE_KEY, target.routine);
    put(kv, TASKS_KEY, target.tasks);
    // 書き込み結果を読み直して確認（黙って保存に失敗する端末への対策）
    if (kv.getItem(ROUTINE_KEY) !== target.routine || kv.getItem(TASKS_KEY) !== target.tasks) {
      throw new Error("verify failed");
    }
    return { status: "ok" };
  } catch {
    if (restoreSnapshot(kv, snapshot)) return { status: "rolledBack", snapshot };
    return {
      status: "failed",
      snapshot,
      state: {
        routine: stateOf(kv, ROUTINE_KEY, snapshot.routine, target.routine),
        tasks: stateOf(kv, TASKS_KEY, snapshot.tasks, target.tasks),
      },
    };
  }
}

// ---------------------------------------------------------------- 表示用

export function backupFileName(now = new Date(), prefix = "pmos-backup") {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${prefix}-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`;
}

export type { Routine, RoutineLog, Task };
