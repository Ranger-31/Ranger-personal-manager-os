"use client";

import { useEffect, useRef, useState } from "react";
import { ProgressRing } from "@/components/shared/progress-ring";
import type { DaySummary, StreakInfo } from "@/lib/calc/routine";
import { cn } from "@/lib/utils";

/**
 * 今日の達成状況
 * Routine達成率 / 必須Routine / Daily Streak を別指標として並べる
 */
export function DailyProgress({ summary, streak }: { summary: DaySummary; streak: StreakInfo }) {
  const criticalLeft = summary.criticalTotal - summary.criticalCompleted;
  const celebrate = useRisingEdge(streak.todayAchieved);

  return (
    <section className="mx-5 mt-4 rounded-card border border-border px-5 py-5">
      <div className="flex items-center gap-5">
        <ProgressRing value={summary.rate} size={124} stroke={11}>
          <span className="tabular text-[34px] leading-none font-bold tracking-tight">
            {summary.rate}
            <span className="ml-0.5 text-[16px] font-semibold text-muted">%</span>
          </span>
          <span className="mt-1.5 text-[11px] font-medium text-muted">今日の達成率</span>
        </ProgressRing>

        <div className="min-w-0 flex-1 space-y-3">
          <Stat label="Routine">
            <span className="tabular">
              {summary.completed}
              <span className="text-muted"> / {summary.total}</span>
            </span>
          </Stat>
          <Stat label="必須Routine">
            <span className={cn("tabular", streak.todayAchieved && "text-streak")}>
              {summary.criticalCompleted}
              <span className={cn(streak.todayAchieved ? "text-streak/60" : "text-muted")}>
                {" "}
                / {summary.criticalTotal}
              </span>
            </span>
          </Stat>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors",
              streak.todayAchieved ? "bg-streak text-white" : "bg-streak-soft text-streak",
              celebrate && "animate-glow",
            )}
          >
            <span aria-hidden className={cn(celebrate && "animate-pop")}>
              🔥
            </span>
            <span className="tabular text-[13px] font-bold tracking-wide">
              {streak.days} {streak.days === 1 ? "DAY" : "DAYS"}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-4 border-t border-border pt-3 text-[12.5px] text-muted">
        {summary.criticalTotal === 0 ? (
          "今日は必須Routineがありません"
        ) : streak.todayAchieved ? (
          <span className="font-semibold text-streak">必須Routineすべて達成。Streak継続中</span>
        ) : (
          <>
            必須Routineあと
            <span className="tabular mx-0.5 font-bold text-foreground">{criticalLeft}</span>
            つで
            <span className="tabular mx-0.5 font-bold text-foreground">{streak.days + 1}</span>
            日連続
          </>
        )}
      </p>
    </section>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wide text-muted">{label}</p>
      <p className="text-[22px] leading-tight font-bold tracking-tight">{children}</p>
    </div>
  );
}

/**
 * 達成演出を一時的に止める（バックアップ復元などデータの入れ替え直後は、
 * その場で達成したわけではないので演出しない）
 */
let suppressCelebrationUntil = 0;
export function suppressCelebration(ms = 3000) {
  suppressCelebrationUntil = Date.now() + ms;
}

/** false → true に変わった瞬間だけ true を返す（達成時のみアニメーション。未ロード(undefined)からの変化は無視） */
function useRisingEdge(flag: boolean | undefined, durationMs = 1000) {
  const prev = useRef(flag);
  const [fire, setFire] = useState(false);
  useEffect(() => {
    if (prev.current === false && flag === true && Date.now() >= suppressCelebrationUntil) {
      setFire(true);
      const t = setTimeout(() => setFire(false), durationMs);
      prev.current = flag;
      return () => clearTimeout(t);
    }
    prev.current = flag;
  }, [flag, durationMs]);
  return fire;
}

export { useRisingEdge };
