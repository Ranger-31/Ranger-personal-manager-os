import type { Category, Routine, TimeOfDay } from "@/lib/types";

/**
 * Today のセクション分け
 *
 * 採用仕様：
 *   ALL      … 仕事を時間帯別に表示し、Personal は下部にまとめる
 *   WORK     … 仕事のみ時間帯別
 *   PERSONAL … Personal のみ時間帯別
 *
 * 将来 ALL を「完全な時系列表示」（仕事/Personalを混ぜて時間帯順）に切り替えられるよう、
 * 表示方式を Strategy として分離している。ALL_VIEW_MODE を変えるだけで切替可能。
 */

export type Scope = "all" | "work" | "personal";
export type AllViewMode = "work-first" | "chronological";

export const ALL_VIEW_MODE: AllViewMode = "work-first";

/**
 * Today での表示順。Anytime は「いつでもできる」ので Evening より前に置き、
 * 夜にやる項目が最後に来るようにしている。
 */
export const TIME_ORDER: TimeOfDay[] = ["morning", "work", "anytime", "evening"];

export type RoutineSection = {
  key: string;
  label: string;
  routines: Routine[];
};

const timeLabel = (t: TimeOfDay, context: "work" | "personal" | "mixed") => {
  if (t === "work") return context === "work" ? "WORK" : "DAYTIME";
  return { morning: "MORNING", evening: "EVENING", anytime: "ANYTIME" }[t];
};

const sortRoutines = (a: Routine, b: Routine) =>
  TIME_ORDER.indexOf(a.time_of_day) - TIME_ORDER.indexOf(b.time_of_day) ||
  a.sort_order - b.sort_order ||
  a.created_at.localeCompare(b.created_at);

function byTime(
  routines: Routine[],
  context: "work" | "personal" | "mixed",
  keyPrefix: string,
): RoutineSection[] {
  return TIME_ORDER.map((t) => ({
    key: `${keyPrefix}-${t}`,
    label: timeLabel(t, context),
    routines: routines.filter((r) => r.time_of_day === t).sort(sortRoutines),
  })).filter((s) => s.routines.length > 0);
}

const only = (routines: Routine[], c: Category) => routines.filter((r) => r.category === c);

export function buildSections(
  routines: Routine[],
  scope: Scope,
  allMode: AllViewMode = ALL_VIEW_MODE,
): RoutineSection[] {
  switch (scope) {
    case "work":
      return byTime(only(routines, "work"), "work", "work");
    case "personal":
      return byTime(only(routines, "personal"), "personal", "personal");
    case "all": {
      if (allMode === "chronological") {
        return byTime([...routines], "mixed", "all");
      }
      const personal = only(routines, "personal").sort(sortRoutines);
      return [
        ...byTime(only(routines, "work"), "work", "work"),
        ...(personal.length ? [{ key: "personal", label: "PERSONAL", routines: personal }] : []),
      ];
    }
  }
}
