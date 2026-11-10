"use client";

import { useState } from "react";
import { Guide } from "@/components/Guide";
import { calculate } from "@/lib/calc";
import { READ_PROMPT } from "@/lib/prompt";
import { parsePasted, type ReadResult } from "@/lib/schema";

// 個人情報の扱い: 貼り付けた内容は画面の状態（メモリ）にだけ持つ。
// localStorage などには保存せず、外部にも送信しない。画面を閉じると消える。
export default function Home() {
  const [pasted, setPasted] = useState("");
  const [data, setData] = useState<ReadResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(READ_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("コピーできませんでした。下の依頼文を長押しして選択し、コピーしてください。");
    }
  }

  function load() {
    const res = parsePasted(pasted);
    if (res.ok) {
      setData(res.data);
      setError("");
    } else {
      setData(null);
      setError(res.error);
    }
  }

  function clearAll() {
    setPasted("");
    setData(null);
    setError("");
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 text-gray-900">
      <h1 className="text-xl font-bold">年末調整 記入お手本</h1>

      <section className="space-y-2">
        <h2 className="font-bold">1. 依頼文をコピーする</h2>
        <p className="text-sm">
          Claude のチャットに、ハガキの写真と一緒にこの依頼文を送ってください。読み取りが終わったら、チャットは削除してかまいません。
        </p>
        <button onClick={copyPrompt} className="rounded bg-blue-600 px-4 py-2 text-white">
          {copied ? "コピーしました" : "依頼文をコピー"}
        </button>
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-600">依頼文の中身を見る</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-gray-100 p-2 text-xs">{READ_PROMPT}</pre>
        </details>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">2. チャットの回答を貼り付ける</h2>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="チャットの回答をそのまま貼り付けてください"
          className="h-40 w-full rounded border border-gray-400 p-2 font-mono text-xs"
          autoComplete="off"
          spellCheck={false}
        />
        <div className="flex gap-2">
          <button onClick={load} disabled={!pasted.trim()} className="rounded bg-blue-600 px-4 py-2 text-white disabled:bg-gray-400">
            お手本を表示
          </button>
          <button onClick={clearAll} className="rounded border border-gray-400 px-4 py-2">
            すべて消去
          </button>
        </div>
        {error && <p className="rounded border border-red-400 bg-red-50 p-2 text-sm text-red-800">{error}</p>}
      </section>

      {data && (
        <section className="space-y-2">
          <h2 className="font-bold">3. 保険料控除申告書の記入お手本</h2>
          <Guide data={data} calc={calculate(data)} />
        </section>
      )}
    </main>
  );
}
