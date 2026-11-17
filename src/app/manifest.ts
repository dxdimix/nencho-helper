import type { MetadataRoute } from "next";

// ホーム画面に追加したときの名前など。
// start_url は書かない：書くと、ホーム画面のアイコンから自宅PCの合言葉（?t=…）が抜けて開けなくなるため。
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "サクッとねんちょー",
    short_name: "サクッとねんちょー",
    description: "撮って、答えて、書き写すだけ。年末調整の申告書のお手本を作ります。",
    display: "standalone",
    background_color: "#f9fafb",
    theme_color: "#2563eb",
  };
}
