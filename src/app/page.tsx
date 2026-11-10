"use client";

import { useEffect, useRef, useState } from "react";
import { Guide } from "@/components/Guide";
import { calculate } from "@/lib/calc";
import { READ_PROMPT } from "@/lib/prompt.mjs";
import { mergeResults, parsePasted, type ReadResult } from "@/lib/schema";

// 個人情報の扱い: 写真と読み取り結果は画面の状態（メモリ）にだけ持つ。
// localStorage などには保存しない。写真は自宅PCのサーバー（同じ Wi-Fi 内）にだけ送る。

type Mode = "checking" | "local" | "paste" | "badToken";

// 写真を長辺 2000px の JPEG に縮小して送る（送信と読み取りを速くするため）。
async function shrink(file: File): Promise<{ type: string; data: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((ok, ng) =>
    canvas.toBlob((b) => (b ? ok(b) : ng(new Error("画像を変換できませんでした"))), "image/jpeg", 0.85),
  );
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { type: "image/jpeg", data: btoa(bin) };
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("checking");
  const [token, setToken] = useState("");
  const [data, setData] = useState<ReadResult | null>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  // 23歳未満の扶養親族がいるか（令和8年分の生命保険料控除の特例）。画面の状態にだけ持つ。
  const [under23, setUnder23] = useState(false);
  const [pasted, setPasted] = useState("");
  const [copied, setCopied] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  // 自宅PCのサーバーから開かれたかを確認する。GitHub Pages などでは貼り付け方式になる。
  useEffect(() => {
    const t = new URLSearchParams(location.search).get("t") ?? "";
    setToken(t);
    fetch("api/health", { headers: { "x-local-token": t } })
      .then((r) => setMode(r.ok ? "local" : r.status === 401 ? "badToken" : "paste"))
      .catch(() => setMode("paste"));
  }, []);

  useEffect(() => {
    if (!reading) return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [reading]);

  // 読み取り結果を追加する。成功したら true。
  function addResult(text: string): boolean {
    const res = parsePasted(text);
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    setError("");
    setData((prev) => (prev ? mergeResults(prev, res.data) : res.data));
    return true;
  }

  // 1回に送る枚数（サーバーの MAX_IMAGES と合わせる）
  const BATCH = 6;

  async function sendPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    const all = Array.from(files);
    const batches: File[][] = [];
    for (let i = 0; i < all.length; i += BATCH) batches.push(all.slice(i, i + BATCH));
    setError("");
    setReading(true);
    setProgress({ done: 0, total: all.length });
    let done = 0;
    try {
      for (const batch of batches) {
        const images = await Promise.all(batch.map(shrink));
        const r = await fetch("api/read", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-local-token": token },
          body: JSON.stringify({ images }),
        });
        const body = await r.json();
        if (!r.ok || !addResult(body.text)) {
          if (!r.ok) setError(body.error ?? "読み取りに失敗しました。");
          if (done > 0) setError((e) => `${e}（${done} 枚目までは読み取り済みです。残りの写真を選び直してください）`);
          return;
        }
        done += batch.length;
        setProgress({ done, total: all.length });
      }
    } catch {
      setError("PCにつながりませんでした。PCでアプリが起動しているか、同じ Wi-Fi（または Tailscale）につながっているかを確認してください。");
    } finally {
      setReading(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (libraryRef.current) libraryRef.current.value = "";
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(READ_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("コピーできませんでした。「依頼文の中身を見る」を開き、長押しで選択してコピーしてください。");
    }
  }

  function clearAll() {
    setData(null);
    setError("");
    setPasted("");
  }

  const pasteFlow = (
    <div className="space-y-3 text-sm">
      <ol className="list-decimal space-y-1 pl-5">
        <li>「依頼文をコピー」を押します。</li>
        <li>
          ChatGPT・Claude・Gemini など、写真を読めるAIのチャットを開きます。
          <b>ハガキの写真を添付し、同じメッセージに依頼文を貼り付けて</b>送ります。
        </li>
        <li>AIの回答をコピーし、下の欄に貼り付けて「お手本を表示」を押します。</li>
      </ol>
      <button onClick={copyPrompt} className="rounded bg-blue-600 px-4 py-2 text-white">
        {copied ? "コピーしました" : "依頼文をコピー"}
      </button>
      <details>
        <summary className="cursor-pointer text-gray-600">依頼文の中身を見る</summary>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-gray-100 p-2 text-xs">{READ_PROMPT}</pre>
      </details>
      <textarea
        value={pasted}
        onChange={(e) => setPasted(e.target.value)}
        placeholder="AIの回答をそのまま貼り付けてください"
        className="h-32 w-full rounded border border-gray-400 p-2 font-mono text-xs"
        autoComplete="off"
        spellCheck={false}
      />
      <button
        onClick={() => {
          addResult(pasted);
          setPasted("");
        }}
        disabled={!pasted.trim()}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:bg-gray-400"
      >
        お手本を表示
      </button>
    </div>
  );

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 text-gray-900">
      <h1 className="text-xl font-bold">年末調整 記入お手本</h1>

      {mode === "checking" && <p className="text-sm text-gray-500">準備しています…</p>}

      {mode === "badToken" && (
        <p className="rounded border border-red-400 bg-red-50 p-2 text-sm text-red-800">
          アドレスが正しくありません。PCの画面に表示されているアドレス（または QR コード）から開き直してください。
        </p>
      )}

      {mode === "local" && (
        <section className="space-y-3">
          <p className="text-sm">
            ハガキを1枚ずつ撮影してください。撮影するとすぐに読み取りが始まり、下にお手本が出ます。
            保存済みの写真は、何枚でもまとめて選べます。
          </p>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => sendPhotos(e.target.files)} />
          <input ref={libraryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => sendPhotos(e.target.files)} />
          <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
            <button
              onClick={() => cameraRef.current?.click()}
              disabled={reading}
              className="rounded-lg bg-blue-600 px-4 py-5 text-lg font-bold text-white disabled:bg-gray-400"
            >
              {data ? "次のハガキを撮影" : "ハガキを撮影"}
            </button>
            <button
              onClick={() => libraryRef.current?.click()}
              disabled={reading}
              className="rounded-lg border border-gray-400 bg-white px-4 py-3 disabled:text-gray-400"
            >
              保存済みの写真から選ぶ
            </button>
          </div>
          {reading && (
            <p className="rounded bg-blue-50 p-3 text-sm text-blue-800" role="status">
              PCの Claude Code が読み取っています…（{elapsed} 秒）
              {progress.total > 1 && <>　{progress.done} / {progress.total} 枚完了</>}
              <br />
              1回（最大 {BATCH} 枚）あたり 30 秒〜2 分ほどかかります。
            </p>
          )}
        </section>
      )}

      {mode === "paste" && (
        <section className="space-y-2">
          <p className="rounded bg-yellow-50 p-2 text-xs text-yellow-900">
            撮影してすぐ読み取るには、自宅PCでアプリを起動し、PCの画面に出るアドレスをスマホで開いてください。この画面では、AIのチャットを使う方法で読み取れます。
          </p>
          {pasteFlow}
        </section>
      )}

      {error && <p className="rounded border border-red-400 bg-red-50 p-2 text-sm text-red-800">{error}</p>}

      {data && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">保険料控除申告書の記入お手本</h2>
            <button onClick={clearAll} className="rounded border border-gray-400 px-3 py-1 text-sm">
              すべて消去
            </button>
          </div>
          <label className="flex items-start gap-2 rounded border border-gray-300 bg-white p-3 text-sm">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={under23} onChange={(e) => setUnder23(e.target.checked)} />
            <span>
              23歳未満（平成16年1月2日以後生まれ）の扶養親族がいる
              <span className="block text-xs text-gray-600">
                令和8年分は、該当すると一般の生命保険料（新契約）の控除の上限が4万円から6万円に上がります。子どもなどを扶養しているときはチェックしてください。
              </span>
            </span>
          </label>
          <Guide data={data} calc={calculate(data, { under23 })} />
        </section>
      )}

      {mode === "local" && (
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-600">うまく読み取れないとき：AIのチャットを使う方法</summary>
          <div className="mt-2">{pasteFlow}</div>
        </details>
      )}
    </main>
  );
}
