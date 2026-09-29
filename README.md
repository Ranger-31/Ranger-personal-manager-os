# Personal Manager OS v0.1

Goal → KPI → Action → Routine → Log をつなぐ個人用マネジメントOS。

## 現在の状態：Phase 1（UIプロトタイプ）

- バックエンド・AI API は未接続。**記録は端末の localStorage に保存**
- 新規利用時は Routine を自動登録しない（空から開始し、＋から登録）。端末に保存済みの Routine・記録・Streak はそのまま保持
- 実装済み：**Today 画面**、Routine追加フォーム、PWA（manifest / App icon / iOS Splash / Standalone）
- Goals / Analytics / AI は Today 承認後に実装（現在はプレースホルダー）
- **Tasks（単発タスク）**：タイトル・期限・状態（未着手／進行中／完了）・メモ・区分。期限切れ→今日→今後→期限なし→完了の順に表示。Todayには期限切れ・今日期限の未完了のみ表示。Routine達成率・Streakには算入しない
  - 保存キーは `pmos:tasks:v1`（Routineの `pmos:local:v2` とは別。既存データに触れない）。Routine側のリセットでは消えない
- **バックアップ**：Today右上「…」→「書き出す／読み込む」。Routine・記録・Streak・Focus・Tasks の保存データを丸ごと1ファイル（`pmos-backup-YYYY-MM-DD-HHMM.json`）に書き出し、機種変更先で読み込める
  - ファイルには形式バージョン（`formatVersion`）と保存先情報を記録。保存先が未作成の空データも扱える
  - 読み込みは Routine側・Tasks側の両方を検証 → 概要表示 → 「置き換える」確定まで端末のデータを変更しない。現在データがある場合は確認画面から先に書き出せる
  - localStorage は2つの保存先をまとめて書き込めないため、書き込み失敗時は元に戻す処理を試みる。**元に戻す処理も容量不足などで失敗しうる**ため、その場合は成功と表示せず、保存先ごとの状態を知らせ、復元前のデータの書き出しと再試行を案内する

## 仕様変更の反映（v0.1 仕様書からの差分）

| 項目 | 内容 |
|---|---|
| Personal表示 | ALL＝仕事を時間帯別＋Personalは下部 / WORK＝仕事のみ時間帯別 / PERSONAL＝Personalのみ時間帯別。`lib/today/grouping.ts` の `ALL_VIEW_MODE` を `"chronological"` にすれば ALL を時系列表示に切替可能 |
| 必須Routine | `routines.is_critical` を追加。Routine追加フォームに ON/OFF |
| Daily Streak | その日の必須Routineを**すべて**達成したら1日継続。Routine達成率とは別指標（`lib/calc/routine.ts`） |
| Streak補足 | 今日は未達でも「途中」扱いで途切れない。必須が0件の日は途切れもカウントもしない |
| 表示順 | Today では Morning → Work(Daytime) → Anytime → Evening（夜の項目が最後に来るように） |
| TODAY FOCUS | `daily_focus` テーブルを Phase 2 で追加予定（型は `DailyFocus`） |

## 構成

```
app/(app)/today        Today 画面
components/today       Today のコンポーネント
components/forms       Routine 追加シート
components/ui          shadcn/ui コンポーネント
lib/types.ts           DB設計と1:1の型
lib/repo               データ取得の窓口（mock → Phase 2 で Supabase に差し替え）
lib/calc               達成率・必須・Streak の計算
lib/today/grouping.ts  ALL / WORK / PERSONAL のセクション分け
hooks/use-today.ts     TanStack Query フック（楽観的更新）
scripts/generate-icons.mjs  App icon / Splash 生成
```

## 開発

```bash
npm install
npm run dev   # http://localhost:3000 → /today
```

右上「…」→「記録をリセットして初期状態に戻す」で初期状態に戻せます（2段階確認・元に戻せません）。

検証：`npx tsx scripts/test-backup.ts`（バックアップ単体）、`scripts/e2e-*.py`（Playwright）

## Vercel で実機確認

1. Vercel で「Add New → Project」から、このリポジトリを Import
2. 設定はデフォルトのまま Deploy（Framework: Next.js）
3. iPhone の Safari でURLを開き「共有 → ホーム画面に追加」
