"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Download, MoreHorizontal, RotateCcw, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useResetDemo } from "@/hooks/use-today";
import {
  applyBackup,
  BackupError,
  backupFileName,
  backupFromSnapshot,
  buildBackup,
  parseBackup,
  readCurrent,
  restoreSnapshot,
  summarize,
  type BackupFile,
  type DataSummary,
  type KeyState,
  type Snapshot,
} from "@/lib/backup";
import { resetRoutineCache } from "@/lib/repo/mock-repository";
import { resetTaskCache } from "@/lib/repo/task-store";
import { cn } from "@/lib/utils";
import { suppressCelebration } from "./daily-progress";

type Mode =
  | { kind: "main" }
  | { kind: "preview"; backup: BackupFile; summary: DataSummary; exportedCurrent: boolean }
  | { kind: "failed"; snapshot: Snapshot; state: { routine: KeyState; tasks: KeyState }; rescued: boolean }
  | { kind: "reset" };

type Msg = { tone: "ok" | "error"; text: string } | null;

/** ファイルを端末に保存（共有シートが使えればそれを、無ければダウンロード） */
async function saveFile(json: string, name: string, title: string): Promise<"saved" | "cancelled"> {
  const file = new File([json], name, { type: "application/json" });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return "saved";
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") return "cancelled";
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "saved";
}

const STATE_LABEL: Record<KeyState, string> = {
  original: "復元前のまま",
  backup: "バックアップの内容に置き換わっています",
  unknown: "状態を確認できません",
};

/**
 * 右上メニュー：バックアップ（書き出し／読み込み）と記録のリセット
 * 読み込みは「検証 → 概要表示 → 置き換えの確定」までデータを変更しない。
 * 置き換えに失敗した場合は結果をそのまま伝え、成功とは表示しない。
 */
