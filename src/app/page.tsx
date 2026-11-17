"use client";

import { useEffect, useRef, useState } from "react";
import { BasicGuide, DependentsGuide } from "@/components/FamilyGuides";
import { BasicFormImage, FormImage } from "@/components/FormImage";
import { Glossary } from "@/components/Glossary";
import { Bag, Book, Camera, Checklist, FormPen, Health, HeroFlow, House, Pension, PiggyBank, Postcard, Shield } from "@/components/Illustrations";
import { InfoTip } from "@/components/InfoTip";
import { NenchoGuide } from "@/components/NenchoGuide";
import { Guide } from "@/components/Guide";
import { HousingGuide } from "@/components/HousingGuide";
import { Questionnaire } from "@/components/Questionnaire";
import { ReviewStep, type Timing } from "@/components/ReviewStep";
import { calculate } from "@/lib/calc";
import { readCount, requiredDocs, type DocId } from "@/lib/docs";
import { estimateSaving } from "@/lib/estimate";
import { calcHousing, housingInputFrom } from "@/lib/housing";
import { emptySelf, hasUnder23Dependent, under23DependentFor, type Family } from "@/lib/family";
import { READ_PROMPT } from "@/lib/prompt.mjs";
import { mergeResults, parsePasted, ReadResult } from "@/lib/schema";

// 画面の流れ：① アンケート → ② 書類の撮影 → ③ 確認 → ④ お手本（すべての申告書を1ページに表示）
//
// 個人情報の扱い: アンケートの答え・写真・読み取り結果は画面の状態（メモリ）にだけ持つ。
// localStorage などには保存しない。写真は自宅PCのサーバー（同じ Wi-Fi 内）にだけ送る。

type Mode = "checking" | "local" | "paste" | "badToken";
type Step = "questions" | "photos" | "review" | "result";

