"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

// Supabase を中継して、自宅PCの Claude Code に写真を読み取ってもらう（GitHub Pages 版の画面で使う）。
// 自宅PC側は local/cloud.mjs。表の定義は supabase/migrations/。
//
// 個人情報の扱い：写真は読み取りが終わるまでの間だけ Supabase に置かれ、PCが読み取り後に写真を消し、
// この画面が結果を受け取ったら行ごと消す。ブラウザに保存するのはログインの情報（Supabase の標準の仕組み）だけで、
// 写真・読み取り結果・アンケートの答えは保存しない。

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Supabase の設定が入った状態でビルドされたか */
export const cloudConfigured = !!(URL && KEY);

let client: SupabaseClient | null = null;
export function cloud(): SupabaseClient | null {
  if (!cloudConfigured) return null;
  client ??= createClient(URL!, KEY!);
  return client;
}

/** ログインの状態と、自宅PCが動いているか（Presence）。PCの状態は確認中なら null */
export function useCloud(enabled: boolean) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [pcOnline, setPcOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const c = enabled ? cloud() : null;
    if (!c) return;
    c.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = c.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [enabled]);

  useEffect(() => {
    const c = enabled && session ? cloud() : null;
    if (!c) return;
    const channel = c.channel("nencho-presence");
    channel
      .on("presence", { event: "sync" }, () => setPcOnline(Object.keys(channel.presenceState()).length > 0))
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setPcOnline(null);
      });
    return () => {
      c.removeChannel(channel);
    };
  }, [enabled, session]);

  return { session, ready, pcOnline };
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const c = cloud();
  if (!c) return "この画面は、外出先から使う設定になっていません。";
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (!error) return null;
  return /invalid/i.test(error.message) ? "メールアドレスかパスワードが違います。" : `ログインできませんでした（${error.message}）`;
}

export async function signOut() {
  await cloud()?.auth.signOut();
}

const WAIT_MS = 5 * 60 * 1000;

/**
 * 写真を Supabase 経由で自宅PCに送り、読み取り結果（Claude Code の回答）を受け取る。
 * 終わったら（失敗しても）行を消す。
 */
export async function cloudRead(images: { type: string; data: string }[], onWait?: (status: string) => void): Promise<string> {
  const c = cloud();
  if (!c) throw new Error("この画面は、外出先から使う設定になっていません。");
  const { data: row, error } = await c.from("read_jobs").insert({ images }).select("id").single();
  if (error || !row) throw new Error(`写真を送れませんでした（${error?.message ?? "不明"}）。`);
  const id = row.id as string;
  try {
    const started = Date.now();
    while (Date.now() - started < WAIT_MS) {
      await new Promise((r) => setTimeout(r, 2000));
      const { data, error: e } = await c.from("read_jobs").select("status,result,error").eq("id", id).single();
      if (e) continue; // 一時的な通信の失敗は、待ち続ける
      onWait?.(data.status);
      if (data.status === "done") return data.result ?? "";
      if (data.status === "error") throw new Error(data.error ?? "読み取りに失敗しました。");
    }
    throw new Error("自宅PCから返事がありません。PCでアプリが起動しているか確認してください。");
  } finally {
    await c.from("read_jobs").delete().eq("id", id);
  }
}
