"use client";

import { fromDateKey } from "@/lib/utils";
import { SettingsMenu } from "./settings-menu";

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
      <SettingsMenu />
    </header>
  );
}
