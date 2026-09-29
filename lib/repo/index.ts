import { mockRepository } from "@/lib/repo/mock-repository";
import type { Repository } from "@/lib/repo/types";

/**
 * データアクセスの唯一の入口。
 * Phase 2 でここを supabaseRepository に差し替える（UI側の変更は不要）。
 */
export const repo: Repository = mockRepository;

export type { Repository };
