// Supabase を中継して、外出先のスマホ（GitHub Pages 版の画面）から届いた写真を読み取る。
// DIMY と同じく、自宅PCから Supabase に外向きにつなぐだけなので、ルーターの設定は要らない。
//
// 流れ：画面が read_jobs に写真を status = 'pending' で追加 → このプログラムが3秒ごとに確かめて受け取る
// → Claude Code で読み取る → 結果を書き込み、写真は消す（images = null）→ 画面が結果を受け取って行ごと消す。
// 消し忘れに備えて、15分以上前の行は5分ごとに消す。
//
// 個人情報の扱い：写真の中身や読み取り結果はログに出さない。

import { createClient } from "@supabase/supabase-js";

const POLL_MS = 3000;
const CLEANUP_MS = 5 * 60 * 1000;
const KEEP_MS = 15 * 60 * 1000;

/** Supabase とのやりとり（テストでは偽物に差し替える） */
export function supabaseRepo(client) {
  const table = () => client.schema("nencho").from("read_jobs");
  return {
    async nextPending() {
      const { data, error } = await table().select("id").eq("status", "pending").order("created_at").limit(1);
      if (error) throw error;
      return data?.[0]?.id ?? null;
    },
    /** 他の処理と取り合わないよう、pending のときだけ processing に変える。取れたら true */
    async claim(id) {
      const { data, error } = await table().update({ status: "processing" }).eq("id", id).eq("status", "pending").select("id");
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
    async images(id) {
      const { data, error } = await table().select("images").eq("id", id).single();
      if (error) throw error;
      return data?.images ?? [];
    },
    async finish(id, result) {
      const { error } = await table().update({ status: "done", result, images: null }).eq("id", id);
      if (error) throw error;
    },
    async fail(id, message) {
      const { error } = await table().update({ status: "error", error: message, images: null }).eq("id", id);
      if (error) throw error;
    },
    async cleanup(beforeIso) {
      const { error } = await table().delete().lt("created_at", beforeIso);
      if (error) throw error;
    },
  };
}

/**
 * 1件ずつ受け取って読み取る仕事。
 * @param repo supabaseRepo() と同じ形
 * @param reader createReader() の戻り値
 */
export function createWorker(repo, reader) {
  let running = false;
  /** 待っている写真があれば1件処理する。処理したら true */
  async function tick() {
    if (running) return false;
    running = true;
    try {
      const id = await repo.nextPending();
      if (!id || !(await repo.claim(id))) return false;
      try {
        const images = await repo.images(id);
        const text = await reader.read(images);
        await repo.finish(id, text);
      } catch (e) {
        await repo.fail(id, e instanceof Error ? e.message : "読み取りに失敗しました。");
      }
      return true;
    } finally {
      running = false;
    }
  }
  async function cleanup(now = Date.now()) {
    await repo.cleanup(new Date(now - KEEP_MS).toISOString());
  }
  return { tick, cleanup };
}

/**
 * Supabase の設定があれば、見張りを始める。
 * @returns 止める関数（設定がなければ null）
 */
export function startCloud({ url, secretKey, reader, log = console.log }) {
  if (!url || !secretKey) return null;
  const client = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const worker = createWorker(supabaseRepo(client), reader);
  let warned = false;

  const poll = setInterval(async () => {
    try {
      // 待っている写真がある間は、続けて処理する
      while (await worker.tick());
      if (warned) log("Supabase に再びつながりました。");
      warned = false;
    } catch (e) {
      if (!warned) log(`Supabase につながりません（${e?.message ?? e}）。つながるまで確かめ続けます。`);
      warned = true;
    }
  }, POLL_MS);
  const clean = setInterval(() => worker.cleanup().catch(() => {}), CLEANUP_MS);
  worker.cleanup().catch(() => {});

  // 画面に「PC が動いている」ことを知らせる（Realtime の Presence。中身は起動時刻だけ）
  const presence = client.channel("nencho-presence");
  presence.subscribe((status) => {
    if (status === "SUBSCRIBED") presence.track({ online_at: new Date().toISOString() });
  });

  log("外出先から使えるように、Supabase とつながりました（GitHub Pages 版の画面で「写真で登録」が使えます）。");
  return () => {
    clearInterval(poll);
    clearInterval(clean);
    client.removeChannel(presence);
  };
}
