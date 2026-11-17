"use client";

import { FamilyForm } from "@/components/FamilyForm";
import type { Timing } from "@/components/ReviewStep";
import { DOC_OPTIONS, type DocId } from "@/lib/docs";
import type { Family } from "@/lib/family";

// ① アンケート。年末調整の時期、収入と家族、あてはまるもの（必要な書類の判断に使う）を聞く。
// 答えは画面の状態にだけ持つ（保存しない）。

function Q({ n, title, children, done }: { n: number; title: string; children: React.ReactNode; done: boolean }) {
  return (
    <section className={`space-y-3 rounded-lg border-2 bg-white p-3 ${done ? "border-green-500" : "border-orange-400"}`}>
      <h2 className="flex items-center gap-2 font-bold">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm text-white ${done ? "bg-green-600" : "bg-orange-500"}`}>
          {done ? "✓" : `Q${n}`}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Questionnaire({
  timing,
  onTiming,
  family,
  onFamily,
  selected,
  noneSelected,
  onSelected,
  onNoneSelected,
  onNext,
}: {
  timing: Timing | null;
  onTiming: (t: Timing) => void;
  family: Family;
  onFamily: (f: Family) => void;
  selected: DocId[];
  noneSelected: boolean;
  onSelected: (s: DocId[]) => void;
  onNoneSelected: (v: boolean) => void;
  onNext: () => void;
}) {
  const incomeDone = family.self.salary > 0;
  const docsDone = selected.length > 0 || noneSelected;
  const ready = timing !== null && incomeDone && docsDone;
  const toggle = (id: DocId) => {
    onNoneSelected(false);
    onSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  return (
    <div className="space-y-4">
      <p className="rounded bg-blue-50 p-3 text-sm">
        まず、いくつか質問に答えてください。答えをもとに、撮影が必要な書類と、書く必要がある申告書を案内します。
        入力した内容はこの画面の中だけで使い、どこにも保存しません。氏名やマイナンバーは入力しなくて大丈夫です。
      </p>

      <Q n={1} title="勤務先の年末調整はいつですか？" done={timing !== null}>
        <p className="text-sm text-gray-700">
          ふつうは12月です。会社から配られた申告書の提出期限などで確認してください。11月中に年末調整をする会社では、扶養の基準が少し変わります。
        </p>
        <div className="grid grid-cols-3 gap-2 text-sm">
          {(["12月", "11月以前", "分からない"] as const).map((t) => (
            <button key={t} onClick={() => onTiming(t)} className={`rounded px-2 py-3 ${timing === t ? "bg-green-600 text-white" : "border border-gray-400"}`}>
              {t}
            </button>
          ))}
        </div>
        {timing === "分からない" && <p className="text-xs text-gray-600">12月として計算します。あとで分かったら、ここに戻って選び直してください。</p>}
      </Q>

      <Q n={2} title="あなたの収入と、家族について教えてください" done={incomeDone}>
        <p className="text-sm text-gray-700">
          「今年の給与の収入」は、今年1年分の給料とボーナスの合計の見込みです（税金などを引く前の金額）。だいたいの金額でかまいません。
          配偶者や、生活費を出している家族（子・親など）がいれば追加してください。
        </p>
        <FamilyForm value={family} onChange={onFamily} />
      </Q>

      <Q n={3} title="あてはまるものを、すべて選んでください" done={docsDone}>
        <div className="space-y-2">
          {DOC_OPTIONS.map((o) => (
            <label key={o.id} className={`flex items-start gap-3 rounded border p-2 text-sm ${selected.includes(o.id) ? "border-blue-500 bg-blue-50" : "border-gray-300"}`}>
              <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} />
              <span>
                {o.label}
                <span className="block text-xs text-gray-600">{o.hint}</span>
              </span>
            </label>
          ))}
          <label className={`flex items-start gap-3 rounded border p-2 text-sm ${noneSelected ? "border-blue-500 bg-blue-50" : "border-gray-300"}`}>
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 shrink-0"
              checked={noneSelected}
              onChange={(e) => {
                onNoneSelected(e.target.checked);
                if (e.target.checked) onSelected([]);
              }}
            />
            <span>
              どれにもあてはまらない
              <span className="block text-xs text-gray-600">この場合も、基礎控除申告書と扶養控除等申告書のお手本は作れます。</span>
            </span>
          </label>
        </div>
        <p className="text-xs text-gray-600">分からないものは選ばなくて大丈夫です。届いたハガキを撮影すれば、どの種類かは自動で見分けます。</p>
      </Q>

      <button onClick={onNext} disabled={!ready} className="w-full rounded-lg bg-blue-600 px-4 py-4 text-lg font-bold text-white disabled:bg-gray-300">
        {ready ? "次へ：書類を撮影する" : "Q1〜Q3に答えてください"}
      </button>
    </div>
  );
}
