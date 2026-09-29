import { BottomNav } from "@/components/layout/bottom-nav";
import { MobileShell } from "@/components/layout/mobile-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileShell>
      <main className="flex-1 pb-[calc(84px+env(safe-area-inset-bottom))]">{children}</main>
      <BottomNav />
    </MobileShell>
  );
}
