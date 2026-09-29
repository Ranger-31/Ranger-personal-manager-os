/**
 * ドメイン型
 * 仕様書 17章「DB設計」と1:1で対応させる（Phase 2 で Supabase の型に置き換えやすくするため）。
 * 仕様変更：routines.is_critical（必須Routine）を追加。
 */

export type Category = "work" | "personal";
export type TimeOfDay = "morning" | "work" | "evening" | "anytime";
export type RoutineType = "boolean" | "numeric";
export type Frequency = "daily" | "weekdays" | "custom";
export type Status = "active" | "completed" | "archived";
export type KpiPeriod = "daily" | "weekly" | "monthly";

export type Goal = {
  id: string;
  user_id: string;
  title: string;
  category: Category;
  target_value: number;
  current_value: number;
  unit: string;
  start_date: string;
  deadline: string | null;
  status: Status;
  created_at: string;
};

export type Kpi = {
  id: string;
  user_id: string;
  goal_id: string | null;
  title: string;
  target_value: number;
  current_value: number;
  unit: string;
  period: KpiPeriod;
  created_at: string;
};

export type Action = {
  id: string;
  user_id: string;
  goal_id: string | null;
  kpi_id: string | null;
  title: string;
  target_value: number;
  current_value: number;
  unit: string;
  deadline: string | null;
  status: Status;
  created_at: string;
};

export type Routine = {
  id: string;
  user_id: string;
  goal_id: string | null;
  kpi_id: string | null;
  action_id: string | null;
  title: string;
  category: Category;
  time_of_day: TimeOfDay;
  type: RoutineType;
  target_number: number | null;
  unit: string | null;
  frequency: Frequency;
  /** frequency = custom のときの曜日（0=日 … 6=土） */
  custom_days: number[] | null;
  /** 必須Routine：すべて達成するとDaily Streakが継続する */
  is_critical: boolean;
  /** 同一時間帯内での表示順 */
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type RoutineLog = {
  id: string;
  routine_id: string;
  user_id: string;
  log_date: string; // YYYY-MM-DD
  is_completed: boolean;
  numeric_value: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * TODAY FOCUS（今日の最重要・最大3件）
 * Phase 2 で daily_focus テーブルとして追加予定。
 * routine_id があれば、そのRoutineの達成状況をFocusにも反映する。
 */
export type DailyFocus = {
  id: string;
  user_id: string;
  focus_date: string;
  title: string;
  action_id: string | null;
  routine_id: string | null;
  sort_order: number;
};

export type NewRoutineInput = Pick<
  Routine,
  | "title"
  | "category"
  | "time_of_day"
  | "type"
  | "target_number"
  | "unit"
  | "frequency"
  | "custom_days"
  | "is_critical"
  | "goal_id"
  | "kpi_id"
>;
