import type { Action, DailyFocus, Goal, Kpi, Routine } from "@/lib/types";

/**
 * 初期データ（Phase 1 実機検証用）
 * 実際に3〜7日間使用するRoutine。過去ログは持たず、Streakは0日から開始する。
 * Goal / KPI / Action は Goals 実装時に登録するため、現時点では空。
 */

export const MOCK_USER_ID = "user-local";
/** 検証開始日。この日から予定に入る */
const CREATED = "2026-09-29T00:00:00+09:00";

export const mockGoals: Goal[] = [];
export const mockKpis: Kpi[] = [];
export const mockActions: Action[] = [];

type R = Pick<
  Routine,
  "id" | "title" | "category" | "time_of_day" | "type" | "target_number" | "unit" | "frequency" | "is_critical" | "sort_order"
>;

const routine = (r: R): Routine => ({
  user_id: MOCK_USER_ID,
  goal_id: null,
  kpi_id: null,
  action_id: null,
  custom_days: null,
  is_active: true,
  created_at: CREATED,
  ...r,
});

export const mockRoutines: Routine[] = [
  routine({ id: "r-gbp", title: "GBP投稿・口コミ確認", category: "work", time_of_day: "work", type: "boolean", target_number: null, unit: null, frequency: "weekdays", is_critical: true, sort_order: 1 }),
  routine({ id: "r-posting", title: "ポスティング", category: "work", time_of_day: "work", type: "numeric", target_number: 50, unit: "枚", frequency: "weekdays", is_critical: true, sort_order: 2 }),
  routine({ id: "r-corp-sales", title: "法人営業", category: "work", time_of_day: "work", type: "numeric", target_number: 1, unit: "社", frequency: "weekdays", is_critical: true, sort_order: 3 }),
  routine({ id: "r-corp-call", title: "法人架電", category: "work", time_of_day: "work", type: "numeric", target_number: 3, unit: "社", frequency: "weekdays", is_critical: true, sort_order: 4 }),
  routine({ id: "r-area-research", title: "地域調査", category: "work", time_of_day: "work", type: "boolean", target_number: null, unit: null, frequency: "weekdays", is_critical: false, sort_order: 5 }),
];

/** 初期状態の今日の進捗（実運用のため空） */
export const mockTodayProgress: Record<string, number | true> = {};

/** TODAY FOCUS の初期設定（最大3件） */
export const mockFocusTemplate: Omit<DailyFocus, "id" | "user_id" | "focus_date">[] = [
  { title: "法人営業", action_id: null, routine_id: "r-corp-sales", sort_order: 1 },
  { title: "法人架電", action_id: null, routine_id: "r-corp-call", sort_order: 2 },
  { title: "ポスティング", action_id: null, routine_id: "r-posting", sort_order: 3 },
];

/** 過去ログは生成しない（実際に使った日だけが積み上がる） */
export const MOCK_HISTORY_DAYS = 0;
export const MOCK_STREAK_DAYS = 0;
