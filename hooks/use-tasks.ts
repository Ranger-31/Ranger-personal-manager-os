"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { repo } from "@/lib/repo";
import type { Task, TaskInput } from "@/lib/types";

const KEY = ["tasks"] as const;

export function useTasks() {
  return useQuery({ queryKey: KEY, queryFn: () => repo.listTasks() });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskInput) => repo.createTask(input),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** 楽観的更新（完了/再開のワンタップを即時反映） */
export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<TaskInput> }) => repo.updateTask(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<Task[]>(KEY);
      qc.setQueryData<Task[]>(KEY, (list) =>
        list?.map((t) =>
          t.id === id
            ? {
                ...t,
                ...patch,
                completed_at:
                  patch.status === undefined
                    ? t.completed_at
                    : patch.status === "done"
                      ? (t.completed_at ?? new Date().toISOString())
                      : null,
              }
            : t,
        ),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(KEY, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.deleteTask(id),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