const STEPS: { id: Step; label: string }[] = [
  { id: "questions", label: "アンケート" },
  { id: "photos", label: "書類の撮影" },
  { id: "review", label: "確認" },
  { id: "result", label: "お手本" },
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

const yen = (n: number) => n.toLocaleString("ja-JP");

const DOC_ICON: Record<DocId, React.ReactNode> = {
  life: <Shield className="h-10 w-10" />,
  earthquake: <House quake className="h-10 w-10" />,
  pension: <Pension className="h-10 w-10" />,
  health: <Health className="h-10 w-10" />,
  smallbiz: <PiggyBank className="h-10 w-10" />,
  housing: <House className="h-10 w-10" />,
  housingFirst: <House className="h-10 w-10" />,
  previousJob: <Bag className="h-10 w-10" />,
};

export default function Home() {
  const [mode, setMode] = useState<Mode>("checking");
  const [token, setToken] = useState("");
  const [version, setVersion] = useState("");
  // 最初の画面（welcome）、手順の画面（app）、ねんちょーガイド（guide）
  const [screen, setScreen] = useState<"welcome" | "app" | "guide">("welcome");
  const [guideFrom, setGuideFrom] = useState<"welcome" | "app">("welcome");
  const [step, setStep] = useState<Step>("questions");
  const [visited, setVisited] = useState<Step[]>(["questions"]);

  // ① アンケートの答え
  const [timing, setTiming] = useState<Timing | null>(null);
  const [family, setFamily] = useState<Family>({ self: emptySelf(), spouse: null, dependents: [] });
  const [selected, setSelected] = useState<DocId[]>([]);
  const [noneSelected, setNoneSelected] = useState(false);

  // ② 読み取り
  const [data, setData] = useState<ReadResult | null>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [pasted, setPasted] = useState("");
  const [copied, setCopied] = useState(false);
  const [selfTest, setSelfTest] = useState<{ state: "idle" | "running" | "ok" | "ng"; message: string }>({ state: "idle", message: "" });
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  // ④ お手本
  const [view, setView] = useState<"image" | "table">("image");
  const [under23, setUnder23] = useState(false);
  // 勤務先が11月30日以前に年末調整をするなら、23歳未満の扶養親族の所得の基準を58万円に読み替える
  const under23IncomeLimit = timing === "11月以前" ? 580_000 : 620_000;
  // 家族全員の生年月日が入っていれば、23歳未満の扶養親族の有無を自動で判定する。家族がいなければ「いない」。
  const allBirths = family.dependents.length > 0 && family.dependents.every((d) => d.birth);
  const autoUnder23 = allBirths ? hasUnder23Dependent(family, 2026, under23IncomeLimit) : family.dependents.length === 0 ? false : null;
  const missingBirth = family.dependents.some((d) => !d.birth);
  const effectiveUnder23 = autoUnder23 ?? under23;

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

  function go(s: Step) {
    setStep(s);
    setVisited((v) => (v.includes(s) ? v : [...v, s]));
    window.scrollTo({ top: 0 });
  }

  // 読み取り結果を追加する。成功したら true。
  function addResult(text: string): boolean {
    const res = parsePasted(text);
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    setError("");
    setData((prev) => (prev ? mergeResults(prev, res.data) : res.data));
    // 新しく読み取ったら、確認からやり直す
    setVisited((v) => v.filter((x) => x !== "result"));
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

  // 見本のハガキ（架空の内容）を読み取らせて、PC側の読み取りが正しく動くかを確かめる。結果はお手本には加えない。
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
          : { state: "ng", message: `読み取りはできましたが、内容が想定と違いました（${item ? `${item.category}・${item.system}・${item.amount}円` : "項目なし"}）。` },
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
    if (!window.confirm("入力した内容と読み取った内容を、すべて消去します。よろしいですか？")) return;
    setData(null);
    setError("");
    setPasted("");
    setTiming(null);
    setFamily({ self: emptySelf(), spouse: null, dependents: [] });
    setSelected([]);
    setNoneSelected(false);
    setVisited(["questions"]);
    go("questions");
  }

  const docs = requiredDocs(selected);

  // 戻る金額の目安（アンケートの答えと読み取った書類から）
  const calc = data ? calculate(data, { under23: effectiveUnder23 }) : null;
  const insuranceDeduction = calc ? calc.lifeDeduction + calc.earthquake.deduction + calc.social.deduction + calc.smallBiz.deduction : 0;
  const housingCredit = data && data.housing.length > 0 ? (calcHousing(housingInputFrom(data.housing)).amount ?? 0) : 0;
  const mine =
    family.self.salary > 0 && (insuranceDeduction > 0 || housingCredit > 0)
      ? { ...estimateSaving(family, insuranceDeduction, housingCredit), note: "保険料控除・住宅ローン控除で所得税が安くなる金額の目安です。会社の社会保険料を給料の約14.7%として計算しています。" }
      : null;

  function openGuide() {
    setGuideFrom(screen === "guide" ? guideFrom : screen === "app" ? "app" : "welcome");
    setScreen("guide");
    window.scrollTo({ top: 0 });
  }
  const hasInsurance = !!data && data.life.length + data.earthquake.length + data.social.length + data.smallBiz.length > 0;
  const showHousing = selected.includes("housing") || (data?.housing.length ?? 0) > 0;

  const pasteFlow = (
    <div className="space-y-3 text-sm">
      <ol className="list-decimal space-y-1 pl-5">
        <li>「依頼文をコピー」を押します。</li>
        <li>
          ChatGPT・Claude・Gemini など、写真を読めるAIのチャットを開きます。
          <b>書類の写真を添付し、同じメッセージに依頼文を貼り付けて</b>送ります。
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
          if (addResult(pasted)) setPasted("");
        }}
        disabled={!pasted.trim()}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:bg-gray-400"
      >
        読み込む
      </button>
    </div>
  );

  const viewToggle = (
    <div className="grid grid-cols-2 overflow-hidden rounded border border-gray-400 text-sm">
      {(["image", "table"] as const).map((v) => (
        <button key={v} onClick={() => setView(v)} className={`py-2 ${view === v ? "bg-blue-600 text-white" : "bg-white"}`}>
          {v === "image" ? "申告書の画像で見る" : "表で見る"}
        </button>
      ))}
    </div>
  );

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4 text-gray-900">
      <header className="flex items-center justify-between">
        <h1 className="leading-tight">
          <span className="block text-lg font-bold text-blue-700">サクッとねんちょー</span>
          <span className="block text-[11px] text-gray-500">撮って、答えて、書き写すだけ</span>
        </h1>
        {screen !== "guide" && (
          <button onClick={openGuide} className="flex items-center gap-1 rounded-full border border-green-600 bg-white px-3 py-1 text-sm text-green-700">
            <Book className="h-5 w-5" />
            ねんちょーガイド
          </button>
        )}
      </header>

      {screen === "guide" && (
        <NenchoGuide
          mine={mine}
          onClose={() => {
            setScreen(guideFrom);
            window.scrollTo({ top: 0 });
          }}
          onStart={() => {
            setScreen("app");
            window.scrollTo({ top: 0 });
          }}
        />
      )}

      {screen === "welcome" && (
        <div className="space-y-5">
          <div className="space-y-3 rounded-2xl bg-white p-5 text-center shadow-sm">
            <HeroFlow className="mx-auto w-full max-w-sm" />
            <p className="text-xl font-bold leading-snug">
              ハガキを撮るだけで、
              <br />
              年末調整の「お手本」ができます
            </p>
            <p className="text-sm text-gray-600">質問に答えて、届いたハガキを撮影。あとはお手本を見て書き写すだけです。</p>
          </div>
          <ol className="grid grid-cols-3 gap-2 text-center text-xs">
            {[
              [<Checklist key="a" className="mx-auto h-12 w-12" />, "質問に答える", "約2分"],
              [<Camera key="b" className="mx-auto h-12 w-12" />, "ハガキを撮る", "1枚ずつ"],
              [<FormPen key="c" className="mx-auto h-12 w-12" />, "お手本を見て書く", "書き写すだけ"],
            ].map(([icon, t, sub], i) => (
              <li key={i} className="rounded-2xl bg-white p-2 shadow-sm">
                {icon}
                <b className="block">
                  {i + 1}. {t}
                </b>
                <span className="text-gray-500">{sub}</span>
              </li>
            ))}
          </ol>
          <button onClick={() => setScreen("app")} className="w-full rounded-full bg-blue-600 px-4 py-4 text-lg font-bold text-white">
            はじめる
          </button>
          <button onClick={openGuide} className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-green-600 bg-white px-4 py-3 font-bold text-green-700">
            <Book className="h-6 w-6" />
            はじめての方へ：ねんちょーガイド
          </button>
          <p className="text-center text-xs text-gray-500">入力した内容や写真は保存しません。画面を閉じると消えます。</p>
        </div>
      )}

      {mode === "badToken" && (
        <p className="rounded border border-red-400 bg-red-50 p-2 text-sm text-red-800">
          アドレスが正しくありません。PCの画面に表示されているアドレス（または QR コード）から開き直してください。
        </p>
      )}

      {screen === "app" && (
      <>
      {/* 今どこにいるか */}
      <nav className="sticky top-0 z-10 -mx-4 grid grid-cols-4 gap-1 border-b border-gray-300 bg-gray-50 px-2 py-2 text-xs sm:text-sm" aria-label="手順">
        {STEPS.map((s, i) => {
          const current = step === s.id;
          const canGo = visited.includes(s.id) && !current;
          return (
            <button
              key={s.id}
              onClick={() => canGo && go(s.id)}
              disabled={!canGo}
              aria-current={current ? "step" : undefined}
              className={`flex flex-col items-center rounded px-1 py-1 ${current ? "bg-blue-600 font-bold text-white" : visited.includes(s.id) ? "bg-white text-blue-700" : "text-gray-400"}`}
            >
              <span>{["①", "②", "③", "④"][i]}</span>
              <span>{s.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ① アンケート */}
      {step === "questions" && (
        <Questionnaire
          timing={timing}
          onTiming={setTiming}
          family={family}
          onFamily={setFamily}
          selected={selected}
          noneSelected={noneSelected}
          onSelected={setSelected}
          onNoneSelected={setNoneSelected}
          onNext={() => go("photos")}
        />
      )}

      {/* ② 書類の撮影 */}
      {step === "photos" && (
        <div className="space-y-4">
          <section className="space-y-2 rounded-lg border border-gray-300 bg-white p-3">
            <h2 className="flex items-center gap-2 font-bold">
              <Postcard className="h-8 w-8" />
              撮影する書類
              <InfoTip>質問の答えから、必要な書類を選んでいます。撮影すると「読み取り済み」に変わります。同じ種類が何枚あっても、全部撮影してください。</InfoTip>
            </h2>
            {docs.length === 0 ? (
              <p className="text-sm">質問の答えでは、撮影が必要な書類はありません。手元に保険会社などのハガキがあれば、撮影してください。</p>
            ) : (
              <ul className="space-y-2">
                {docs.map((d) => {
                  const n = readCount(data, d.id);
                  return (
                    <li key={d.id} className={`rounded-2xl border-2 p-2 text-sm ${!d.photo ? "border-gray-200 bg-gray-50" : n > 0 ? "border-green-400 bg-green-50" : "border-orange-300 bg-white"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex items-center gap-2">
                          {DOC_ICON[d.id]}
                          <b>{d.title}</b>
                        </span>
                        <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${!d.photo ? "bg-gray-200" : n > 0 ? "bg-green-600 text-white" : "bg-orange-100 text-orange-800"}`}>
                          {!d.photo ? "撮影不要" : n > 0 ? `読み取り済み ${n}件` : "まだ"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-700">{d.how}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {mode === "local" && (
            <section className="space-y-3">
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => sendPhotos(e.target.files)} />
              <input ref={libraryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => sendPhotos(e.target.files)} />
              <p className="text-sm">書類を1枚ずつ撮影してください。どの書類か分からなくても大丈夫です。年末調整に使わない書類なら、その旨を案内します。</p>
              <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
                <button onClick={() => cameraRef.current?.click()} disabled={reading} className="rounded-lg bg-blue-600 px-4 py-5 text-lg font-bold text-white disabled:bg-gray-400">
                  {data ? "次の書類を撮影" : "書類を撮影"}
                </button>
                <button onClick={() => libraryRef.current?.click()} disabled={reading} className="rounded-lg border border-gray-400 bg-white px-4 py-3 disabled:text-gray-400">
                  保存済みの写真から選ぶ（まとめて選べます）
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

          {(selected.includes("health") || selected.includes("pension")) && (
            <ManualSocial onAdd={(item) => setData((prev) => mergeResults(prev ?? ReadResult.parse({}), ReadResult.parse({ social: [item] })))} />
          )}

          <div className="grid gap-2">
            <button
              onClick={() => go(data ? "review" : "result")}
              disabled={reading}
              className="w-full rounded-lg bg-blue-600 px-4 py-4 text-lg font-bold text-white disabled:bg-gray-300"
            >
              {data ? "撮り終えたら：次へ（確認）" : "撮影する書類がないので、お手本へ進む"}
            </button>
            <button onClick={() => go("questions")} className="text-sm text-blue-700 underline">
              ← アンケートに戻る
            </button>
          </div>

          {mode === "local" && (
            <>
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
              <details className="text-sm">
                <summary className="cursor-pointer text-gray-600">うまく読み取れないとき：AIのチャットを使う方法</summary>
                <div className="mt-2">{pasteFlow}</div>
              </details>
            </>
          )}
        </div>
      )}

      {/* ③ 確認 */}
      {step === "review" && data && (
        <ReviewStep data={data} onChange={setData} selected={selected} onTakePhoto={() => go("photos")} onDone={() => go("result")} />
      )}

      {/* ④ お手本 */}
      {step === "result" && (
        <div className="space-y-6">
          {mine && (
            <section className="rounded-2xl bg-green-50 p-4 text-center">
              <p className="text-sm">
                あなたの場合、税金が安くなる目安
                <InfoTip>{mine.note} 実際の金額は勤務先の計算で決まります。12月か1月の給料と一緒に戻るのがふつうです。</InfoTip>
              </p>
              <p className="text-3xl font-bold text-green-700">約 {yen(Math.round(mine.saving / 100) * 100)} 円</p>
            </section>
          )}
          <section className="rounded-lg border border-gray-300 bg-white p-3 text-sm">
            <h2 className="mb-1 font-bold">勤務先に出す申告書</h2>
            <p className="mb-2">上から順に、それぞれのお手本を見ながら手書きしてください。</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                <a href="#hoken" className="text-blue-700 underline">保険料控除申告書（令和8年分）</a>
                {!hasInsurance && "　… 書く書類はありません"}
              </li>
              {showHousing && (
                <li>
                  <a href="#housing" className="text-blue-700 underline">住宅借入金等特別控除申告書（税務署から届いたもの）</a>
                </li>
              )}
              <li>
                <a href="#kiso" className="text-blue-700 underline">基礎控除申告書 兼 配偶者控除等申告書 …（令和8年分）</a>
              </li>
              <li>
                <a href="#fuyou" className="text-blue-700 underline">扶養控除等申告書（令和9年分。来年分として出します）</a>
              </li>
            </ol>
            {selected.includes("housingFirst") && (
              <p className="mt-2 rounded bg-yellow-50 p-2">住宅ローン控除の1年目は、年末調整ではなく確定申告（来年の2月〜3月）で受けます。</p>
            )}
            {selected.includes("previousJob") && (
              <p className="mt-2 rounded bg-yellow-50 p-2">前の会社の源泉徴収票を、まだ今の会社に渡していなければ、申告書と一緒に渡してください。</p>
            )}
            {timing === "11月以前" && (
              <p className="mt-2 rounded bg-yellow-50 p-2">
                勤務先が11月中に年末調整をする場合、基礎控除などの計算の基準がこのお手本（12月の年末調整用）と違うことがあります。勤務先から配られた申告書と案内に従ってください。
              </p>
            )}
            <div className="mt-3">{viewToggle}</div>
          </section>

          <section id="hoken" className="scroll-mt-24 space-y-2">
            <h2 className="border-b-2 border-blue-600 pb-1 text-lg font-bold">1. 保険料控除申告書</h2>
            {!data || !hasInsurance ? (
              <p className="rounded bg-gray-50 p-2 text-sm">保険料控除申告書に書く書類はありませんでした。何も書かずに出すか、出さなくてよいかを勤務先に確認してください。</p>
            ) : (
              <>
                <label className="flex items-start gap-2 rounded border border-gray-300 bg-white p-3 text-sm">
                  <input type="checkbox" className="mt-1 h-5 w-5" checked={effectiveUnder23} disabled={autoUnder23 !== null} onChange={(e) => setUnder23(e.target.checked)} />
                  <span>
                    23歳未満（平成16年1月2日以後生まれ）の扶養親族がいる
                    <span className="block text-xs text-gray-600">
                      {autoUnder23 !== null
                        ? `アンケートの家族の情報から自動で判定しています（所得${timing === "11月以前" ? "58" : "62"}万円以下の家族が対象）。`
                        : `${missingBirth ? "生年月日が空欄の家族がいるため、自動では判定できません。" : ""}該当すると、一般の生命保険料（新契約）の控除の上限が4万円から6万円に上がります。`}
                    </span>
                  </span>
                </label>
                {effectiveUnder23 && data.life.some((i) => i.category === "一般" && i.system === "新") && <Under23Box family={family} incomeLimit={under23IncomeLimit} />}
                {view === "image" ? (
                  <FormImage data={data} calc={calculate(data, { under23: effectiveUnder23 })} under23={effectiveUnder23} />
                ) : (
                  <Guide data={data} calc={calculate(data, { under23: effectiveUnder23 })} />
                )}
              </>
            )}
          </section>

          {showHousing && (
            <section id="housing" className="scroll-mt-24 space-y-2">
              <h2 className="border-b-2 border-blue-600 pb-1 text-lg font-bold">2. 住宅ローン控除</h2>
              <HousingGuide items={data?.housing ?? []} />
            </section>
          )}

          <section id="kiso" className="scroll-mt-24 space-y-2">
            <h2 className="border-b-2 border-blue-600 pb-1 text-lg font-bold">{showHousing ? 3 : 2}. 基礎控除申告書（配偶者控除・特定親族特別控除など）</h2>
            {view === "image" ? <BasicFormImage family={family} /> : <BasicGuide family={family} />}
          </section>

          <section id="fuyou" className="scroll-mt-24 space-y-2">
            <h2 className="border-b-2 border-blue-600 pb-1 text-lg font-bold">{showHousing ? 4 : 3}. 扶養控除等申告書（令和9年分）</h2>
            <DependentsGuide family={family} />
          </section>

          <section className="rounded-lg border border-gray-300 bg-white p-3 text-sm">
            <h2 className="font-bold">出す前のチェック</h2>
            <ul className="mt-1 list-disc pl-5">
              <li>保険会社などのハガキ（控除証明書）は、申告書と一緒に勤務先に出します（裏面や指定の場所に貼り付けます）。</li>
              <li>氏名・住所・マイナンバーなどは、ご自身で記入してください。</li>
              <li>お手本は、入力した見込みの金額をもとにしています。勤務先からの案内とあわせて確認してください。</li>
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => go("questions")} className="rounded border border-gray-400 px-3 py-2">アンケートを直す</button>
              <button onClick={() => go("photos")} className="rounded border border-gray-400 px-3 py-2">書類を追加で撮影する</button>
              <button onClick={clearAll} className="rounded border border-red-400 px-3 py-2 text-red-700">すべて消去する</button>
            </div>
          </section>
        </div>
      )}

      </>
      )}

      <Glossary />

      <footer className="pt-4 text-center text-[10px] text-gray-400">
        {mode === "local" ? `自宅PCモード${version ? `・版 ${version}` : ""}` : mode === "paste" ? "チャット貼り付けモード" : ""}
      </footer>
    </main>
  );
}

// 証明書が届かない社会保険料（家族の国民健康保険料など）を手で入力する
function ManualSocial({ onAdd }: { onAdd: (item: Record<string, unknown>) => void }) {
  const [kind, setKind] = useState("国民健康保険料");
  const [payee, setPayee] = useState("");
  const [person, setPerson] = useState("");
  const [relation, setRelation] = useState("");
  const [amount, setAmount] = useState(0);
  const [added, setAdded] = useState("");
  return (
    <details className="rounded-lg border border-gray-300 bg-white p-3 text-sm">
      <summary className="cursor-pointer font-bold">証明書がない保険料を、手で入力する</summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="text-gray-700">種類</span>
          <select className="mt-1 w-full rounded border border-gray-400 p-2" value={kind} onChange={(e) => setKind(e.target.value)}>
            {["国民健康保険料", "介護保険料", "後期高齢者医療保険料", "国民年金保険料", "国民年金基金掛金"].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-gray-700">支払先（例：〇〇市）</span>
          <input className="mt-1 w-full rounded border border-gray-400 p-2" value={payee} onChange={(e) => setPayee(e.target.value)} autoComplete="off" />
        </label>
        <label className="block">
          <span className="text-gray-700">保険料を払うことになっている人（例：父）</span>
          <input className="mt-1 w-full rounded border border-gray-400 p-2" value={person} onChange={(e) => setPerson(e.target.value)} autoComplete="off" />
        </label>
        <label className="block">
          <span className="text-gray-700">その人とあなたとの続柄</span>
          <input className="mt-1 w-full rounded border border-gray-400 p-2" value={relation} onChange={(e) => setRelation(e.target.value)} autoComplete="off" />
        </label>
        <label className="block">
          <span className="text-gray-700">あなたが今年払った金額（1年分）</span>
          <input
            inputMode="numeric"
            className="mt-1 w-full rounded border border-gray-400 p-2 text-right font-mono"
            value={amount ? yen(amount) : ""}
            onChange={(e) => setAmount(Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
          />
        </label>
      </div>
      <button
        disabled={amount === 0}
        onClick={() => {
          onAdd({ kind, payee, burdenPerson: person, burdenRelation: relation, amount, confidence: "高", note: "手で入力" });
          setAdded(`${kind} ${yen(amount)}円を追加しました。`);
          setAmount(0);
        }}
        className="mt-2 rounded bg-blue-600 px-4 py-2 text-white disabled:bg-gray-300"
      >
        追加する
      </button>
      {added && <p className="mt-1 text-green-700">{added}</p>}
    </details>
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
          <li>本年中の合計所得金額の見積額：{yen(who.income)} 円</li>
          <li>住所：一緒に住んでいなければ、その人の住所</li>
        </ul>
      ) : (
        <p className="mt-2">氏名・個人番号・生年月日（平成16年1月2日以後生まれ）・続柄・本年中の合計所得金額の見積額を書きます。アンケートで家族の生年月日を入力すると、書く内容をここに表示します。</p>
      )}
    </div>
  );
}
