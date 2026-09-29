import type { Action, DailyFocus, Goal, Kpi, Routine } from "@/lib/types";

/**
 * モックデータ（Phase 1 専用）
 * 例：福岡西店 月間売上100万円 + Personal
 */

export const MOCK_USER_ID = "user-demo";
const CREATED = "2026-08-01T00:00:00+09:00";

export const mockGoals: Goal[] = [
  {
    id: "goal-west-sales",
    user_id: MOCK_USER_ID,
    title: "福岡西店 月間売上100万円",
    category: "work",
    target_value: 1_000_000,
    current_value: 720_000,
    unit: "円",
    start_date: "2026-09-01",
    deadline: "2026-09-30",
    status: "active",
    created_at: CREATED,
  },
  {
    id: "goal-exercise",
    user_id: MOCK_USER_ID,
    title: "運動 月25日",
    category: "personal",
    target_value: 25,
    current_value: 20,
    unit: "日",
    start_date: "2026-09-01",
    deadline: "2026-09-30",
    status: "active",
    created_at: CREATED,
  },
];

export const mockKpis: Kpi[] = [
  { id: "kpi-sales", user_id: MOCK_USER_ID, goal_id: "goal-west-sales", title: "月間売上", target_value: 1_000_000, current_value: 720_000, unit: "円", period: "monthly", created_at: CREATED },
  { id: "kpi-corp-sales", user_id: MOCK_USER_ID, goal_id: "goal-west-sales", title: "法人売上", target_value: 300_000, current_value: 180_000, unit: "円", period: "monthly", created_at: CREATED },
  { id: "kpi-reservations", user_id: MOCK_USER_ID, goal_id: "goal-west-sales", title: "予約件数", target_value: 80, current_value: 65, unit: "件", period: "monthly", created_at: CREATED },
  { id: "kpi-reviews", user_id: MOCK_USER_ID, goal_id: "goal-west-sales", title: "Google口コミ", target_value: 10, current_value: 6, unit: "件", period: "monthly", created_at: CREATED },
];

export const mockActions: Action[] = [
  { id: "act-corp", user_id: MOCK_USER_ID, goal_id: "goal-west-sales", kpi_id: "kpi-corp-sales", title: "法人5社へ営業", target_value: 5, current_value: 3, unit: "社", deadline: "2026-10-04", status: "active", created_at: CREATED },
  { id: "act-vacancy", user_id: MOCK_USER_ID, goal_id: "goal-west-sales", kpi_id: "kpi-reservations", title: "空車車両の販促", target_value: 3, current_value: 1, unit: "件", deadline: "2026-10-04", status: "active", created_at: CREATED },
  { id: "act-staff", user_id: MOCK_USER_ID, goal_id: "goal-west-sales", kpi_id: null, title: "スタッフ教育", target_value: 3, current_value: 2, unit: "回", deadline: "2026-10-04", status: "active", created_at: CREATED },
];

type R = Omit<Routine, "user_id" | "created_at" | "is_active" | "action_id" | "custom_days"> &
  Partial<Pick<Routine, "action_id" | "custom_days">>;

const routine = (r: R): Routine => ({
  user_id: MOCK_USER_ID,
  created_at: CREATED,
  is_active: true,
  action_id: null,
  custom_days: null,
  ...r,
});

