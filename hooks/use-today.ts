"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { repo } from "@/lib/repo";
import type { LogMap } from "@/lib/calc/routine";
import type { NewRoutineInput, RoutineLog } from "@/lib/types";
import { addDays, toDateKey } from "@/lib/utils";

export const qk = {
  routines: ["routines"] as const,
  logs: (date: string) => ["logs", date] as const,
  history: (today: string) => ["logs-history", today] as const,
  focus: (date: string) => ["focus", date] as const,
};

const STREAK_LOOKBACK_DAYS = 366;

/** クライアントでのみ確定する「今日」。日付を跨いだら自動で切り替わる */
export function useTodayKey(): string | null {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [key, setKey] = useState(() => toDateKey(new Date()));

  useEffect(() => {
    const refresh = () => setKey(toDateKey(new Date()));
    const id = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return mounted ? key : null;
}

export function useRoutines() {
  return useQuery({ queryKey: qk.routines, queryFn: () => repo.listRoutines() });
}

export function useGoalsAndKpis() {
  return useQuery({
    queryKey: ["goals-kpis"],
    queryFn: async () => ({ goals: await repo.listGoals(), kpis: await repo.listKpis() }),
  });
}

export function useLogs(date: string | null) {
  return useQuery({
    queryKey: qk.logs(date ?? ""),
    queryFn: () => repo.getLogsByDate(date!),
    enabled: !!date,
  });
}

/** Streak計算用の過去ログ（昨日まで） */
export function useHistory(today: string | null) {
  return useQuery({
    queryKey: qk.history(today ?? ""),
    queryFn: () =>
      repo.getLogsInRange(addDays(today!, -STREAK_LOOKBACK_DAYS), addDays(today!, -1)),
    enabled: !!today,
  });
}

export function useFocus(date: string | null) {
  return useQuery({
    queryKey: qk.focus(date ?? ""),
    queryFn: () => repo.getFocus(date!),
    enabled: !!date,
  });
}

type Patch = Partial<Pick<RoutineLog, "is_completed" | "numeric_value">>;

/** 1タップ記録。楽観的更新で即時反映する */
export function useUpsertLog(date: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ routineId, patch }: { routineId: string; patch: Patch }) =>
      repo.upsertLog(routineId, date!, patch),
    onMutate: async ({ routineId, patch }) => {
      const key = qk.logs(date!);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<LogMap>(key);
      const routines = qc.getQueryData<Awaited<ReturnType<typeof repo.listRoutines>>>(qk.routines);
      const routine = routines?.find((r) => r.id === routineId);
      const base: RoutineLog = prev?.[routineId] ?? {
        id: "optimistic",
        routine_id: routineId,
        user_id: "",
        log_date: date!,
        is_completed: false,
        numeric_value: null,
        note: null,
        created_at: "",
        updated_at: "",
      };
      const next = { ...base, ...patch };
      if (routine?.type === "numeric") {
        next.is_completed = (next.numeric_value ?? 0) >= (routine.target_number ?? 1);
      }
      qc.setQueryData<LogMap>(key, { ...prev, [routineId]: next });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.logs(date!), ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.logs(date!) }),
  });
}

export function useCreateRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewRoutineInput) => repo.createRoutine(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.routines }),
  });
}

export function useResetDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => repo.resetDemo?.(),
    onSuccess: () => qc.invalidateQueries(),
  });
}
