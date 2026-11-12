"use client";

import { useEffect, useRef, useState } from "react";
import { FamilyForm } from "@/components/FamilyForm";
import { BasicGuide, DependentsGuide } from "@/components/FamilyGuides";
import { BasicFormImage, FormImage } from "@/components/FormImage";
import { Glossary } from "@/components/Glossary";
import { Guide } from "@/components/Guide";
import { HousingGuide } from "@/components/HousingGuide";
import { ReviewStep, type Timing } from "@/components/ReviewStep";
import { emptySelf, hasUnder23Dependent, under23DependentFor, type Family } from "@/lib/family";
import { calculate } from "@/lib/calc";
import { READ_PROMPT } from "@/lib/prompt.mjs";
import { mergeResults, parsePasted, type ReadResult } from "@/lib/schema";

// 個人情報の扱い: 写真と読み取り結果は画面の状態（メモリ）にだけ持つ。
// localStorage などには保存しない。写真は自宅PCのサーバー（同じ Wi-Fi 内）にだけ送る。

type Mode = "checking" | "local" | "paste" | "badToken";
type Tab = "hoken" | "housing" | "family" | "basic" | "fuyou";

const TABS: { id: Tab; label: string }[] = [
  { id: "hoken", label: "書類・保険" },
  { id: "housing", label: "住宅ローン" },
  { id: "family", label: "家族と収入" },
  { id: "basic", label: "基礎控除" },
  { id: "fuyou", label: "扶養控除" },
];

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
  const [tab, setTab] = useState<Tab>("hoken");
  const [view, setView] = useState<"image" | "table">("image");
  const [version, setVersion] = useState("");
  const [selfTest, setSelfTest] = useState<{ state: "idle" | "running" | "ok" | "ng"; message: string }>({ state: "idle", message: "" });
  // 家族と収入の入力。画面の状態にだけ持つ（保存しない）。
  const [family, setFamily] = useState<Family>({ self: emptySelf(), spouse: null, dependents: [] });
  // お手本の前の確認ステップを終えたか。新しく読み取ったら、もう一度確認する。
  const [reviewed, setReviewed] = useState(false);
  // 勤務先の年末調整の時期。11月30日以前なら、23歳未満の扶養親族の所得の基準を58万円に読み替える。
  const [timing, setTiming] = useState<Timing | null>(null);
  const under23IncomeLimit = timing === "11月以前" ? 580_000 : 620_000;
  // 家族の生年月日が入力されていれば、23歳未満の扶養親族の有無を自動で判定する
  // （生年月日が空欄の家族がいると判定できないので、そのときはチェックを手で付けてもらう）
  const allBirths = family.dependents.length > 0 && family.dependents.every((d) => d.birth);
  const autoUnder23 = allBirths ? hasUnder23Dependent(family, 2026, under23IncomeLimit) : null;
  const missingBirth = family.dependents.some((d) => !d.birth);
  const effectiveUnder23 = autoUnder23 ?? under23;
  const [pasted, setPasted] = useState("");
  const [copied, setCopied] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  // 自宅PCのサーバーから開かれたかを確認する。GitHub Pages などでは貼り付け方式になる。
  useEffect(() => {
    const t = new URLSearchParams(location.search).get("t") ?? "";
    setToken(t);
    fetch("api/health", { headers: { "x-local-token": t } })
      .then(async (r) => {
        setMode(r.ok ? "local" : r.status === 401 ? "badToken" : "paste");
        if (r.ok) setVersion(((await r.json()) as { version?: string }).version ?? "");
      })
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
    setReviewed(false);
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

  // 見本のハガキ（架空の内容）を読み取らせて、PC側の読み取りが正しく動くかを確かめる。
  // 結果はお手本には加えない。
  async function runSelfTest() {
    setSelfTest({ state: "running", message: "見本のハガキを読み取っています…（30秒〜1分）" });
    try {
      const blob = await (await fetch("samples/sample-hagaki.jpg")).blob();
      const image = await shrink(new File([blob], "sample.jpg", { type: "image/jpeg" }));
      const r = await fetch("api/read", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-local-token": token },
        body: JSON.stringify({ images: [image] }),
      });
      const body = await r.json();
      if (!r.ok) return setSelfTest({ state: "ng", message: body.error ?? "読み取りに失敗しました。" });
      const res = parsePasted(body.text);
      if (!res.ok) return setSelfTest({ state: "ng", message: res.error });
      const item = res.data.life[0];
      const ok = res.data.life.length === 1 && item.category === "介護医療" && item.system === "新" && item.amount === 36000;
      setSelfTest(
        ok
          ? { state: "ok", message: "正しく読み取れました（介護医療・新制度・36,000円）。PC側の準備はできています。" }
          : { state: "ng", message: `読み取りはできましたが、内容が想定と違いました（${item ? `${item.category}・${item.system}・${item.amount}円` : "項目なし"}）。依頼文の調整が必要かもしれません。` },
      );
    } catch {
      setSelfTest({ state: "ng", message: "PCにつながりませんでした。" });
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
    setReviewed(false);
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
        <li>AIの回答をコピーし、下の欄に貼り付けて「読み込む」を押します。書類が複数あるときは、1枚ずつ繰り返してもかまいません。</li>
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
        読み込む
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

      <nav className="sticky top-0 z-10 -mx-4 grid grid-cols-5 border-b border-gray-300 bg-gray-50 px-1 text-xs sm:text-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-1 py-2 ${tab === t.id ? "border-b-2 border-blue-600 font-bold text-blue-700" : "text-gray-600"}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "housing" && <HousingGuide items={data?.housing ?? []} />}
      {tab === "family" && <FamilyForm value={family} onChange={setFamily} />}
      {tab === "basic" && (
        <>
          {family.self.salary === 0 && <p className="rounded bg-yellow-50 p-2 text-sm">先に「家族と収入」タブで、あなたの給与の収入などを入力してください。</p>}
          {timing === "11月以前" && (
            <p className="rounded bg-yellow-50 p-2 text-sm">
              勤務先が11月中に年末調整をする場合、基礎控除などの計算の基準がこのお手本（12月の年末調整用）と違うことがあります。勤務先から配られた申告書と案内に従ってください。
            </p>
          )}
          <div className="grid grid-cols-2 overflow-hidden rounded border border-gray-400 text-sm">
            {(["image", "table"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`py-2 ${view === v ? "bg-blue-600 text-white" : "bg-white"}`}>
                {v === "image" ? "申告書の画像で見る" : "表で見る"}
              </button>
            ))}
          </div>
          {view === "image" ? <BasicFormImage family={family} /> : <BasicGuide family={family} />}
        </>
      )}
      {tab === "fuyou" && (
        <>
          {family.self.salary === 0 && family.dependents.length === 0 && (
            <p className="rounded bg-yellow-50 p-2 text-sm">先に「家族と収入」タブで、配偶者や家族を入力してください。</p>
          )}
          <DependentsGuide family={family} />
        </>
      )}

      {tab === "hoken" && mode === "local" && (
        <section className="space-y-3">
          <ol className="list-decimal space-y-1 rounded bg-white p-3 pl-8 text-sm">
            <li>手元にある書類（保険会社のハガキ、住宅ローンの書類など）を、1枚ずつ撮影します。</li>
            <li>全部撮り終えたら、画面の確認事項に答えます（撮り忘れがないかも確認します）。</li>
            <li>お手本が出たら、それを見ながら申告書に手書きします。</li>
          </ol>
          <p className="text-xs text-gray-600">どの書類か分からなくても大丈夫です。年末調整に使わない書類なら、その旨を案内します。保存済みの写真は、何枚でもまとめて選べます。</p>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => sendPhotos(e.target.files)} />
          <input ref={libraryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => sendPhotos(e.target.files)} />
          <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
            <button
              onClick={() => cameraRef.current?.click()}
              disabled={reading}
              className="rounded-lg bg-blue-600 px-4 py-5 text-lg font-bold text-white disabled:bg-gray-400"
            >
              {data ? "次の書類を撮影" : "書類を撮影"}
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

      {tab === "hoken" && mode === "paste" && (
        <section className="space-y-2">
          <p className="rounded bg-yellow-50 p-2 text-xs text-yellow-900">
            撮影してすぐ読み取るには、自宅PCでアプリを起動し、PCの画面に出るアドレスをスマホで開いてください。この画面では、AIのチャットを使う方法で読み取れます。
          </p>
          {pasteFlow}
        </section>
      )}

      {error && <p className="rounded border border-red-400 bg-red-50 p-2 text-sm text-red-800">{error}</p>}

      {tab === "hoken" && data && !reviewed && (
        <ReviewStep
          data={data}
          onChange={setData}
          timing={timing}
          onTiming={setTiming}
          onTakePhoto={() => (mode === "local" ? cameraRef.current?.click() : window.scrollTo({ top: 0, behavior: "smooth" }))}
          onDone={() => {
            setReviewed(true);
            window.scrollTo({ top: 0 });
          }}
        />
      )}

      {tab === "hoken" && data && reviewed && (
        <section className="space-y-2">
          <button onClick={() => setReviewed(false)} className="text-sm text-blue-700 underline">
            ← 確認事項に戻る
          </button>
          {data.housing.length > 0 && (
            <p className="rounded bg-blue-50 p-2 text-sm">
              住宅ローンの書類も読み取りました。住宅ローン控除のお手本は「住宅ローン」タブにあります。
            </p>
          )}
          {data.life.length + data.earthquake.length + data.social.length + data.smallBiz.length === 0 && (
            <p className="rounded bg-yellow-50 p-2 text-sm">保険料控除申告書に書く書類はありませんでした。保険料控除申告書は、何も書かずに出すか、出さなくてよいか勤務先に確認してください。</p>
          )}
          <div className="flex items-center justify-between">
            <h2 className="font-bold">保険料控除申告書の記入お手本</h2>
            <button onClick={clearAll} className="rounded border border-gray-400 px-3 py-1 text-sm">
              すべて消去
            </button>
          </div>
          <label className="flex items-start gap-2 rounded border border-gray-300 bg-white p-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5"
              checked={effectiveUnder23}
              disabled={autoUnder23 !== null}
              onChange={(e) => setUnder23(e.target.checked)}
            />
            <span>
              23歳未満（平成16年1月2日以後生まれ）の扶養親族がいる
              <span className="block text-xs text-gray-600">
                {autoUnder23 !== null
                  ? `「家族と収入」タブの入力から自動で判定しています（所得${timing === "11月以前" ? "58" : "62"}万円以下の家族が対象）。`
                  : `${missingBirth ? "「家族と収入」タブで生年月日が空欄の家族がいるため、自動では判定できません。" : ""}令和8年分は、該当すると一般の生命保険料（新契約）の控除の上限が4万円から6万円に上がります。子どもなどを扶養しているときはチェックしてください。`}
              </span>
            </span>
          </label>
          {effectiveUnder23 && data.life.some((i) => i.category === "一般" && i.system === "新") && (
            <Under23Box family={family} incomeLimit={under23IncomeLimit} />
          )}
          <div className="grid grid-cols-2 overflow-hidden rounded border border-gray-400 text-sm">
            {(["image", "table"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`py-2 ${view === v ? "bg-blue-600 text-white" : "bg-white"}`}>
                {v === "image" ? "申告書の画像で見る" : "表で見る"}
              </button>
            ))}
          </div>
          {view === "image" ? (
            <FormImage data={data} calc={calculate(data, { under23: effectiveUnder23 })} under23={effectiveUnder23} />
          ) : (
            <Guide data={data} calc={calculate(data, { under23: effectiveUnder23 })} />
          )}
        </section>
      )}

      {tab === "hoken" && mode === "local" && (
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-600">動作チェック（見本のハガキで試す）</summary>
          <div className="mt-2 space-y-2">
            <p>架空の内容の見本ハガキを、PCの Claude Code で読み取れるかを確かめます。結果はお手本には加えません。</p>
            <button onClick={runSelfTest} disabled={selfTest.state === "running" || reading} className="rounded border border-blue-600 px-3 py-1 text-blue-700 disabled:text-gray-400">
              動作チェックを実行
            </button>
            {selfTest.message && (
              <p className={`rounded p-2 ${selfTest.state === "ok" ? "bg-green-50 text-green-800" : selfTest.state === "ng" ? "bg-red-50 text-red-800" : "bg-blue-50 text-blue-800"}`}>
                {selfTest.message}
              </p>
            )}
          </div>
        </details>
      )}

      {tab === "hoken" && mode === "local" && (
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-600">うまく読み取れないとき：AIのチャットを使う方法</summary>
          <div className="mt-2">{pasteFlow}</div>
        </details>
      )}
      <Glossary />

      <footer className="pt-4 text-center text-[10px] text-gray-400">
        {mode === "local" ? `自宅PCモード${version ? `・版 ${version}` : ""}` : mode === "paste" ? "チャット貼り付けモード" : ""}
      </footer>
    </main>
  );
}

