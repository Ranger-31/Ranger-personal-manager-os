# Personal Manager OS v0.1

Goal → KPI → Action → Routine → Log をつなぐ個人用マネジメントOS。

## 現在の状態：Phase 1（UIプロトタイプ）

- バックエンド・AI API は未接続。**記録は端末の localStorage に保存**
- 初期データは実機検証用の実Routine（Work 5件・平日）。過去ログなし、Streak は0日から開始（`lib/mock/data.ts`）
- 実装済み：**Today 画面**、Routine追加フォーム、PWA（manifest / App icon / iOS Splash / Standalone）
- Goals / Analytics / AI は Today 承認後に実装（現在はプレースホルダー）
- **Tasks（単発タスク）**：タイトル・期限・状態（未着手／進行中／完了）・メモ・区分。期限切れ→今日→今後→期限なし→完了の順に表示。Todayには期限切れ・今日期限の未完了のみ表示。Routine達成率・Streakには算入しない
  - 保存キーは `pmos:tasks:v1`（Routineの `pmos:local:v2` とは別。既存データに触れない）。Routine側のリセットでは消えない

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

## Vercel で実機確認

1. Vercel で「Add New → Project」から、このリポジトリを Import
2. 設定はデフォルトのまま Deploy（Framework: Next.js）
3. iPhone の Safari でURLを開き「共有 → ホーム画面に追加」
