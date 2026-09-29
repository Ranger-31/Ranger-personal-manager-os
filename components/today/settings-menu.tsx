"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Download, MoreHorizontal, RotateCcw, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useResetDemo } from "@/hooks/use-today";
import {
  applyBackup,
  BackupError,
  backupFileName,
  buildBackup,
  parseBackup,
  readCurrent,
  summarize,
  type BackupFile,
  type DataSummary,
} from "@/lib/backup";
import { resetRoutineCache } from "@/lib/repo/mock-repository";
import { resetTaskCache } from "@/lib/repo/task-store";
import { cn } from "@/lib/utils";
import { suppressCelebration } from "./daily-progress";

type Mode = { kind: "main" } | { kind: "preview"; backup: BackupFile; summary: DataSummary } | { kind: "reset" };

/**
 * 右上メニュー：バックアップ（書き出し／読み込み）と記録のリセット
 * 読み込みは「検証 → 概要表示 → 置き換えの確定」までデータを変更しない。
 */
export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: "main" });
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [current, setCurrent] = useState<DataSummary | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const reset = useResetDemo();

  const refreshCurrent = () => setCurrent(summarize(readCurrent(window.localStorage)));

  const exportFile = async () => {
    setMessage(null);
    const json = JSON.stringify(buildBackup(window.localStorage), null, 2);
    const name = backupFileName();
    const file = new File([json], name, { type: "application/json" });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Personal Manager OS バックアップ" });
        setMessage({ tone: "ok", text: "バックアップを書き出しました" });
        return;
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setMessage({ tone: "ok", text: `バックアップを書き出しました（${name}）` });
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setMessage(null);
    try {
      const { backup, summary } = parseBackup(await f.text()); // 検証のみ。データは変更しない
      refreshCurrent();
      setMode({ kind: "preview", backup, summary });
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
    try {
      applyBackup(window.localStorage, backup);
    } catch (e) {
      setMode({ kind: "main" });
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "復元できませんでした" });
      return;
    }
    // 端末の保存内容を読み直して画面へ反映（入れ替え直後の達成演出は出さない）
    suppressCelebration();
    resetRoutineCache();
    resetTaskCache();
    qc.resetQueries();
    refreshCurrent();
    setMode({ kind: "main" });
    setMessage({ tone: "ok", text: "バックアップから復元しました" });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
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
          <SheetTitle>{mode.kind === "preview" ? "バックアップから復元しますか？" : "設定"}</SheetTitle>
          <SheetDescription>
            {mode.kind === "preview"
              ? "内容を確認してください。「置き換える」を押すまで端末のデータは変更されません。"
              : "記録はこの端末（このアプリ）にのみ保存しています。"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 pt-3 pb-6">
          {mode.kind === "preview" && current && (
            <PreviewPanel
              summary={mode.summary}
              exportedAt={mode.backup.exportedAt}
              current={current}
              onCancel={() => setMode({ kind: "main" })}
              onConfirm={() => restore(mode.backup)}
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
                  Routine・記録・Streak・Tasksをまとめて1つのファイルに書き出します。機種変更先で「読み込む」と引き継げます。
                </p>
                {current && (
                  <p data-current-summary className="tabular mt-2 text-[12.5px] text-foreground">
                    現在：Routine {current.routines}件・記録 {current.logDays}日分・Task {current.tasks}件
                  </p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={exportFile}>
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
                {message && (
                  <p
                    role="status"
                    className={cn(
                      "mt-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold",
                      message.tone === "ok" ? "bg-accent-soft text-accent" : "bg-overdue-soft text-overdue",
                    )}
                  >
                    {message.text}
                  </p>
                )}
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

function PreviewPanel({
  summary,
  exportedAt,
  current,
  onCancel,
  onConfirm,
}: {
  summary: DataSummary;
  exportedAt: string;
  current: DataSummary;
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
      </dl>
      <div className="rounded-2xl bg-overdue-soft px-4 py-3.5 text-[13.5px] leading-relaxed">
        <p className="font-bold">現在のデータを置き換えます</p>
        <p className="mt-1">
          この端末の現在のデータ（Routine {current.routines}件・記録 {current.logDays}日分・Task {current.tasks}
          件）はすべて消え、バックアップの内容に置き換わります。元に戻せないため、必要なら先に現在のデータを書き出してください。
        </p>
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
