"use client";

import { useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { Family } from "@/components/Illustrations";
import { InfoTip } from "@/components/InfoTip";
import { cloud } from "@/lib/cloud";

// 招待制のための画面。
// - 招待リンク（?token_hash=…&type=invite|recovery）を開いた人を確認し、パスワードを決めてもらう。
// - 自宅PCで開いたときだけ、招待の管理（招待リンクを作る・取り消す）ができる。

/** 招待リンクで開かれたかを確かめる。null: 招待リンクではない / "checking" / "ok" / エラー文 */
export function useInviteLanding() {
  const [state, setState] = useState<null | "checking" | "ok" | string>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    const tokenHash = url.searchParams.get("token_hash");
    const type = url.searchParams.get("type") as EmailOtpType | null;
    if (!tokenHash || !type) return;
    // アドレスからリンクの情報を消しておく（ホーム画面に追加したときに残らないように）
    url.searchParams.delete("token_hash");
    url.searchParams.delete("type");
    window.history.replaceState(null, "", url.toString());
    const c = cloud();
    if (!c) return setState("この画面は、招待の受け取りに対応していません。");
    setState("checking");
    c.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error }) => setState(error ? "リンクの有効期限が切れたか、すでに使われています。招待した人に、新しいリンクを作ってもらってください。" : "ok"));
  }, []);
  return [state, () => setState(null)] as const;
}

/** パスワードを決める画面（招待リンクから来た人） */
export function SetPassword({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    cloud()?.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);
  return (
    <form
      className="space-y-3 rounded-2xl bg-white p-5 shadow-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        if (pw.length < 8) return setError("パスワードは8文字以上にしてください。");
        if (pw !== pw2) return setError("確認のために入れたパスワードが一致しません。");
        setBusy(true);
        const r = await cloud()?.auth.updateUser({ password: pw });
        setBusy(false);
        if (r?.error) return setError(`パスワードを設定できませんでした（${r.error.message}）`);
        onDone();
      }}
    >
      <Family className="mx-auto h-16 w-16" />
      <h2 className="text-center text-xl font-bold">ようこそ！パスワードを決めてください</h2>
      <p className="text-center text-sm text-gray-600">次からは、このメールアドレスとパスワードでログインします。</p>
      {email && (
        <p className="rounded-xl bg-gray-50 p-2 text-center text-sm">
          ログインID：<b>{email}</b>
        </p>
      )}
      <input type="password" autoComplete="new-password" placeholder="新しいパスワード（8文字以上）" className="w-full rounded-xl border-2 border-gray-300 p-3" value={pw} onChange={(e) => setPw(e.target.value)} />
      <input type="password" autoComplete="new-password" placeholder="確認のためもう一度" className="w-full rounded-xl border-2 border-gray-300 p-3" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button disabled={busy || !pw || !pw2} className="w-full rounded-full bg-blue-600 px-4 py-4 text-lg font-bold text-white disabled:bg-gray-300">
        パスワードを決めて始める
      </button>
    </form>
  );
}

type Member = { userId: string; email: string; invitedAt: string; lastSignInAt: string | null; passwordSet: boolean };

/** 招待の管理（自宅PCで開いたときだけ） */
export function AdminPanel({ token, onClose }: { token: string; onClose: () => void }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{ email: string; link: string; existing: boolean } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const call = async (path: string, body?: unknown) => {
    const r = await fetch(`api/admin/${path}`, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", "x-local-token": token },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "処理できませんでした。");
    return j;
  };
  const load = () =>
    call("members")
      .then((j) => setMembers(j.members))
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const message = result
    ? `サクッとねんちょー（年末調整のお手本アプリ）への招待です。\nこのリンクを開いて、パスワードを決めてください。\n${result.link}`
    : "";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm">
          ← もどる
        </button>
        <span className="font-bold">招待の管理</span>
      </div>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-bold">
          新しく招待する
          <InfoTip>招待した人は、外出先の画面（GitHub Pages 版）にログインして「写真で登録」を使えます。読み取りは、このPCの Claude Code で行います。</InfoTip>
        </h2>
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setResult(null);
            setBusy(true);
            try {
              setResult(await call("invite", { email }));
              setEmail("");
              load();
            } catch (err) {
              setError((err as Error).message);
            }
            setBusy(false);
          }}
        >
          <input type="email" placeholder="招待する人のメールアドレス" className="w-full rounded-xl border-2 border-gray-300 p-3" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button disabled={busy || !email} className="w-full rounded-full bg-blue-600 px-4 py-3 font-bold text-white disabled:bg-gray-300">
            招待リンクを作る
          </button>
        </form>
        {error && <p className="text-sm text-red-700">{error}</p>}
        {result && (
          <div className="space-y-2 rounded-xl border-2 border-green-400 bg-green-50 p-3 text-sm">
            <p>
              <b>{result.email}</b> の{result.existing ? "パスワードを決め直すリンク" : "招待リンク"}を作りました。LINE などで本人に送ってください。
              {result.existing && "（すでにアカウントがある人なので、パスワードを決め直してもらいます）"}
            </p>
            <p className="break-all rounded bg-white p-2 font-mono text-xs">{result.link}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(message);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    setError("コピーできませんでした。上のリンクを長押ししてコピーしてください。");
                  }
                }}
                className="rounded-full border border-blue-600 bg-white px-3 py-2 text-blue-700"
              >
                {copied ? "コピーしました" : "案内文ごとコピー"}
              </button>
              <a href={`https://line.me/R/share?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="rounded-full bg-green-600 px-3 py-2 text-center font-bold text-white">
                LINEで送る
              </a>
            </div>
            <p className="text-xs text-gray-600">リンクは一度だけ使えます。期限が切れたり、うまく開けなかったりしたら、もう一度「招待リンクを作る」を押してください。</p>
          </div>
        )}
      </section>

      <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-bold">招待した人</h2>
        {members === null ? (
          <p className="text-sm text-gray-500">読み込んでいます…</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-gray-600">まだいません。まずは自分のメールアドレスを招待してください。</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {members.map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {m.email}
                  <span className="block text-xs text-gray-500">{m.lastSignInAt ? `最後のログイン：${new Date(m.lastSignInAt).toLocaleDateString("ja-JP")}` : "まだログインしていません"}</span>
                </span>
                <button
                  onClick={async () => {
                    if (!window.confirm(`${m.email} の招待を取り消しますか？（写真で登録が使えなくなります）`)) return;
                    try {
                      await call("remove", { userId: m.userId });
                      load();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                  className="shrink-0 text-xs text-red-600 underline"
                >
                  取り消す
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
