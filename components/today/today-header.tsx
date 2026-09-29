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
    <header className="flex items-start justify-between px-5 pt-[calc(env(safe-area-inset-top)+14px)]">
      <div>
        <p className="text-[12.5px] font-medium text-muted">{formatDate(fromDateKey(dateKey))}</p>
        <h1 className="mt-0.5 text-[24px] leading-tight font-bold tracking-tight">{greeting(hour)}</h1>
      </div>
      <DemoMenu />
    </header>
  );
}

/** Phase 1 専用：記録のリセット（実機検証中の誤操作を防ぐため2段階確認） */
function DemoMenu() {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const reset = useResetDemo();
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setConfirming(false);
      }}
    >
      <SheetTrigger asChild>
        <button
          aria-label="メニュー"
          className="flex size-10 items-center justify-center rounded-full text-muted active:bg-surface-muted"
        >
          <MoreHorizontal className="size-5" />
        </button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>設定</SheetTitle>
          <SheetDescription>
            Phase 1 は記録をこの端末（このアプリ）にのみ保存しています。
          </SheetDescription>
        </SheetHeader>
        <div className="px-6 pt-3 pb-6">
          {confirming ? (
            <div className="space-y-3">
              <p className="text-[13.5px] leading-relaxed text-foreground">
                これまでのRoutineの記録・Streak・追加したRoutineがすべて消え、初期状態に戻ります。元に戻せません。Tasks（単発タスク）は消えません。
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => setConfirming(false)}>
                  やめる
                </Button>
                <Button
                  className="bg-[#c2410c] hover:bg-[#9a3412]"
                  disabled={reset.isPending}
                  onClick={() =>
                    reset.mutate(undefined, {
                      onSuccess: () => {
                        setConfirming(false);
                        setOpen(false);
                      },
                    })
                  }
                >
                  消去する
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" className="w-full" onClick={() => setConfirming(true)}>
              <RotateCcw className="size-4" />
              記録をリセットして初期状態に戻す
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
