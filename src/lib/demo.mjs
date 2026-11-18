// デモ用アカウント。ログイン画面で「0000」「0000」と入れると、このアカウントでログインする。
// Supabase はメールアドレスの形とパスワード6文字以上が必要なため、画面で入れた「0000」を実際の値に置き換える。
// アカウントは自宅PCの管理画面（招待の管理）の「デモ用アカウントを作る」で作る（local/admin.mjs）。
// 画面からも自宅PCからも読み込むため .mjs にしている。

export const DEMO_ID = "0000";
export const DEMO_EMAIL = "demo0000@example.com";
export const DEMO_PASSWORD = "nencho-demo-0000";

/** ログイン画面で入れた値を、Supabase に送る値に置き換える（デモ以外はそのまま） */
export function demoLogin(email, password) {
  const e = String(email ?? "").trim();
  if (e === DEMO_ID && password === DEMO_ID) return { email: DEMO_EMAIL, password: DEMO_PASSWORD };
  if (e === DEMO_ID) return { email: DEMO_EMAIL, password };
  return { email: e, password };
}
