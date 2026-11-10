import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "年末調整 記入お手本",
  description: "控除証明書の読み取り結果から、保険料控除申告書の記入例を表示します",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 antialiased">{children}</body>
    </html>
  );
}
