/** 必須Routineのタグ（Streakと同じ色で「Streakに効く」ことを示す） */
export function CriticalTag() {
  return (
    <span className="inline-flex h-[18px] shrink-0 items-center rounded-full bg-streak-soft px-1.5 text-[10px] font-bold tracking-wide text-streak">
      必須
    </span>
  );
}