export const mockRoutines: Routine[] = [
  // WORK / MORNING
  routine({ id: "r-prev-sales", title: "前日の売上確認", category: "work", time_of_day: "morning", type: "boolean", target_number: null, unit: null, frequency: "daily", is_critical: true, sort_order: 1, goal_id: "goal-west-sales", kpi_id: "kpi-sales" }),
  routine({ id: "r-reservations", title: "本日の予約確認", category: "work", time_of_day: "morning", type: "boolean", target_number: null, unit: null, frequency: "daily", is_critical: true, sort_order: 2, goal_id: "goal-west-sales", kpi_id: "kpi-reservations" }),
  routine({ id: "r-vacancy", title: "空車確認", category: "work", time_of_day: "morning", type: "boolean", target_number: null, unit: null, frequency: "daily", is_critical: true, sort_order: 3, goal_id: "goal-west-sales", kpi_id: "kpi-reservations", action_id: "act-vacancy" }),
  routine({ id: "r-staff-shift", title: "スタッフ配置確認", category: "work", time_of_day: "morning", type: "boolean", target_number: null, unit: null, frequency: "daily", is_critical: false, sort_order: 4, goal_id: null, kpi_id: null }),

  // WORK / WORK
  routine({ id: "r-corp-sales", title: "法人営業", category: "work", time_of_day: "work", type: "numeric", target_number: 1, unit: "社", frequency: "weekdays", is_critical: true, sort_order: 1, goal_id: "goal-west-sales", kpi_id: "kpi-corp-sales", action_id: "act-corp" }),
  routine({ id: "r-reviews", title: "Google口コミ確認", category: "work", time_of_day: "work", type: "boolean", target_number: null, unit: null, frequency: "daily", is_critical: false, sort_order: 2, goal_id: "goal-west-sales", kpi_id: "kpi-reviews" }),
  routine({ id: "r-staff-talk", title: "スタッフ声掛け", category: "work", time_of_day: "work", type: "numeric", target_number: 3, unit: "人", frequency: "daily", is_critical: false, sort_order: 3, goal_id: null, kpi_id: null, action_id: "act-staff" }),
  routine({ id: "r-gbp", title: "GBP確認", category: "work", time_of_day: "work", type: "boolean", target_number: null, unit: null, frequency: "daily", is_critical: false, sort_order: 4, goal_id: "goal-west-sales", kpi_id: "kpi-reviews" }),

  // WORK / EVENING
  routine({ id: "r-sales-input", title: "本日の売上入力", category: "work", time_of_day: "evening", type: "boolean", target_number: null, unit: null, frequency: "daily", is_critical: true, sort_order: 1, goal_id: "goal-west-sales", kpi_id: "kpi-sales" }),
  routine({ id: "r-tomorrow-cars", title: "明日の車両配置", category: "work", time_of_day: "evening", type: "boolean", target_number: null, unit: null, frequency: "daily", is_critical: false, sort_order: 2, goal_id: null, kpi_id: null }),
  routine({ id: "r-review-day", title: "今日の振り返り", category: "work", time_of_day: "evening", type: "boolean", target_number: null, unit: null, frequency: "daily", is_critical: false, sort_order: 3, goal_id: null, kpi_id: null }),

  // PERSONAL
  routine({ id: "p-weight", title: "体重を記録", category: "personal", time_of_day: "morning", type: "boolean", target_number: null, unit: null, frequency: "daily", is_critical: false, sort_order: 1, goal_id: null, kpi_id: null }),
  routine({ id: "p-stretch", title: "朝のストレッチ", category: "personal", time_of_day: "morning", type: "boolean", target_number: null, unit: null, frequency: "daily", is_critical: false, sort_order: 2, goal_id: null, kpi_id: null }),
  routine({ id: "p-water", title: "水を飲む", category: "personal", time_of_day: "anytime", type: "numeric", target_number: 8, unit: "杯", frequency: "daily", is_critical: false, sort_order: 1, goal_id: null, kpi_id: null }),
  routine({ id: "p-exercise", title: "30分運動", category: "personal", time_of_day: "anytime", type: "boolean", target_number: null, unit: null, frequency: "daily", is_critical: false, sort_order: 2, goal_id: "goal-exercise", kpi_id: null }),
  routine({ id: "p-reading", title: "読書", category: "personal", time_of_day: "evening", type: "numeric", target_number: 20, unit: "分", frequency: "daily", is_critical: false, sort_order: 1, goal_id: null, kpi_id: null }),
  routine({ id: "p-journal", title: "日記", category: "personal", time_of_day: "evening", type: "boolean", target_number: null, unit: null, frequency: "daily", is_critical: false, sort_order: 2, goal_id: null, kpi_id: null }),
  routine({ id: "p-sleep", title: "23時までに就寝", category: "personal", time_of_day: "evening", type: "boolean", target_number: null, unit: null, frequency: "daily", is_critical: false, sort_order: 3, goal_id: null, kpi_id: null }),
];

/** 初回起動日の「今日」の状態（朝10時ごろを想定） */
export const mockTodayProgress: Record<string, number | true> = {
  "r-prev-sales": true,
  "r-reservations": true,
  "r-staff-shift": true,
  "r-reviews": true,
  "r-staff-talk": 3,
  "r-gbp": true,
  "p-weight": true,
  "p-stretch": true,
  "p-water": 3,
  "p-exercise": true,
};

/** TODAY FOCUS のテンプレート（最大3件） */
export const mockFocusTemplate: Omit<DailyFocus, "id" | "user_id" | "focus_date">[] = [
  { title: "法人1社へ営業", action_id: "act-corp", routine_id: "r-corp-sales", sort_order: 1 },
  { title: "空車対策", action_id: "act-vacancy", routine_id: "r-vacancy", sort_order: 2 },
  { title: "スタッフ教育", action_id: "act-staff", routine_id: "r-staff-talk", sort_order: 3 },
];

/** 過去ログ生成用：Streakを「昨日まで5日連続」にするための設定 */
export const MOCK_HISTORY_DAYS = 42;
export const MOCK_STREAK_DAYS = 5;
