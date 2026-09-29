import { strict as assert } from "node:assert";
import {
  applyBackup,
  BackupError,
  backupFromSnapshot,
  buildBackup,
  parseBackup,
  restoreSnapshot,
  ROUTINE_KEY,
  TASKS_KEY,
  type KV,
} from "@/lib/backup";

// バックアップの単体テスト：npx tsx scripts/test-backup.ts
type MemKV = KV & { dump: () => Record<string, string>; fail: Set<string>; failRemove: Set<string>; silent: Set<string> };
const mem = (init: Record<string, string> = {}): MemKV => {
  const m = new Map(Object.entries(init));
  const fail = new Set<string>(); // setItem で例外
  const failRemove = new Set<string>(); // removeItem で例外
  const silent = new Set<string>(); // 例外なしで保存されない
  return {
    fail, failRemove, silent,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      if (fail.has(k)) throw new Error("QuotaExceededError");
      if (silent.has(k)) return;
      m.set(k, String(v));
    },
    removeItem: (k) => {
      if (failRemove.has(k)) throw new Error("remove failed");
      m.delete(k);
    },
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
  focus: [{ id: "f1", user_id: "u", focus_date: "2026-09-29", title: "法人営業", action_id: null, routine_id: "r1", sort_order: 1 }],
};
const taskStore = { version: 1, tasks: [{ id: "t1", user_id: "u", title: "報告書作成", due_date: "2026-09-30",
  status: "todo", memo: null, category: "work", completed_at: null, created_at: "x", updated_at: "x" }] };
const R = JSON.stringify(routineStore);
const T = JSON.stringify(taskStore);
const ORIG = { [ROUTINE_KEY]: "ORIGINAL-R", [TASKS_KEY]: "ORIGINAL-T" };

const file = JSON.stringify(buildBackup(mem({ [ROUTINE_KEY]: R, [TASKS_KEY]: T })));
const { backup, summary } = parseBackup(file);

// 1) 形式バージョン・保存先情報・Focusを含む全データ
const f = JSON.parse(file);
assert.equal(f.formatVersion, 1);
assert.deepEqual(f.sources, { routine: { key: ROUTINE_KEY, present: true }, tasks: { key: TASKS_KEY, present: true } });
assert.deepEqual([summary.routines, summary.logDays, summary.focus, summary.tasks], [1, 1, 1, 1]);

// 2) 空の端末 → 復元
let kv = mem();
assert.equal(applyBackup(kv, backup).status, "ok");
assert.deepEqual(kv.dump(), { [ROUTINE_KEY]: R, [TASKS_KEY]: T });

// 3) 保存先が未作成（空データ）のバックアップ：両方 null → 復元先の両キーは削除される
const emptyFile = buildBackup(mem());
assert.deepEqual(emptyFile.sources, { routine: { key: ROUTINE_KEY, present: false }, tasks: { key: TASKS_KEY, present: false } });
const emptyParsed = parseBackup(JSON.stringify(emptyFile));
assert.equal(emptyParsed.summary.hasData, false);
kv = mem({ [ROUTINE_KEY]: R, [TASKS_KEY]: T });
assert.equal(applyBackup(kv, emptyParsed.backup).status, "ok");
assert.deepEqual(kv.dump(), {});
// 片方だけ未作成（Tasksなし）
const onlyR = parseBackup(JSON.stringify(buildBackup(mem({ [ROUTINE_KEY]: R }))));
kv = mem({ [TASKS_KEY]: T });
assert.equal(applyBackup(kv, onlyR.backup).status, "ok");
assert.deepEqual(kv.dump(), { [ROUTINE_KEY]: R });

// 4) 2つ目（Tasks）の書き込み失敗 → 元に戻したことを確認 → rolledBack
kv = mem(ORIG);
kv.fail.add(TASKS_KEY);
let res = applyBackup(kv, backup);
assert.equal(res.status, "rolledBack");
assert.deepEqual(kv.dump(), ORIG);

// 5) 1つ目（Routine）の書き込み失敗 → rolledBack（何も変わっていない）
kv = mem(ORIG);
kv.fail.add(ROUTINE_KEY);
res = applyBackup(kv, backup);
assert.equal(res.status, "rolledBack");
assert.deepEqual(kv.dump(), ORIG);

