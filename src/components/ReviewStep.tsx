"use client";

import { useState } from "react";
import { buildChecklist, fillBlank, findBlanks, lowConfidence, OTHER_DOC_ADVICE, setAmount } from "@/lib/review";
import type { ReadResult } from "@/lib/schema";

// お手本を出す前の確認ステップ。
// 空欄の補足、自信がない金額の見直し、撮り忘れの確認、年末調整の時期の確認をしてから、お手本を表示する。

export type Timing = "12月" | "11月以前" | "分からない";

const yen = (n: number) => n.toLocaleString("ja-JP");

function Card({ step, title, children, done }: { step: number; title: string; children: React.ReactNode; done?: boolean }) {
  return (
    <section className={`rounded-lg border-2 bg-white p-3 ${done ? "border-green-500" : "border-orange-400"}`}>
      <h3 className="mb-2 flex items-center gap-2 font-bold">
        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-sm text-white ${done ? "bg-green-600" : "bg-orange-500"}`}>{done ? "✓" : step}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function ReviewStep({
  data,
  onChange,
  timing,
  onTiming,
  onTakePhoto,
  onDone,
}: {
  data: ReadResult;
  onChange: (d: ReadResult) => void;
  timing: Timing | null;
  onTiming: (t: Timing) => void;
  onTakePhoto: () => void;
  onDone: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, "ない" | "ある">>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const blanks = findBlanks(data);
  const unsure = lowConfidence(data);
  const checklist = buildChecklist(data);
  const pending = checklist.filter((c) => !c.done && !answers[c.id]);
  const unsureLeft = unsure.filter((u) => !checked[`${u.section}-${u.index}`]);
  const ready = pending.length === 0 && unsureLeft.length === 0 && timing !== null;

  const counts = [
    ["生命保険など", data.life.length],
    ["地震保険", data.earthquake.length],
    ["国民年金・社会保険", data.social.length],
    ["iDeCo・小規模企業共済", data.smallBiz.length],
    ["住宅ローン", data.housing.length],
  ].filter(([, n]) => (n as number) > 0);

  let step = 0;
  return (
    <div className="space-y-4">
      <p className="rounded bg-blue-50 p-3 text-sm">
        お手本を出す前に、いくつか確認させてください。オレンジ色の項目に答えると、下の「お手本を表示する」ボタンが押せるようになります。
      </p>

      <section className="rounded-lg border border-gray-300 bg-white p-3 text-sm">
        <h3 className="mb-1 font-bold">読み取った書類</h3>
        {counts.length === 0 ? <p>控除に使える書類は、まだ読み取れていません。</p> : (
          <ul className="list-disc pl-5">
            {counts.map(([label, n]) => (
              <li key={label as string}>{label}：{n}件</li>
            ))}
          </ul>
        )}
      </section>

      {(data.otherDocs.length > 0 || data.excluded.length > 0) && (
        <Card step={++step} title="申告書に書かない書類がありました" done>
          <ul className="space-y-2 text-sm">
            {data.otherDocs.map((o, i) => (
              <li key={`o${i}`} className="rounded bg-gray-50 p-2">
                <b>{o.summary || o.docType}</b>
                <br />
                {OTHER_DOC_ADVICE[o.docType]}
              </li>
            ))}
            {data.excluded.map((e, i) => (
              <li key={`e${i}`} className="rounded bg-gray-50 p-2">
                <b>{e.description}</b>
                <br />
                {e.reason}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {blanks.length > 0 && (
        <Card step={++step} title="ハガキに書いていなかった項目（任意）" done>
          <p className="mb-2 text-sm">申告書に書く欄ですが、ハガキからは分かりませんでした。分かる範囲で入力してください（空欄のままでも進めます。その場合は手書きのときに記入してください）。</p>
          <div className="space-y-2">
            {blanks.map((b) => (
              <label key={`${b.section}-${b.index}-${b.field}`} className="block text-sm">
                <span className="text-gray-700">
                  {b.owner}：{b.label}
                </span>
                <input
                  className="mt-1 w-full rounded border border-gray-400 p-2"
                  autoComplete="off"
                  onBlur={(e) => e.target.value.trim() && onChange(fillBlank(data, b, e.target.value.trim()))}
                  placeholder="入力して次の欄へ"
                />
              </label>
            ))}
          </div>
        </Card>
      )}

      {unsure.length > 0 && (
        <Card step={++step} title="金額をハガキと見比べてください" done={unsureLeft.length === 0}>
          <p className="mb-2 text-sm">読み取りに少し自信がない項目です。ハガキの金額と同じなら「合っている」を押してください。違っていたら金額を直してから押してください。</p>
          <div className="space-y-2">
            {unsure.map((u) => {
              const key = `${u.section}-${u.index}`;
              return (
                <div key={key} className={`rounded border p-2 text-sm ${checked[key] ? "border-green-400 bg-green-50" : "border-gray-300"}`}>
                  <p className="font-bold">{u.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      inputMode="numeric"
                      className="w-36 rounded border border-gray-400 p-2 text-right font-mono"
                      defaultValue={yen(u.amount)}
                      onBlur={(e) => onChange(setAmount(data, u.section, u.index, Number(e.target.value.replace(/[^\d]/g, "")) || 0))}
                    />
                    <span>円</span>
                    <button
                      onClick={() => setChecked({ ...checked, [key]: true })}
                      className={`ml-auto rounded px-3 py-2 ${checked[key] ? "bg-green-600 text-white" : "border border-green-600 text-green-700"}`}
                    >
                      {checked[key] ? "確認済み" : "合っている"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card step={++step} title="撮り忘れはありませんか？" done={pending.length === 0}>
        <p className="mb-2 text-sm">年末調整でよく使う書類です。持っているのにまだ撮影していないものがないか、1つずつ確認してください。</p>
        <div className="space-y-2">
          {checklist.map((c) => (
            <div key={c.id} className={`rounded border p-2 text-sm ${c.done || answers[c.id] === "ない" ? "border-green-400 bg-green-50" : "border-gray-300"}`}>
              <p className="font-bold">
                {c.done ? "✓ " : ""}
                {c.question}
              </p>
              <p className="text-xs text-gray-600">{c.hint}</p>
              {c.done ? (
                <p className="mt-1 text-xs text-green-700">読み取り済みです。同じ種類のハガキがほかにもあれば、追加で撮影してください。</p>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setAnswers({ ...answers, [c.id]: "ない" })}
                    className={`rounded px-2 py-2 ${answers[c.id] === "ない" ? "bg-green-600 text-white" : "border border-gray-400"}`}
                  >
                    持っていない
                  </button>
                  <button onClick={onTakePhoto} className="rounded border border-blue-600 px-2 py-2 text-blue-700">
                    持っている → 撮影する
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card step={++step} title="勤務先の年末調整はいつですか？" done={timing !== null}>
        <p className="mb-2 text-sm">
          ふつうは12月です。11月中に年末調整をする会社では、子どもなどの扶養の基準が少し変わります。会社からの案内（申告書の提出期限など）で確認してください。
        </p>
        <div className="grid grid-cols-3 gap-2 text-sm">
          {(["12月", "11月以前", "分からない"] as const).map((t) => (
            <button key={t} onClick={() => onTiming(t)} className={`rounded px-2 py-2 ${timing === t ? "bg-green-600 text-white" : "border border-gray-400"}`}>
              {t}
            </button>
          ))}
        </div>
        {timing === "分からない" && <p className="mt-2 text-xs text-gray-600">12月として計算します。11月中に年末調整をすると分かったら、ここで選び直してください。</p>}
      </Card>

      <button
        onClick={onDone}
        disabled={!ready}
        className="w-full rounded-lg bg-blue-600 px-4 py-4 text-lg font-bold text-white disabled:bg-gray-300"
      >
        {ready ? "確認できました。お手本を表示する" : "オレンジ色の項目に答えてください"}
      </button>
    </div>
  );
}
