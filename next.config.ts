import type { NextConfig } from "next";

// サーバーを持たない静的サイトとして書き出す（GitHub Pages などで無料公開できる）。
const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.NEXT_BASE_PATH || "",
};

export default nextConfig;
