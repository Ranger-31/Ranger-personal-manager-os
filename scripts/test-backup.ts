import { strict as assert } from "node:assert";
import { applyBackup, BackupError, buildBackup, parseBackup, ROUTINE_KEY, TASKS_KEY, type KV } from "@/lib/backup";

// バックアップの単体テスト：npx tsx scripts/test-backup.ts
const mem = (init: Record<string, string> = {}): KV & { dump: () => Record<string, string> } => {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
};

const routineStore = {
  seededOn: "2026-09-29",
  routines: [
    { id: "r1", user_id: "u", goal_id: null, kpi_id: null, action_id: null, title: "法人営業", category: "work",
      time_of_day: "work", type: "numeric", target_number: 1, unit: "社", frequency: "weekdays", custom_days: null,
      is_critical: true, sort_order: 1, is_active: true, created_at: "2026-09-29T00:00:00+09:00" },
  ],
  logs: { "2026-09-29|r1": { id: "l1", routine_id: "r1", user_id: "u", log_date: "2026-09-29", is_completed: true,
    numeric_value: 1, note: null, created_at: "x", updated_at: "x" } },
  focus: [],
};
const taskStore = { version: 1, tasks: [{ id: "t1", user_id: "u", title: "報告書作成", due_date: "2026-09-30",
  status: "todo", memo: null, category: "work", completed_at: null, created_at: "x", updated_at: "x" }] };

const src = mem({ [ROUTINE_KEY]: JSON.stringify(routineStore), [TASKS_KEY]: JSON.stringify(taskStore) });
const file = JSON.stringify(buildBackup(src));

// 1) 検証・概要
const { backup, summary } = parseBackup(file);
assert.deepEqual([summary.routines, summary.logDays, summary.tasks, summary.openTasks], [1, 1, 1, 1]);

// 2) 空の端末へ復元
const empty = mem();
applyBackup(empty, backup);
assert.equal(empty.getItem(ROUTINE_KEY), src.getItem(ROUTINE_KEY));
assert.equal(empty.getItem(TASKS_KEY), src.getItem(TASKS_KEY));

// 3) 既存データがある端末へ復元（置き換え）
const other = mem({ [ROUTINE_KEY]: '{"seededOn":"2026-01-01","routines":[],"logs":{},"focus":[]}', [TASKS_KEY]: '{"version":1,"tasks":[]}' });
applyBackup(other, backup);
assert.deepEqual(other.dump(), src.dump());

// 4) 途中で失敗 → 両方とも元に戻る（Routineだけ復元・Tasks消失を作らない）
const orig = { [ROUTINE_KEY]: "ORIGINAL-R", [TASKS_KEY]: "ORIGINAL-T" };
const failing = mem(orig);
const baseSet = failing.setItem;
let calls = 0;
failing.setItem = (k, v) => {
  calls += 1;
  if (k === TASKS_KEY && calls === 2) throw new Error("QuotaExceeded");
  baseSet(k, v);
};
assert.throws(() => applyBackup(failing, backup), BackupError);
assert.deepEqual(failing.dump(), orig, "失敗時は両キーとも元のまま");

// 5) 不正ファイル
const bad = [
  "not json",
  "{}",
  JSON.stringify({ app: "shop-routine", version: 1, items: [], records: {} }),
  JSON.stringify({ ...JSON.parse(file), format: 99 }),
  JSON.stringify({ ...JSON.parse(file), data: { routineStore: { ...routineStore, routines: [{ id: "x" }] }, taskStore } }),
  JSON.stringify({ ...JSON.parse(file), data: { routineStore, taskStore: { version: 1, tasks: [{ id: "t", title: "", status: "todo" }] } } }),
  JSON.stringify({ ...JSON.parse(file), data: { routineStore } }),
];
for (const b of bad) assert.throws(() => parseBackup(b), BackupError, b.slice(0, 40));

// 6) 書き出したファイルを再読み込み → 同じ内容
const again = parseBackup(JSON.stringify(parseBackup(file).backup));
assert.deepEqual(again.backup.data, backup.data);

// 7) Tasks未作成の端末のバックアップ（taskStore=null）も復元でき、復元先のTasksキーは空になる
const onlyR = mem({ [ROUTINE_KEY]: JSON.stringify(routineStore) });
const b2 = parseBackup(JSON.stringify(buildBackup(onlyR))).backup;
const dst = mem({ [TASKS_KEY]: JSON.stringify(taskStore) });
applyBackup(dst, b2);
assert.equal(dst.getItem(TASKS_KEY), null);

console.log("all backup tests passed");
