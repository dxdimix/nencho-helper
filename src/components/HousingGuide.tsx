"use client";

import { useEffect, useState } from "react";
import { calcHousing, defaultRate, housingInputFrom, type HousingInput } from "@/lib/housing";
import type { HousingItem } from "@/lib/schema";

// 住宅ローン控除（住宅借入金等特別控除）の記入のお手伝い。
// 読み取った書類から値を入れ、足りない値は画面で入力してもらう。入力は画面の状態にだけ持つ。

const yen = (n: number | null) => (n === null ? "—" : n.toLocaleString("ja-JP"));

function NumField({ label, value, onChange, unit, hint }: { label: string; value: number | null; onChange: (v: number | null) => void; unit: string; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="text-gray-700">{label}</span>
      <div className="mt-1 flex items-center gap-1">
        <input
          inputMode="decimal"
          className="w-full rounded border border-gray-400 p-2 text-right font-mono"
          value={value === null ? "" : unit === "円" ? value.toLocaleString("ja-JP") : String(value)}
          placeholder="未入力"
          onChange={(e) => {
            const raw = e.target.value.replace(unit === "円" ? /[^\d]/g : /[^\d.]/g, "");
            onChange(raw === "" ? null : Number(raw));
          }}
        />
        <span>{unit}</span>
      </div>
      {hint && <span className="text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-gray-300 py-1">
      <span className="text-sm">{label}</span>
      <span className={`text-right font-mono ${strong ? "text-lg font-bold text-blue-700" : ""}`}>{value}</span>
    </div>
  );
}

export function HousingGuide({ items }: { items: HousingItem[] }) {
  const [input, setInput] = useState<HousingInput>(() => housingInputFrom(items));
  // 新しい書類を読み取ったら、入力を作り直す
  const key = JSON.stringify(items);
  useEffect(() => setInput(housingInputFrom(JSON.parse(key))), [key]);
  const set = <K extends keyof HousingInput>(k: K, v: HousingInput[K]) => setInput({ ...input, [k]: v });
  const r = calcHousing(input);

  return (
    <div className="space-y-4">
      <section className="rounded border border-gray-300 bg-white p-3 text-sm">
        <h3 className="font-bold">住宅ローン控除とは</h3>
        <p className="mt-1">
          住宅ローンで家を買った人が、年末のローン残高の一定割合（0.7%など）だけ税金を安くしてもらえる制度です。
          <b>1年目は自分で確定申告</b>が必要で、<b>2年目からは年末調整</b>で受けられます。
        </p>
        <p className="mt-1">年末調整で使う書類は次の2つです。</p>
        <ul className="mt-1 list-disc pl-5">
          <li>税務署から届く「給与所得者の住宅借入金等特別控除申告書」（1年目の確定申告のあと、数年分がまとめて届きます）</li>
          <li>銀行などから届く「住宅取得資金に係る借入金の年末残高等証明書」（最近の借入れでは届かないこともあります）</li>
        </ul>
        {items.length === 0 && <p className="mt-2 rounded bg-yellow-50 p-2">まだ書類を読み取っていません。「書類の読み取り」タブで2つの書類を撮影するか、下に直接入力してください。</p>}
      </section>

      <section className="space-y-3 rounded border border-gray-300 bg-white p-3">
        <h3 className="font-bold">計算に使う値</h3>
        <p className="text-xs text-gray-600">読み取った値が入っています。違っていたら直してください。</p>
        <NumField label="年末残高（銀行の証明書、または申告書に印字された額）" value={input.balance} onChange={(v) => set("balance", v)} unit="円" />
        <label className="block text-sm">
          <span className="text-gray-700">住み始めた日（居住開始年月日）</span>
          <input
            className="mt-1 w-full rounded border border-gray-400 p-2"
            value={input.residenceStart}
            placeholder="例：令和5年4月1日"
            onChange={(e) => setInput({ ...input, residenceStart: e.target.value, ratePercent: input.ratePercent ?? defaultRate(e.target.value) })}
          />
        </label>
        <NumField label="控除率" value={input.ratePercent} onChange={(v) => set("ratePercent", v)} unit="%" hint="申告書に印字されています。目安：令和3年までに住み始めた人は1%、令和4年以後は0.7%" />
        <NumField label="控除限度額（申告書の「最高○○円」）" value={input.limit} onChange={(v) => set("limit", v)} unit="円" />
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-600">あてはまる人だけ：取得対価・店舗併用・夫婦でのローン</summary>
          <div className="mt-2 space-y-3">
            <NumField label="家屋・土地の取得対価の額（申告書に記載）" value={input.acquisitionCost} onChange={(v) => set("acquisitionCost", v)} unit="円" hint="年末残高より小さい場合だけ、計算に使います" />
            <NumField label="居住用の割合" value={input.residentialPercent} onChange={(v) => set("residentialPercent", v ?? 100)} unit="%" hint="店舗や事務所と兼用でなければ 100（90以上は100として計算します）" />
            <NumField label="あなたの負担割合" value={input.sharePercent} onChange={(v) => set("sharePercent", v ?? 100)} unit="%" hint="夫婦で借りた（連帯債務・ペアローン）場合だけ。ふつうは 100" />
          </div>
        </details>
      </section>

      <section className="rounded border-2 border-gray-700 bg-white p-3">
        <h3 className="mb-2 border-b-2 border-gray-700 pb-1 font-bold">計算の結果</h3>
        {r.missing.length > 0 ? (
          <div className="rounded bg-yellow-50 p-2 text-sm">
            <p className="font-bold">次の値が足りません。</p>
            <ul className="list-disc pl-5">
              {r.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <Row label="あなたの分の年末残高" value={`${yen(r.myBalance)} 円`} />
            {r.costCap !== null && <Row label="取得対価の額" value={`${yen(r.costCap)} 円`} />}
            <Row label={`計算に使う残高（小さい方${input.residentialPercent < 90 ? ` × 居住用 ${input.residentialPercent}%` : ""}）`} value={`${yen(r.target)} 円`} />
            <Row label={`× 控除率 ${input.ratePercent}%（100円未満切捨て）`} value={`${yen(r.raw)} 円`} />
            <Row label="住宅借入金等特別控除額" value={`${yen(r.amount)} 円`} strong />
            <p className="mt-2 text-xs text-gray-600">
              この金額を、申告書の「（特定増改築等）住宅借入金等特別控除額」欄に書きます。申告書の欄の番号は、住み始めた年によって違います。お手元の申告書の裏面の説明と見比べてください。
            </p>
          </>
        )}
        {r.warnings.map((w) => (
          <p key={w} className="mt-2 rounded bg-yellow-50 p-2 text-sm">{w}</p>
        ))}
      </section>

      <section className="rounded border border-gray-300 bg-white p-3 text-sm">
        <h3 className="font-bold">このアプリで計算できないケース</h3>
        <p className="mt-1">次にあてはまる人は、申告書の裏面の説明や国税庁の記載例を見ながら書くか、勤務先・税務署に確認してください。</p>
        <ul className="mt-1 list-disc pl-5">
          <li>住宅ローンを借り換えた</li>
          <li>増改築（リフォーム）のローンもある</li>
          <li>住宅ローンが2つ以上あり、種類（入居時期）が違う</li>
          <li>夫婦の連帯債務で、負担割合が分からない</li>
        </ul>
        <p className="mt-2">
          税務署から届いた申告書に、銀行の証明書を添付して勤務先に出します（証明書が不要な方式の人もいます）。
        </p>
      </section>
    </div>
  );
}
