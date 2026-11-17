import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "サクッとねんちょー",
  applicationName: "サクッとねんちょー",
  appleWebApp: { title: "サクッとねんちょー", capable: true },
  description: "撮って、答えて、書き写すだけ。年末調整の申告書のお手本を作ります。",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 antialiased">{children}</body>
    </html>
  );
}
