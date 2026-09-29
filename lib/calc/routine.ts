import type { Routine, RoutineLog } from "@/lib/types";
import { addDays, fromDateKey, toDateKey } from "@/lib/utils";

/**
 * 計算ロジック
 * 「Routine達成率」と「Daily Streak」は別指標として扱う。
 *   - Routine達成率：その日に予定された全Routineのうち完了した割合
 *   - 必須Routine  ：is_critical = true のRoutineの完了数
 *   - Daily Streak ：その日の必須Routineを「すべて」達成した日の連続日数
 */

export type LogMap = Record<string, RoutineLog | undefined>; // key: routine_id

/** そのRoutineが指定日に予定されているか */
export function isScheduledOn(routine: Routine, dateKey: string): boolean {
  if (!routine.is_active) return false;
  // 作成日より前の日には予定しない（端末ローカル日付で比較）
  if (toDateKey(new Date(routine.created_at)) > dateKey) return false;
  const dow = fromDateKey(dateKey).getDay();
  switch (routine.frequency) {
    case "daily":
      return true;
    case "weekdays":
      return dow >= 1 && dow <= 5;
    case "custom":
      return (routine.custom_days ?? []).includes(dow);
  }
}

/** ログから完了判定（numericは目標値到達で完了） */
export function isRoutineCompleted(routine: Routine, log?: RoutineLog): boolean {
  if (!log) return false;
  if (routine.type === "numeric") {
    const target = routine.target_number ?? 1;
    return (log.numeric_value ?? 0) >= target;
  }
  return log.is_completed;
}

export type DaySummary = {
  total: number;
  completed: number;
  rate: number; // 0-100
  criticalTotal: number;
  criticalCompleted: number;
  /** 必須がすべて達成されたか（必須が0件の日は null） */
  criticalAchieved: boolean | null;
};

export function summarizeDay(routines: Routine[], logs: LogMap, dateKey: string): DaySummary {
  const scheduled = routines.filter((r) => isScheduledOn(r, dateKey));
  const critical = scheduled.filter((r) => r.is_critical);
  const completed = scheduled.filter((r) => isRoutineCompleted(r, logs[r.id])).length;
  const criticalCompleted = critical.filter((r) => isRoutineCompleted(r, logs[r.id])).length;
  return {
    total: scheduled.length,
    completed,
    rate: scheduled.length === 0 ? 0 : Math.round((completed / scheduled.length) * 100),
    criticalTotal: critical.length,
    criticalCompleted,
    criticalAchieved: critical.length === 0 ? null : criticalCompleted === critical.length,
  };
}

export type StreakInfo = {
  /** 現在の連続日数（今日が達成済みなら今日を含む） */
  days: number;
  /** 今日の必須をすべて達成済みか */
  todayAchieved: boolean;
};

/**
 * Daily Streak
 * - 今日：必須を全達成していればカウント。未達成でも「途中」なので途切れない。
 * - 過去：必須を全達成した日は+1、1つでも未達なら終了。
 * - 必須Routineが0件の日：途切れさせず、カウントもしない。
 */
export function calcStreak(
  routines: Routine[],
  logsByDate: Record<string, LogMap>,
  todayKey: string,
  maxLookback = 365,
): StreakInfo {
  const today = summarizeDay(routines, logsByDate[todayKey] ?? {}, todayKey);
  const todayAchieved = today.criticalAchieved === true;

  let days = todayAchieved ? 1 : 0;
  let cursor = addDays(todayKey, -1);
  for (let i = 0; i < maxLookback; i++) {
    const s = summarizeDay(routines, logsByDate[cursor] ?? {}, cursor);
    if (s.criticalAchieved === false) break;
    if (s.criticalAchieved === true) days += 1;
    // 予定Routineが0件＝記録開始前とみなして終了
    if (s.total === 0) break;
    cursor = addDays(cursor, -1);
  }
  return { days, todayAchieved };
}

export function progressOf(routine: Routine, log?: RoutineLog): number {
  if (routine.type === "numeric") {
    const target = routine.target_number ?? 1;
    return Math.min(100, Math.round(((log?.numeric_value ?? 0) / target) * 100));
  }
  return log?.is_completed ? 100 : 0;
}
