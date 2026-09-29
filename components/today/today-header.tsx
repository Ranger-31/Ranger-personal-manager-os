"use client";

import { MoreHorizontal, RotateCcw } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useResetDemo } from "@/hooks/use-today";
import { fromDateKey } from "@/lib/utils";
import { useState } from "react";

function greeting(hour: number) {
  if (hour < 5) return "Good Evening";
  if (hour < 11) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];
const formatDate = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAY_JA[d.getDay()]}曜日`;

export function TodayHeader({ dateKey }: { dateKey: string }) {
  const hour = new Date().getHours();
  return (
    <header className="flex items-start justify-between px-5 pt-[calc(env(safe-area-inset-top)+18px)]">
      <div>
        <p className="text-[13px] font-medium text-muted">{formatDate(fromDateKey(dateKey))}</p>
        <h1 className="mt-0.5 text-[28px] leading-tight font-bold tracking-tight">{greeting(hour)}</h1>
      </div>
      <DemoMenu />
    </header>
  );
}

/** Phase 1 専用：デモデータのリセット */
function DemoMenu() {
  const [open, setOpen] = useState(false);
  const reset = useResetDemo();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="メニュー"
          className="mt-1 flex size-10 items-center justify-center rounded-full text-muted active:bg-surface-muted"
        >
          <MoreHorizontal className="size-5" />
        </button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>プロトタイプ設定</SheetTitle>
          <SheetDescription>Phase 1 はモックデータで動作しています（この端末にのみ保存）。</SheetDescription>
        </SheetHeader>
        <div className="px-6 pt-3 pb-6">
          <Button
            variant="secondary"
            className="w-full"
            disabled={reset.isPending}
            onClick={() => reset.mutate(undefined, { onSuccess: () => setOpen(false) })}
          >
            <RotateCcw className="size-4" />
            デモデータを初期状態に戻す
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
