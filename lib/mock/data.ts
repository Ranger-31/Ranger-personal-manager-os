import type { Action, DailyFocus, Goal, Kpi, Routine } from "@/lib/types";

/**
 * 初期データ
 * 新規利用時（保存データが空のとき）は Routine・Focus を自動登録しない。空の状態から始める。
 * すでに端末に保存されている Routine・記録・Streak はこのファイルとは無関係に保持される
 * （保存データがある場合、ここの値は一切使われない）。
 * Goal / KPI / Action は Goals 実装時に登録するため、現時点では空。
 */

export const MOCK_USER_ID = "user-local";
export const mockGoals: Goal[] = [];
export const mockKpis: Kpi[] = [];
export const mockActions: Action[] = [];

/** 新規利用時に自動登録するRoutine：なし（利用者が＋から登録する） */
export const mockRoutines: Routine[] = [];

/** 初期状態の今日の進捗（実運用のため空） */
export const mockTodayProgress: Record<string, number | true> = {};

/** TODAY FOCUS：Today画面から外したため初期設定なし */
export const mockFocusTemplate: Omit<DailyFocus, "id" | "user_id" | "focus_date">[] = [];

/** 過去ログは生成しない（実際に使った日だけが積み上がる） */
export const MOCK_HISTORY_DAYS = 0;
export const MOCK_STREAK_DAYS = 0;
