import type { LucideIcon } from "lucide-react";

/** Today承認前は作り込まないタブのプレースホルダー */
export function ComingSoon({ title, icon: Icon }: { title: string; icon: LucideIcon }) {
  return (
    <div className="px-5 pt-[calc(env(safe-area-inset-top)+18px)]">
      <h1 className="text-[28px] font-bold tracking-tight">{title}</h1>
      <div className="mt-6 flex flex-col items-center rounded-card border border-dashed border-border px-6 py-14 text-center">
        <Icon className="size-8 text-subtle" strokeWidth={1.6} />
        <p className="mt-3 text-[15px] font-semibold">Today承認後に実装します</p>
        <p className="mt-1 text-[13px] text-muted">Phase 1 は Today の UI/UX を先に固めています。</p>
      </div>
    </div>
  );
}