// 6) 黙って保存されない端末 → 書き込み後の確認で検出 → rolledBack
kv = mem(ORIG);
kv.silent.add(TASKS_KEY);
res = applyBackup(kv, backup);
assert.equal(res.status, "rolledBack");
assert.deepEqual(kv.dump(), ORIG);

// 7) 書き込み失敗 ＋ 元に戻す処理も失敗 → failed（成功扱いにしない）・状態と控えを返す
kv = mem(ORIG);
let n = 0;
const baseSet = kv.setItem;
kv.setItem = (k, v) => {
  n += 1;
  if (k === TASKS_KEY) throw new Error("QuotaExceededError"); // Tasks は書けない
  if (n > 1 && k === ROUTINE_KEY) throw new Error("QuotaExceededError"); // Routine の巻き戻しも失敗
  baseSet(k, v);
};
res = applyBackup(kv, backup);
assert.equal(res.status, "failed");
if (res.status !== "failed") throw new Error();
assert.deepEqual(res.state, { routine: "backup", tasks: "original" }, "Routineだけ置き換わった状態を正しく報告");
assert.deepEqual(res.snapshot, { routine: "ORIGINAL-R", tasks: "ORIGINAL-T" }, "復元前の控えを保持");
const failedSnap = res.snapshot;
// 控えは書き出し可能なファイルになる（壊れた生データは null ではなくエラーとして扱う）
assert.throws(() => backupFromSnapshot(failedSnap), BackupError);
const realSnap = { routine: R, tasks: T };
const rescue = parseBackup(backupFromSnapshot(realSnap));
assert.equal(rescue.summary.routines, 1);
// 容量が戻れば、控えから元に戻せる
kv.setItem = baseSet;
assert.equal(restoreSnapshot(kv, failedSnap), true);
assert.deepEqual(kv.dump(), ORIG);

// 8) 未作成だった保存先を戻せない（removeItem失敗）→ failed
kv = mem({ [ROUTINE_KEY]: "ORIGINAL-R" }); // Tasks 保存先は未作成
kv.fail.add(ROUTINE_KEY);
kv.failRemove.add(TASKS_KEY);
res = applyBackup(kv, backup);
assert.equal(res.status, "rolledBack", "Routine書き込み失敗時点でTasksは未変更なので戻す必要なし");

// 9) 不正ファイル（両側とも検証）
const good = JSON.parse(file);
const bad: [string, unknown][] = [
  ["not json", "not json"],
  ["空オブジェクト", {}],
  ["別アプリ", { app: "shop-routine", version: 1, items: [], records: {} }],
  ["バージョンなし", { ...good, formatVersion: undefined }],
  ["新しいバージョン", { ...good, formatVersion: 2 }],
  ["保存先情報が違う", { ...good, sources: { ...good.sources, tasks: { key: "other", present: true } } }],
  ["中身と保存先情報の不一致", { ...good, data: { ...good.data, taskStore: null } }],
  ["Routine欠損", { ...good, data: { ...good.data, routineStore: { ...routineStore, routines: [{ id: "x" }] } } }],
  ["記録のキー不整合", { ...good, data: { ...good.data, routineStore: { ...routineStore, logs: { "2026-01-01|zz": routineStore.logs["2026-09-29|r1"] } } } }],
  ["Focus不正", { ...good, data: { ...good.data, routineStore: { ...routineStore, focus: [{ id: 1 }] } } }],
  ["Taskタイトル空", { ...good, data: { ...good.data, taskStore: { version: 1, tasks: [{ ...taskStore.tasks[0], title: "" }] } } }],
  ["Tasks欠落", { ...good, data: { routineStore } }],
];
for (const [label, b] of bad) {
  assert.throws(() => parseBackup(typeof b === "string" ? b : JSON.stringify(b)), BackupError, label);
}
assert.throws(() => parseBackup(JSON.stringify({ ...good, formatVersion: 2 })), /新しいバージョン/);

// 10) 書き出し → 再読み込みで同一
assert.deepEqual(parseBackup(JSON.stringify(backup)).backup.data, backup.data);

// 11) 端末の保存内容が壊れている場合、空として書き出さずエラー
assert.throws(() => buildBackup(mem({ [ROUTINE_KEY]: "{broken" })), BackupError);

console.log("all backup tests passed");