// 23歳未満の特例を使うときに、申告書の「☆年齢23歳未満の扶養親族」欄に書く内容
function Under23Box({ family, incomeLimit }: { family: Family; incomeLimit: number }) {
  const who = under23DependentFor(family, 2026, incomeLimit);
  return (
    <div className="rounded border-2 border-blue-400 bg-blue-50 p-3 text-sm">
      <p className="font-bold">申告書の左下「☆年齢23歳未満の扶養親族」欄も書いてください</p>
      <p className="mt-1">23歳未満の特例を使うときは、その家族の情報を書く必要があります。2人以上いる場合は、どれか1人だけ書けば大丈夫です。</p>
      {who ? (
        <ul className="mt-2 list-disc pl-5">
          <li>氏名（フリガナ）：{who.person.label || who.person.relation} の氏名</li>
          <li>個人番号：その人のマイナンバー（勤務先によっては不要）</li>
          <li>生年月日：{who.birthWareki}</li>
          <li>あなたとの続柄：{who.person.relation}</li>
          <li>本年中の合計所得金額の見積額：{who.income.toLocaleString("ja-JP")} 円</li>
          <li>住所：一緒に住んでいなければ、その人の住所</li>
        </ul>
      ) : (
        <p className="mt-2">氏名・個人番号・生年月日（平成16年1月2日以後生まれ）・続柄・本年中の合計所得金額の見積額を書きます。「家族と収入」タブで入力すると、書く内容をここに表示します。</p>
      )}
    </div>
  );
}
