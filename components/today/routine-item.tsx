"use client";

import { Check, Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CriticalTag } from "@/components/shared/critical-tag";
import { ProgressBar } from "@/components/shared/progress-bar";
import { isRoutineCompleted, progressOf } from "@/lib/calc/routine";
import type { Routine, RoutineLog } from "@/lib/types";
import { cn, haptic } from "@/lib/utils";

type ItemProps = {
  routine: Routine;
  log?: RoutineLog;
  highlighted?: boolean;
  onToggle: (routineId: string, completed: boolean) => void;
  onSetNumber: (routineId: string, value: number) => void;
};

export function RoutineItem(props: ItemProps) {
  return props.routine.type === "numeric" ? <NumberItem {...props} /> : <CheckItem {...props} />;
}

/** チェック円。完了時のみポップアニメーション */
function CheckCircle({ done, animate }: { done: boolean; animate: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200",
        done ? "border-accent bg-accent text-white" : "border-[#d5d9df] bg-surface",
        done && animate && "animate-pop",
      )}
    >
      {done && <Check className="size-[15px]" strokeWidth={3.2} />}
    </span>
  );
}

function Title({ routine, done }: { routine: Routine; done: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span
        className={cn(
          "truncate text-[16px] font-medium transition-colors",
          done ? "text-muted" : "text-foreground",
        )}
      >
        {routine.title}
      </span>
      {routine.is_critical && <CriticalTag />}
    </span>
  );
}

/** Boolean型：行のどこをタップしても ○ → ✓（画面遷移なし） */
function CheckItem({ routine, log, highlighted, onToggle }: ItemProps) {
  const done = isRoutineCompleted(routine, log);
  const [animate, setAnimate] = useState(false);

  return (
    <button
      type="button"
      id={`routine-${routine.id}`}
      role="checkbox"
      aria-checked={done}
      onClick={() => {
        setAnimate(!done);
        if (!done) haptic();
        onToggle(routine.id, !done);
      }}
      className={cn(
        "flex min-h-[56px] w-full scroll-mt-28 items-center gap-3.5 px-4 text-left transition-colors active:bg-surface-muted",
        highlighted && "animate-highlight",
      )}
    >
      <CheckCircle done={done} animate={animate} />
      <Title routine={routine} done={done} />
    </button>
  );
}

/** Numeric型：－／＋で変更、数字タップで直接入力 */
function NumberItem({ routine, log, highlighted, onToggle, onSetNumber }: ItemProps) {
  const done = isRoutineCompleted(routine, log);
  const value = log?.numeric_value ?? 0;
  const target = routine.target_number ?? 1;
  const [animate, setAnimate] = useState(false);
  const [editing, setEditing] = useState(false);

  const set = (next: number) => {
    const v = Math.max(0, next);
    const willComplete = v >= target && !done;
    setAnimate(willComplete);
    if (willComplete) haptic();
    onSetNumber(routine.id, v);
  };

  return (
    <div
      id={`routine-${routine.id}`}
      className={cn("flex min-h-[64px] scroll-mt-28 items-center gap-3.5 px-4 py-2.5", highlighted && "animate-highlight")}
    >
      {/* 円のタップ：未達なら目標値まで一気に、達成済みなら0に戻す */}
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${routine.title}を${done ? "未完了" : "完了"}にする`}
        onClick={() => {
          setAnimate(!done);
          if (!done) haptic();
          onToggle(routine.id, !done);
        }}
        className="-m-2 p-2"
      >
        <CheckCircle done={done} animate={animate} />
      </button>

      <div className="min-w-0 flex-1">
        <Title routine={routine} done={done} />
        <div className="mt-1.5 flex items-center gap-2">
          <ProgressBar value={progressOf(routine, log)} className="max-w-[92px]" />
          <span className="tabular shrink-0 text-[11px] text-muted">
            目標 {target}
            {routine.unit}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <StepButton label="減らす" disabled={value <= 0} onClick={() => set(value - 1)}>
          <Minus className="size-4" strokeWidth={2.4} />
        </StepButton>
        {editing ? (
          <NumberInput
            initial={value}
            onCommit={(v) => {
              setEditing(false);
              if (v !== null && v !== value) set(v);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`${routine.title}の数値を入力`}
            className="flex h-10 min-w-[52px] items-baseline justify-center rounded-xl px-1.5 active:bg-surface-muted"
          >
            <span
              className={cn(
                "tabular self-center text-[20px] font-bold tracking-tight",
                done && "text-accent",
              )}
            >
              {value}
            </span>
            <span className="ml-0.5 self-center pt-1 text-[11px] font-medium text-muted">{routine.unit}</span>
          </button>
        )}
        <StepButton label="増やす" onClick={() => set(value + 1)}>
          <Plus className="size-4" strokeWidth={2.4} />
        </StepButton>
      </div>
    </div>
  );
}

function StepButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-full bg-surface-muted text-foreground transition-transform active:scale-90 disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function NumberInput({ initial, onCommit }: { initial: number; onCommit: (v: number | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(String(initial));
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const commit = () => {
    const n = Number(text.replace(/[^\d]/g, ""));
    onCommit(text.trim() === "" || Number.isNaN(n) ? null : n);
  };
  return (
    <input
      ref={ref}
      inputMode="numeric"
      pattern="[0-9]*"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onCommit(null);
      }}
      className="tabular h-10 w-[60px] rounded-xl border border-accent bg-surface text-center text-[16px] font-bold outline-none"
    />
  );
}
