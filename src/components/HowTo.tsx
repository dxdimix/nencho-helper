"use client";

import { Book, Calendar, Family, FormPen, House, Office, Postcard, Salary } from "@/components/Illustrations";

// 使い方（はじめての方へ）。用意するもの → 4つの手順（実際の画面の縮小図つき）→ 会社に出す。
// 画面の画像は public/howto/（架空のデータで撮影したもの）。

function Prepare({ icon, title, note }: { icon: React.ReactNode; title: string; note?: string }) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-gray-50 p-2">
      <span className="shrink-0">{icon}</span>
      <span className="text-sm">
        <b>{title}</b>
        {note && <span className="block text-xs text-gray-600">{note}</span>}
      </span>
    </li>
  );
}

function Step({ n, title, text, img, alt }: { n: number; title: string; text: React.ReactNode; img: string; alt: string }) {
  return (
    <li className="rounded-2xl bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-white">{n}</span>
        <h3 className="text-base font-bold">{title}</h3>
      </div>
      <div className="flex gap-3">
        {/* 実際の画面の縮小図（静的書き出しなので next/image の最適化は使えない） */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt={alt} loading="lazy" className="w-[42%] max-w-[180px] shrink-0 self-start rounded-xl border-4 border-gray-800" />
        <div className="space-y-2 text-sm leading-relaxed">{text}</div>
      </div>
    </li>
  );
}

export function HowTo({ onStart, onClose, onGuide }: { onStart: () => void; onClose: () => void; onGuide: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm">
          ← もどる
        </button>
        <span className="font-bold">使い方</span>
      </div>

      <section className="rounded-2xl bg-blue-50 p-4 text-center">
        <p className="text-lg font-bold">はじめての方へ</p>
        <p className="mt-1 text-sm">
          質問に答えて、届いたハガキを登録すると、申告書の「お手本」が出ます。
          <br />
          お手本を見ながら、会社から配られた申告書に書き写します。
        </p>
      </section>

      <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-bold">用意するもの</h2>
        <ul className="space-y-2">
          <Prepare icon={<Office className="h-10 w-10" />} title="会社から配られた申告書（用紙）" note="保険料控除申告書・扶養控除等申告書など" />
          <Prepare icon={<Postcard className="h-10 w-10" />} title="届いたハガキ（控除証明書）" note="保険会社・日本年金機構などから10〜11月ごろに届きます" />
          <Prepare icon={<Salary className="h-10 w-10" />} title="今年のだいたいの給料" note="ボーナス込み。給与明細や去年の源泉徴収票で分かります" />
          <Prepare icon={<Family className="h-10 w-10" />} title="家族の生年月日と年収" note="配偶者や子ども・親などがいる場合" />
          <Prepare icon={<House className="h-10 w-10" />} title="住宅ローンの書類（ある人だけ）" note="税務署から届いた申告書と、銀行の年末残高等証明書" />
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="px-1 font-bold">やること</h2>
        <ol className="space-y-3">
          <Step
            n={1}
            title="質問に答える（約2分）"
            img="howto/1-question.webp"
            alt="質問の画面"
            text={
              <>
                <p>給料や家族のことを、ボタンを押して答えます。全部で7問です。</p>
                <p className="text-xs text-gray-600">金額は「500万円」などのボタンでも選べます。だいたいの金額で大丈夫です。</p>
              </>
            }
          />
          <Step
            n={2}
            title="ハガキを登録する"
            img="howto/2-register.webp"
            alt="ハガキの登録の画面"
            text={
              <>
                <p>
                  <b>「写真で登録」</b>でハガキを撮ると、自動で読み取ります。<b>「手で入力」</b>でも登録できます。
                </p>
                <p>ハガキを1枚ずつ、全部登録します。登録したハガキは下の一覧に並びます。</p>
                <p className="text-xs text-gray-600">「写真で登録」は、自宅PCでアプリを起動しているときに使えます（外出先ではログインが必要です）。</p>
              </>
            }
          />
          <Step
            n={3}
            title="確認する"
            img="howto/3-review.webp"
            alt="確認の画面"
            text={
              <>
                <p>撮り忘れたハガキがないか、読み取った金額が合っているかを確認します。</p>
                <p className="text-xs text-gray-600">年末調整に使わない書類（病院の領収書など）を撮った場合は、どうすればよいかを案内します。</p>
              </>
            }
          />
          <Step
            n={4}
            title="お手本を見て書く"
            img="howto/4-result.webp"
            alt="お手本の画面"
            text={
              <>
                <p>申告書の画像に、書く内容が<b className="text-blue-700">青い文字</b>で出ます。そのまま会社の申告書に書き写します。</p>
                <p className="text-xs text-gray-600">氏名・住所・マイナンバーは、ご自身で書いてください。</p>
              </>
            }
          />
        </ol>
      </section>

      <section className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <Calendar className="h-12 w-12 shrink-0" />
        <div className="text-sm">
          <p className="font-bold">最後に、会社に出す</p>
          <p>書いた申告書と、ハガキ（控除証明書）を一緒に会社に出します。提出の期限は、会社の案内を確認してください。</p>
        </div>
      </section>

      <button onClick={onStart} className="w-full rounded-full bg-blue-600 px-4 py-4 text-lg font-bold text-white">
        さっそく始める
      </button>
      <button onClick={onGuide} className="flex w-full items-center justify-center gap-2 text-sm text-green-700 underline">
        <Book className="h-5 w-5" />
        年末調整のしくみや今年の変更点は「ねんちょーガイド」へ
      </button>
      <FormPen className="mx-auto h-12 w-12 opacity-60" />
    </div>
  );
}
