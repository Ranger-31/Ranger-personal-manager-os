"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { CriticalTag } from "@/components/shared/critical-tag";
import { useCreateRoutine, useGoalsAndKpis } from "@/hooks/use-today";
import type { Category, Frequency, NewRoutineInput, Routine, RoutineType, TimeOfDay } from "@/lib/types";
import { cn } from "@/lib/utils";

const UNIT_PRESETS = ["回", "件", "人", "社", "分", "杯"];
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** Routine作成（＋ボタンから）。仕様15章 + 必須Routine */
export function RoutineFormSheet({
  open,
  onOpenChange,
  defaultCategory,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultCategory: Category;
  onCreated?: (routine: Routine) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>Routineを追加</SheetTitle>
        </SheetHeader>
        {/* 開くたびに初期化するため key で作り直す */}
        {open && (
          <RoutineForm
            key={defaultCategory}
            defaultCategory={defaultCategory}
            onDone={(r) => {
              onOpenChange(false);
              onCreated?.(r);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function RoutineForm({
  defaultCategory,
  onDone,
}: {
  defaultCategory: Category;
  onDone: (routine: Routine) => void;
}) {
  const create = useCreateRoutine();
  const { data } = useGoalsAndKpis();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>(defaultCategory);
  const [time, setTime] = useState<TimeOfDay>("morning");
  const [type, setType] = useState<RoutineType>("boolean");
  const [target, setTarget] = useState("1");
  const [unit, setUnit] = useState("回");
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [critical, setCritical] = useState(false);
  const [goalId, setGoalId] = useState("");
  const [kpiId, setKpiId] = useState("");

  const targetNum = Math.max(1, Number(target) || 0);
  const valid =
    title.trim().length > 0 &&
    (type === "boolean" || (targetNum >= 1 && unit.trim().length > 0)) &&
    (frequency !== "custom" || days.length > 0);

  const kpis = (data?.kpis ?? []).filter((k) => !goalId || k.goal_id === goalId);

  const submit = () => {
    if (!valid) return;
    const input: NewRoutineInput = {
      title: title.trim(),
      category,
      time_of_day: time,
      type,
      target_number: type === "numeric" ? targetNum : null,
      unit: type === "numeric" ? unit.trim() : null,
      frequency,
      custom_days: frequency === "custom" ? [...days].sort() : null,
      is_critical: critical,
      goal_id: goalId || null,
      kpi_id: kpiId || null,
    };
    create.mutate(input, { onSuccess: (r) => onDone(r) });
  };

  return (
    <>
      <div className="flex-1 space-y-6 overflow-y-auto px-6 pt-3 pb-4">
        <Field label="Routine Name">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：法人1社へ電話"
            enterKeyHint="done"
            className="h-12 w-full rounded-2xl bg-surface-muted px-4 text-[16px] outline-none placeholder:text-subtle focus:ring-2 focus:ring-accent/30"
          />
        </Field>

        <Field label="Category">
          <Segmented
            value={category}
            onChange={setCategory}
            options={[
              { value: "work", label: "Work" },
              { value: "personal", label: "Personal" },
            ]}
          />
        </Field>

        <Field label="Time">
          <Segmented
            size="sm"
            value={time}
            onChange={setTime}
            options={[
              { value: "morning", label: "Morning" },
              { value: "work", label: category === "work" ? "Work" : "Daytime" },
              { value: "evening", label: "Evening" },
              { value: "anytime", label: "Anytime" },
            ]}
          />
        </Field>

        <Field label="Type">
          <Segmented
            value={type}
            onChange={setType}
            options={[
              { value: "boolean", label: "Check" },
              { value: "numeric", label: "Number" },
            ]}
          />
          {type === "numeric" && (
            <div className="mt-3 space-y-3 rounded-2xl bg-surface-muted p-4">
              <div className="flex items-center gap-3">
                <span className="w-12 text-[13px] font-semibold text-muted">目標</span>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={target}
                  onChange={(e) => setTarget(e.target.value.replace(/[^\d]/g, ""))}
                  className="tabular h-11 w-24 rounded-xl bg-surface px-3 text-right text-[18px] font-bold outline-none focus:ring-2 focus:ring-accent/30"
                />
                <input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="単位"
                  className="h-11 w-20 rounded-xl bg-surface px-3 text-[16px] outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {UNIT_PRESETS.map((u) => (
                  <Chip key={u} active={unit === u} onClick={() => setUnit(u)}>
                    {u}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </Field>

        <Field label="Frequency">
          <Segmented
            value={frequency}
            onChange={setFrequency}
            options={[
              { value: "daily", label: "Daily" },
              { value: "weekdays", label: "Weekdays" },
              { value: "custom", label: "Custom" },
            ]}
          />
          {frequency === "custom" && (
            <div className="mt-3 grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((d, i) => {
                const on = days.includes(i);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setDays(on ? days.filter((x) => x !== i) : [...days, i])}
                    className={cn(
                      "h-10 rounded-xl text-[14px] font-semibold transition-colors",
                      on ? "bg-accent text-white" : "bg-surface-muted text-muted",
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          )}
        </Field>

        <label className="flex items-center justify-between gap-4 rounded-2xl border border-border px-4 py-3.5">
          <span>
            <span className="flex items-center gap-2 text-[15px] font-semibold">
              必須Routine <CriticalTag />
            </span>
            <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">
              その日の必須をすべて達成するとStreakが継続します
            </span>
          </span>
          <Switch checked={critical} onCheckedChange={setCritical} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Goal（任意）">
            <Select
              value={goalId}
              onChange={(v) => {
                setGoalId(v);
                setKpiId("");
              }}
            >
              <option value="">なし</option>
              {(data?.goals ?? [])
                .filter((g) => g.category === category)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="KPI（任意）">
            <Select value={kpiId} onChange={setKpiId}>
              <option value="">なし</option>
              {kpis.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.title}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      <div className="border-t border-border px-6 pt-3 pb-4">
        <Button className="w-full" disabled={!valid || create.isPending} onClick={submit}>
          追加する
        </Button>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11.5px] font-bold tracking-[0.1em] text-muted uppercase">{label}</p>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 min-w-10 rounded-full px-3 text-[13px] font-semibold transition-colors",
        active ? "bg-accent text-white" : "bg-surface text-muted",
      )}
    >
      {children}
    </button>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-12 w-full truncate rounded-2xl bg-surface-muted px-3 text-[16px] outline-none focus:ring-2 focus:ring-accent/30"
    >
      {children}
    </select>
  );
}
