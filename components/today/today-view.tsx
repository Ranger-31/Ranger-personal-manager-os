"use client";

import { Plus } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { RoutineFormSheet } from "@/components/forms/routine-form-sheet";
import {
  useFocus,
  useHistory,
  useLogs,
  useRoutines,
  useTodayKey,
  useUpsertLog,
} from "@/hooks/use-today";
import { calcStreak, isScheduledOn, summarizeDay } from "@/lib/calc/routine";
import { buildSections, type Scope } from "@/lib/today/grouping";
import { DailyProgress, useRisingEdge } from "./daily-progress";
import { RoutineGroup } from "./routine-group";
import { ScopeFilter } from "./scope-filter";
import { TodayFocus } from "./today-focus";
import { TodayHeader } from "./today-header";
import { TodaySkeleton } from "./today-skeleton";

export function TodayView() {
  const today = useTodayKey();
  const routinesQ = useRoutines();
  const logsQ = useLogs(today);
  const historyQ = useHistory(today);
  const focusQ = useFocus(today);
  const upsert = useUpsertLog(today);

  const [scope, setScope] = useState<Scope>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightTimer = useRef<number | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);
  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2800);
  }, []);

  const todays = useMemo(
    () => (today ? (routinesQ.data ?? []).filter((r) => isScheduledOn(r, today)) : []),
    [routinesQ.data, today],
  );
  const logs = useMemo(() => logsQ.data ?? {}, [logsQ.data]);

  const summary = useMemo(
    () => (today ? summarizeDay(todays, logs, today) : null),
    [todays, logs, today],
  );
  const streak = useMemo(
    () =>
      today && historyQ.data
        ? calcStreak(routinesQ.data ?? [], { ...historyQ.data, [today]: logs }, today)
        : null,
    [routinesQ.data, historyQ.data, logs, today],
  );
  const sections = useMemo(() => buildSections(todays, scope), [todays, scope]);

  const onToggle = useCallback(
    (routineId: string, completed: boolean) => {
      const r = todays.find((x) => x.id === routineId);
      if (!r) return;
      upsert.mutate({
        routineId,
        patch:
          r.type === "numeric"
            ? { numeric_value: completed ? (r.target_number ?? 1) : 0 }
            : { is_completed: completed },
      });
    },
    [todays, upsert],
  );

  const onSetNumber = useCallback(
    (routineId: string, value: number) => upsert.mutate({ routineId, patch: { numeric_value: value } }),
    [upsert],
  );

  const jumpTo = useCallback(
    (routineId: string) => {
      const r = todays.find((x) => x.id === routineId);
      // 対象が非表示のスコープなら ALL に戻す
      if (r && scope !== "all" && r.category !== scope) setScope("all");
      requestAnimationFrame(() => {
        document
          .getElementById(`routine-${routineId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedId(null);
        window.clearTimeout(highlightTimer.current);
        requestAnimationFrame(() => setHighlightedId(routineId));
        highlightTimer.current = window.setTimeout(() => setHighlightedId(null), 1500);
      });
    },
    [scope, todays],
  );

  const celebrate = useRisingEdge(streak?.todayAchieved, 2600);

  if (!today || !summary || !streak || routinesQ.isPending || logsQ.isPending) {
    return <TodaySkeleton />;
  }

  return (
    <div className="pb-6">
      <TodayHeader dateKey={today} />
      <DailyProgress summary={summary} streak={streak} />
      <TodayFocus
        focus={focusQ.data ?? []}
        routines={todays}
        logs={logs}
        onJump={jumpTo}
      />
      <ScopeFilter value={scope} onChange={setScope} />

      <div>
        {sections.map((s) => (
          <RoutineGroup
            key={s.key}
            section={s}
            logs={logs}
            highlightedId={highlightedId}
            onToggle={onToggle}
            onSetNumber={onSetNumber}
          />
        ))}
        {sections.length === 0 && (
          <p className="mx-5 mt-8 text-center text-sm text-muted">
            今日のRoutineはありません。＋から追加できます。
          </p>
        )}
      </div>

      {/* Routine追加 */}
      <button
        type="button"
        aria-label="Routineを追加"
        onClick={() => setFormOpen(true)}
        className="fixed right-[max(20px,calc(50vw-195px))] bottom-[calc(84px+env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_24px_rgba(31,122,92,0.35)] transition-transform active:scale-90"
      >
        <Plus className="size-6" strokeWidth={2.4} />
      </button>

      <RoutineFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultCategory={scope === "personal" ? "personal" : "work"}
        onCreated={(r) => {
          if (isScheduledOn(r, today)) {
            setTimeout(() => jumpTo(r.id), 350);
          } else {
            showNotice(`「${r.title}」を追加しました。予定の曜日に表示されます`);
          }
        }}
      />

      {notice && !celebrate && (
        <div
          role="status"
          className="animate-fade-up fixed inset-x-5 bottom-[calc(152px+env(safe-area-inset-bottom))] z-50 mx-auto max-w-[390px] rounded-2xl bg-foreground px-5 py-3 text-center text-[13.5px] font-semibold text-white shadow-lg"
        >
          {notice}
        </div>
      )}

      {celebrate && (
        <div
          role="status"
          className="animate-fade-up fixed inset-x-0 bottom-[calc(152px+env(safe-area-inset-bottom))] z-50 mx-auto w-fit rounded-full bg-foreground px-5 py-3 text-[13.5px] font-semibold text-white shadow-lg"
        >
          🔥 必須Routineすべて達成 — {streak.days}日連続
        </div>
      )}
    </div>
  );
}