export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: "main" });
  const [message, setMessage] = useState<Msg>(null);
  const [current, setCurrent] = useState<DataSummary | null>(null);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const reset = useResetDemo();

  const refreshCurrent = () => {
    try {
      setCurrent(summarize(readCurrent(window.localStorage)));
      setCurrentError(null);
    } catch (e) {
      setCurrent(null);
      setCurrentError(e instanceof Error ? e.message : "端末のデータを読み取れません");
    }
  };

  /** 画面を端末の保存内容に合わせ直す */
  const reloadViews = () => {
    suppressCelebration(); // 入れ替え直後の達成演出は出さない
    resetRoutineCache();
    resetTaskCache();
    qc.resetQueries();
    refreshCurrent();
  };

  /** 現在の端末データを書き出す。成功したら true */
  const exportCurrent = async (): Promise<boolean> => {
    try {
      const name = backupFileName();
      const r = await saveFile(JSON.stringify(buildBackup(window.localStorage), null, 2), name, "Personal Manager OS バックアップ");
      return r === "saved";
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof BackupError ? `${e.message}。書き出せませんでした` : "書き出せませんでした" });
      return false;
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setMessage(null);
    try {
      const { backup, summary } = parseBackup(await f.text()); // 検証のみ。データは変更しない
      refreshCurrent();
      setMode({ kind: "preview", backup, summary, exportedCurrent: false });
    } catch (e) {
      setMessage({
        tone: "error",
        text: `${e instanceof BackupError ? e.message : "ファイルを読み取れませんでした"}。現在のデータは変更していません。`,
      });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const restore = (backup: BackupFile) => {
    let result: ReturnType<typeof applyBackup>;
    try {
      result = applyBackup(window.localStorage, backup);
    } catch {
      // applyBackup は通常例外を投げないが、念のため成功扱いにしない
      result = { status: "failed", snapshot: { routine: null, tasks: null }, state: { routine: "unknown", tasks: "unknown" } };
    }
    reloadViews();
    if (result.status === "ok") {
      setMode({ kind: "main" });
      setMessage({ tone: "ok", text: "バックアップから復元しました" });
    } else if (result.status === "rolledBack") {
      setMode({ kind: "main" });
      setMessage({
        tone: "error",
        text: "復元できませんでした（端末に保存できませんでした）。元のデータに戻っていることを確認しました。",
      });
    } else {
      setMode({ kind: "failed", snapshot: result.snapshot, state: result.state, rescued: false });
      setMessage(null);
    }
  };

  const retryRollback = (snap: Snapshot) => {
    const ok = restoreSnapshot(window.localStorage, snap);
    reloadViews();
    if (ok) {
      setMode({ kind: "main" });
      setMessage({ tone: "ok", text: "復元前のデータに戻したことを確認しました" });
    } else {
      setMessage({ tone: "error", text: "まだ元に戻せません。空き容量を確保してから、もう一度お試しください。" });
    }
  };

  const title =
    mode.kind === "preview" ? "バックアップから復元しますか？" : mode.kind === "failed" ? "復元を完了できませんでした" : "設定";

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        // 復旧が必要な状態では、誤って閉じないようにする
        if (!o && mode.kind === "failed") return;
        setOpen(o);
        if (o) refreshCurrent();
        else {
          setMode({ kind: "main" });
          setMessage(null);
        }
      }}
    >
      <SheetTrigger asChild>
        <button
          aria-label="メニュー"
          className="flex size-10 items-center justify-center rounded-full text-muted active:bg-surface-muted"
        >
          <MoreHorizontal className="size-5" />
        </button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode.kind === "preview"
              ? "内容を確認してください。「置き換える」を押すまで端末のデータは変更されません。"
              : mode.kind === "failed"
                ? "端末のデータが一部だけ置き換わっている可能性があります。"
                : "記録はこの端末（このアプリ）にのみ保存しています。"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 pt-3 pb-6">
          {mode.kind === "preview" && current && (
            <PreviewPanel
              summary={mode.summary}
              exportedAt={mode.backup.exportedAt}
              formatVersion={mode.backup.formatVersion}
              current={current}
              exportedCurrent={mode.exportedCurrent}
              onExportCurrent={async () => {
                if (await exportCurrent()) setMode({ ...mode, exportedCurrent: true });
              }}
              onCancel={() => setMode({ kind: "main" })}
              onConfirm={() => restore(mode.backup)}
            />
          )}
          {mode.kind === "preview" && !current && (
            <p className="rounded-2xl bg-overdue-soft px-4 py-3 text-[13.5px] font-semibold text-overdue">
              {currentError}。安全のため復元は行いません。
            </p>
          )}

          {mode.kind === "failed" && (
            <FailedPanel
              state={mode.state}
              rescued={mode.rescued}
              message={message}
              onRescue={async () => {
                try {
                  const r = await saveFile(
                    backupFromSnapshot(mode.snapshot),
                    backupFileName(new Date(), "pmos-before-restore"),
                    "復元前のデータ",
                  );
                  if (r === "saved") setMode({ ...mode, rescued: true });
                } catch {
                  setMessage({ tone: "error", text: "復元前のデータを書き出せませんでした" });
                }
              }}
              onRetry={() => retryRollback(mode.snapshot)}
              onClose={() => {
                setMode({ kind: "main" });
                setMessage({ tone: "error", text: "復元は完了していません。データを確認してください。" });
              }}
            />
          )}

          {mode.kind === "reset" && (
            <div className="space-y-3">
              <p className="text-[13.5px] leading-relaxed text-foreground">
                これまでのRoutineの記録・Streak・追加したRoutineがすべて消え、初期状態に戻ります。元に戻せません。Tasks（単発タスク）は消えません。
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => setMode({ kind: "main" })}>
                  やめる
                </Button>
                <Button
                  className="bg-[#c2410c] hover:bg-[#9a3412]"
                  disabled={reset.isPending}
                  onClick={() =>
                    reset.mutate(undefined, {
                      onSuccess: () => {
                        setMode({ kind: "main" });
                        setOpen(false);
                      },
                    })
                  }
                >
                  消去する
                </Button>
              </div>
            </div>
          )}

          {mode.kind === "main" && (
            <>
              <section>
                <h3 className="text-[12px] font-bold tracking-[0.1em] text-muted">バックアップ</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                  Routine・記録・Streak・Focus・Tasksの保存データをまとめて1つのファイルに書き出します。機種変更先で「読み込む」と引き継げます。
                </p>
                {current && (
                  <p data-current-summary className="tabular mt-2 text-[12.5px] text-foreground">
                    現在：Routine {current.routines}件・記録 {current.logDays}日分・Task {current.tasks}件
                  </p>
                )}
                {currentError && <p className="mt-2 text-[12.5px] font-semibold text-overdue">{currentError}</p>}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      setMessage(null);
                      if (await exportCurrent()) setMessage({ tone: "ok", text: "バックアップを書き出しました" });
                    }}
                  >
                    <Download className="size-4" />
                    書き出す
                  </Button>
                  <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                    <Upload className="size-4" />
                    読み込む
                  </Button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  data-testid="backup-input"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
                {message && <Message msg={message} />}
              </section>

              <section className="border-t border-border pt-5">
                <h3 className="text-[12px] font-bold tracking-[0.1em] text-muted">記録のリセット</h3>
                <Button variant="secondary" className="mt-3 w-full" onClick={() => setMode({ kind: "reset" })}>
                  <RotateCcw className="size-4" />
                  記録をリセットして初期状態に戻す
                </Button>
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Message({ msg }: { msg: NonNullable<Msg> }) {
  return (
    <p
      role="status"
      data-tone={msg.tone}
      className={cn(
        "mt-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold leading-relaxed",
        msg.tone === "ok" ? "bg-accent-soft text-accent" : "bg-overdue-soft text-overdue",
      )}
    >
      {msg.text}
    </p>
  );
}

