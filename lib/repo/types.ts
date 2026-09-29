import type { DailyFocus, Goal, Kpi, NewRoutineInput, Routine, RoutineLog } from "@/lib/types";
import type { LogMap } from "@/lib/calc/routine";

/**
 * Repository インターフェース
 * UI は必ずこのインターフェース経由でデータにアクセスする。
 * Phase 1：mock（localStorage）実装 / Phase 2：Supabase 実装に差し替える。
 */
export interface Repository {
  listGoals(): Promise<Goal[]>;
  listKpis(): Promise<Kpi[]>;

  listRoutines(): Promise<Routine[]>;
  createRoutine(input: NewRoutineInput): Promise<Routine>;

  getLogsByDate(dateKey: string): Promise<LogMap>;
  getLogsInRange(fromKey: string, toKey: string): Promise<Record<string, LogMap>>;
  upsertLog(
    routineId: string,
    dateKey: string,
    patch: Partial<Pick<RoutineLog, "is_completed" | "numeric_value" | "note">>,
  ): Promise<RoutineLog>;

  getFocus(dateKey: string): Promise<DailyFocus[]>;

  /** Phase 1 専用：デモデータを初期状態に戻す */
  resetDemo?(): Promise<void>;
}
