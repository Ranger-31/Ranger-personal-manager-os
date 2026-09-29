"use client";

import { Segmented } from "@/components/ui/segmented";
import type { Scope } from "@/lib/today/grouping";

const OPTIONS: { value: Scope; label: string }[] = [
  { value: "all", label: "ALL" },
  { value: "work", label: "WORK" },
  { value: "personal", label: "PERSONAL" },
];

/** ALL / WORK / PERSONAL 切替（スクロール時は上部に固定） */
export function ScopeFilter({ value, onChange }: { value: Scope; onChange: (s: Scope) => void }) {
  return (
    <div className="sticky top-0 z-30 mt-5 bg-background/92 px-5 pt-[calc(env(safe-area-inset-top)+8px)] pb-3 backdrop-blur-md">
      <Segmented aria-label="表示切替" value={value} onChange={onChange} options={OPTIONS} />
    </div>
  );
}