function PreviewPanel({
  summary,
  exportedAt,
  formatVersion,
  current,
  exportedCurrent,
  onExportCurrent,
  onCancel,
  onConfirm,
}: {
  summary: DataSummary;
  exportedAt: string;
  formatVersion: number;
  current: DataSummary;
  exportedCurrent: boolean;
  onExportCurrent: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const range =
    summary.firstDate && summary.lastDate ? `${fmtDate(summary.firstDate)} 〜 ${fmtDate(summary.lastDate)}` : "記録なし";
  return (
    <div data-backup-preview className="space-y-3">
      <dl className="divide-y divide-border rounded-2xl border border-border text-[14px]">
        <Row label="作成日時" value={fmtDateTime(exportedAt)} />
        <Row label="Routine" value={`${summary.routines}件`} />
        <Row label="記録" value={`${summary.logDays}日分（${summary.logs}件）`} />
        <Row label="記録の期間" value={range} />
        <Row label="Task" value={`${summary.tasks}件（未完了 ${summary.openTasks}・完了 ${summary.doneTasks}）`} />
        <Row label="形式" value={`バージョン ${formatVersion}`} />
      </dl>
      <div className="rounded-2xl bg-overdue-soft px-4 py-3.5 text-[13.5px] leading-relaxed">
        <p className="font-bold">現在のデータを置き換えます</p>
        <p className="mt-1">
          この端末の現在のデータ（Routine {current.routines}件・記録 {current.logDays}日分・Task {current.tasks}
          件）は、バックアップの内容に置き換わります。元に戻せません。
        </p>
        {current.hasData && (
          <div className="mt-3">
            {exportedCurrent ? (
              <p data-exported-current className="flex items-center gap-1.5 font-bold text-accent">
                <Check className="size-4" strokeWidth={3} />
                現在のデータを書き出しました
              </p>
            ) : (
              <Button variant="outline" className="h-11 w-full bg-surface" onClick={onExportCurrent}>
                <Download className="size-4" />
                先に現在のデータを書き出す
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={onCancel}>
          やめる
        </Button>
        <Button className="bg-[#c2410c] hover:bg-[#9a3412]" onClick={onConfirm}>
          置き換える
        </Button>
      </div>
    </div>
  );
}

function FailedPanel({
  state,
  rescued,
  message,
  onRescue,
  onRetry,
  onClose,
}: {
  state: { routine: KeyState; tasks: KeyState };
  rescued: boolean;
  message: Msg;
  onRescue: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div data-restore-failed className="space-y-3">
      <div className="rounded-2xl bg-overdue-soft px-4 py-3.5 text-[13.5px] leading-relaxed">
        <p className="flex items-center gap-1.5 font-bold text-overdue">
          <AlertTriangle className="size-4" />
          復元できず、元に戻す処理も完了できませんでした
        </p>
        <p className="mt-1.5">端末の空き容量不足などが原因の可能性があります。現在の状態：</p>
        <ul className="mt-1.5 space-y-0.5">
          <li>
            ・Routine・記録：<span className="font-bold">{STATE_LABEL[state.routine]}</span>
          </li>
          <li>
            ・Tasks：<span className="font-bold">{STATE_LABEL[state.tasks]}</span>
          </li>
        </ul>
        <p className="mt-2">
          復元前のデータはアプリの画面を閉じるまで一時的に保持しています。まず書き出して保管してください。
        </p>
      </div>
      {rescued ? (
        <p data-rescued className="flex items-center gap-1.5 text-[14px] font-bold text-accent">
          <Check className="size-4" strokeWidth={3} />
          復元前のデータを書き出しました
        </p>
      ) : (
        <Button className="w-full" onClick={onRescue}>
          <Download className="size-4" />
          復元前のデータを書き出す
        </Button>
      )}
      <Button variant="secondary" className="w-full" onClick={onRetry}>
        <RotateCcw className="size-4" />
        元に戻す処理をもう一度試す
      </Button>
      {message && <Message msg={message} />}
      <button type="button" onClick={onClose} className="w-full py-2 text-[13px] font-semibold text-muted">
        このまま閉じる（復元は完了していません）
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="tabular text-right font-semibold">{value}</dd>
    </div>
  );
}

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];
function fmtDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${m}/${d}（${WEEK[dt.getDay()]}）`;
}
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
