// 招待の管理（自宅PCのアプリだけが行う。secret キーを使うため、画面からは直接できない）。
// FX シグナル監視と同じく、メールアドレスを聞いて招待リンクを作り、LINE などで本人に送ってもらう。
// リンクを開いた人は、パスワードを決めて使い始める。すでにアカウントがある人には、パスワードを決め直すリンクを作る。

import { createClient } from "@supabase/supabase-js";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../src/lib/demo.mjs";

export const DEFAULT_APP_URL = "https://dxdimix.github.io/nencho-helper/";

/** 招待リンク（アプリの画面で受け取って、パスワードを決める画面に進む） */
export function buildInviteLink(appUrl, hashedToken, type) {
  const u = new URL(appUrl || DEFAULT_APP_URL);
  u.searchParams.set("token_hash", hashedToken);
  u.searchParams.set("type", type);
  return u.toString();
}

export function normalizeEmail(email) {
  const clean = String(email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error("メールアドレスの形式を確認してください。");
  return clean;
}

export function createAdmin({ url, secretKey, appUrl }) {
  if (!url || !secretKey) return null;
  const sb = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

  async function findUser(email) {
    // 少人数を想定（1ページ200人まで）
    const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw new Error(`アカウントの一覧を取得できません（${error.message}）`);
    return data.users.find((u) => u.email?.toLowerCase() === email) ?? null;
  }

  return {
    /** 招待した人の一覧 */
    async members() {
      const { data, error } = await sb.schema("nencho").from("members").select("user_id,email,invited_at").order("invited_at");
      if (error) throw new Error(`招待した人の一覧を取得できません（${error.message}）。Supabase で SQL を実行したか確認してください。`);
      const { data: auth } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
      const byId = new Map((auth?.users ?? []).map((u) => [u.id, u]));
      return data.map((m) => {
        const u = byId.get(m.user_id);
        return { userId: m.user_id, email: m.email, invitedAt: m.invited_at, lastSignInAt: u?.last_sign_in_at ?? null, passwordSet: !!u?.last_sign_in_at };
      });
    },

    /** 招待リンクを作り、メンバーに加える */
    async invite(email) {
      const clean = normalizeEmail(email);
      const existing = await findUser(clean);
      const type = existing ? "recovery" : "invite";
      const { data, error } = await sb.auth.admin.generateLink({ type, email: clean, options: { redirectTo: appUrl || DEFAULT_APP_URL } });
      if (error) throw new Error(`招待リンクを作れませんでした（${error.message}）`);
      const userId = data.user?.id ?? existing?.id;
      if (!userId) throw new Error("招待した人のアカウントを確認できませんでした。");
      const { error: e2 } = await sb.schema("nencho").from("members").upsert({ user_id: userId, email: clean }, { onConflict: "user_id" });
      if (e2) throw new Error(`招待した人を保存できませんでした（${e2.message}）`);
      return { email: clean, existing: !!existing, link: buildInviteLink(appUrl, data.properties.hashed_token, type) };
    },

    /** デモ用アカウント（ログイン画面で 0000 / 0000）を作る。すでにあればパスワードを元に戻す */
    async createDemo() {
      const existing = await findUser(DEMO_EMAIL);
      let userId = existing?.id;
      if (existing) {
        const { error } = await sb.auth.admin.updateUserById(existing.id, { password: DEMO_PASSWORD, email_confirm: true });
        if (error) throw new Error(`デモ用アカウントを更新できませんでした（${error.message}）`);
      } else {
        const { data, error } = await sb.auth.admin.createUser({ email: DEMO_EMAIL, password: DEMO_PASSWORD, email_confirm: true });
        if (error) throw new Error(`デモ用アカウントを作れませんでした（${error.message}）`);
        userId = data.user.id;
      }
      const { error: e2 } = await sb.schema("nencho").from("members").upsert({ user_id: userId, email: DEMO_EMAIL }, { onConflict: "user_id" });
      if (e2) throw new Error(`デモ用アカウントを保存できませんでした（${e2.message}）`);
      return { email: DEMO_EMAIL, existing: !!existing };
    },

    /** 招待を取り消す（アカウント自体は消さない。以前のシステムで使っている可能性があるため） */
    async remove(userId) {
      const { error } = await sb.schema("nencho").from("members").delete().eq("user_id", userId);
      if (error) throw new Error(`取り消せませんでした（${error.message}）`);
    },
  };
}
