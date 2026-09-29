import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Manager",
  description: "Goal → KPI → Action → Routine をつなぐ個人用マネジメントOS",
  applicationName: "Personal Manager",
  appleWebApp: {
    capable: true,
    title: "Manager",
    statusBarStyle: "default",
    startupImage: [
      // iPhone 12/13/14 (390×844)
      {
        url: "/splash/splash-1170x2532.png",
        media:
          "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
      },
      // iPhone 14 Pro / 15 / 16 (393×852)
      {
        url: "/splash/splash-1179x2556.png",
        media:
          "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)",
      },
      // iPhone Pro Max / Plus (430×932)
      {
        url: "/splash/splash-1290x2796.png",
        media:
          "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)",
      },
      // iPhone X / 11 Pro / 12 mini (375×812)
      {
        url: "/splash/splash-1125x2436.png",
        media:
          "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)",
      },
    ],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
