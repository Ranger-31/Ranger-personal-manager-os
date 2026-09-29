/**
 * MobileShell
 * - スマホ：画面いっぱい（390×844基準）
 * - PC：スマホ幅のまま中央配置（単純に引き伸ばさない）
 *   将来 Dashboard Layout に切り替える場合はこのコンポーネントを差し替える
 */
export function MobileShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background md:bg-surface-muted">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background md:border-x md:border-border">
        {children}
      </div>
    </div>
  );
}
