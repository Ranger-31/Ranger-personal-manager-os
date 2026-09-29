"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CircleCheck, ListTodo, Sparkles, Target } from "lucide-react";
import { cn } from "@/lib/utils";

// 順番：Today → Tasks → Goals → Analytics → AI（Tasksは単発業務。Todayの隣に配置）
const NAV_ITEMS = [
  { href: "/today", label: "Today", icon: CircleCheck },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/ai", label: "AI", icon: Sparkles },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="メインナビゲーション"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[430px] border-t border-border bg-background/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:border-x"
    >
      <ul className="grid h-[64px] grid-cols-5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[10.5px] font-medium tracking-wide transition-colors",
                  active ? "text-accent" : "text-subtle",
                )}
              >
                <Icon className="size-[22px]" strokeWidth={active ? 2.3 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
