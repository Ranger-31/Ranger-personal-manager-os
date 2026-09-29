import type { DailyFocus, Routine, RoutineLog } from "@/lib/types";
import type { LogMap } from "@/lib/calc/routine";
import type { Repository } from "@/lib/repo/types";
import {
  MOCK_HISTORY_DAYS,
  MOCK_STREAK_DAYS,
  MOCK_USER_ID,
  mockFocusTemplate,
  mockGoals,
  mockKpis,
  mockRoutines,
  mockTodayProgress,
} from "@/lib/mock/data";
import { isScheduledOn } from "@/lib/calc/routine";
import { addDays, toDateKey } from "@/lib/utils";

/**
 * Mock Repository（localStorage 永続化）
 * 実機で数日触っても状態が残るように保存する。
 */

const STORAGE_KEY = "pmos:local:v2";

type Store = {
  seededOn: string;
  routines: Routine[];
  logs: Record<string, RoutineLog>; // key: `${date}|${routineId}`
  focus: DailyFocus[];
};

const logKey = (date: string, routineId: string) => `${date}|${routineId}`;
const nowIso = () => new Date().toISOString();
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 10)}`;

// 決定的な乱数（毎回同じ履歴になるように）
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeLog(routine: Routine, date: string, value: number | true | false): RoutineLog {
  const numeric = routine.type === "numeric";
  const n = typeof value === "number" ? value : value ? (routine.target_number ?? 1) : 0;
  return {
    id: uid("log"),
    routine_id: routine.id,
    user_id: MOCK_USER_ID,
    log_date: date,
    is_completed: numeric ? n >= (routine.target_number ?? 1) : value === true,
    numeric_value: numeric ? n : null,
    note: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

function seed(): Store {
  const today = toDateKey(new Date());
  const rand = mulberry32(20260929);
  const logs: Store["logs"] = {};

  for (let back = MOCK_HISTORY_DAYS; back >= 1; back--) {
    const date = addDays(today, -back);
    const inStreak = back <= MOCK_STREAK_DAYS;
    const breakDay = back === MOCK_STREAK_DAYS + 1;
    for (const r of mockRoutines) {
      if (!isScheduledOn(r, date)) continue;
      let done: boolean;
      if (r.is_critical) {
        done = inStreak ? true : breakDay ? r.id !== "r-sales-input" : rand() < 0.9;
      } else {
        done = rand() < (inStreak ? 0.8 : 0.68);
      }
      if (done) {
        logs[logKey(date, r.id)] = makeLog(r, date, true);
      } else if (r.type === "numeric" && rand() < 0.6) {
        const partial = Math.floor(rand() * (r.target_number ?? 1));
        if (partial > 0) logs[logKey(date, r.id)] = makeLog(r, date, partial);
      }
    }
  }

  for (const r of mockRoutines) {
    const v = mockTodayProgress[r.id];
    if (v !== undefined && isScheduledOn(r, today)) logs[logKey(today, r.id)] = makeLog(r, today, v);
  }

  return { seededOn: today, routines: mockRoutines, logs, focus: [] };
}

let memory: Store | null = null;

function load(): Store {
  if (memory) return memory;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        memory = JSON.parse(raw) as Store;
        return memory;
      }
    } catch {
      /* 破損時は作り直す */
    }
  }
  memory = seed();
  save(memory);
  return memory;
}

function save(store: Store) {
  memory = store;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* プライベートモード等では保存しない（メモリ上で動作） */
  }
}

function logsFor(store: Store, date: string): LogMap {
  const map: LogMap = {};
  for (const r of store.routines) {
    const l = store.logs[logKey(date, r.id)];
    if (l) map[r.id] = l;
  }
  return map;
}

export const mockRepository: Repository = {
  async listGoals() {
    return mockGoals;
  },

  async listKpis() {
    return mockKpis;
  },

  async listRoutines() {
    return load().routines.filter((r) => r.is_active);
  },

  async createRoutine(input) {
    const store = load();
    const sameSlot = store.routines.filter(
      (r) => r.category === input.category && r.time_of_day === input.time_of_day,
    );
    const routine: Routine = {
      ...input,
      id: uid("r"),
      user_id: MOCK_USER_ID,
      action_id: null,
      sort_order: Math.max(0, ...sameSlot.map((r) => r.sort_order)) + 1,
      is_active: true,
      created_at: nowIso(),
    };
    save({ ...store, routines: [...store.routines, routine] });
    return routine;
  },

  async getLogsByDate(dateKey) {
    return logsFor(load(), dateKey);
  },

  async getLogsInRange(fromKey, toKey) {
    const store = load();
    const out: Record<string, LogMap> = {};
    for (let d = fromKey; d <= toKey; d = addDays(d, 1)) out[d] = logsFor(store, d);
    return out;
  },

  async upsertLog(routineId, dateKey, patch) {
    const store = load();
    const routine = store.routines.find((r) => r.id === routineId);
    if (!routine) throw new Error(`routine not found: ${routineId}`);
    const key = logKey(dateKey, routineId);
    const prev = store.logs[key] ?? makeLog(routine, dateKey, false);
    const next: RoutineLog = { ...prev, ...patch, updated_at: nowIso() };
    if (routine.type === "numeric") {
      next.is_completed = (next.numeric_value ?? 0) >= (routine.target_number ?? 1);
    }
    save({ ...store, logs: { ...store.logs, [key]: next } });
    return next;
  },

  async getFocus(dateKey) {
    const store = load();
    const existing = store.focus.filter((f) => f.focus_date === dateKey);
    if (existing.length || dateKey < store.seededOn) {
      return existing.sort((a, b) => a.sort_order - b.sort_order);
    }
    // モック：その日のFocusが未設定ならテンプレートから作成
    const created: DailyFocus[] = mockFocusTemplate.slice(0, 3).map((f) => ({
      ...f,
      id: uid("focus"),
      user_id: MOCK_USER_ID,
      focus_date: dateKey,
    }));
    save({ ...store, focus: [...store.focus, ...created] });
    return created;
  },

  async resetDemo() {
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
    memory = null;
    load();
  },
};
