import type { Calculation } from "@/lib/calc";
import type { ReadResult } from "@/lib/schema";

const yen = (n: number) => n.toLocaleString("ja-JP");

type Value = { v: React.ReactNode; warn?: boolean };

// PC では申告書と同じ横並びの表、スマホでは1件ずつのカードで表示する。
function Records({ cols, rows }: { cols: string[]; rows: Value[][] }) {
  const show = (x: Value) => x.v || <span className="text-gray-400">（空欄・自分で記入）</span>;
  return (
    <>
      <table className="hidden w-full border-collapse text-sm md:table">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} className="border border-gray-400 bg-gray-100 px-2 py-1 text-left text-xs font-normal">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, k) => (
            <tr key={k}>
              {r.map((x, j) => (
                <td key={j} className={`border border-gray-400 px-2 py-1 align-top ${x.warn ? "bg-yellow-100" : ""}`}>{show(x)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="space-y-3 md:hidden">
        {rows.map((r, k) => (
          <dl key={k} className="rounded border border-gray-400">
            <div className="bg-gray-100 px-2 py-1 text-xs font-bold">{k + 1}件目</div>
            {r.map((x, j) => (
              <div key={j} className={`grid grid-cols-[8.5rem_1fr] gap-2 border-t border-gray-200 px-2 py-1.5 ${x.warn ? "bg-yellow-100" : ""}`}>
                <dt className="text-xs text-gray-600">{cols[j]}</dt>
                <dd className="text-sm">{show(x)}</dd>
              </div>
            ))}
          </dl>
        ))}
      </div>
    </>
  );
}

function Total({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-dashed border-gray-300 py-1">
      <span className="text-sm">
        {label}
        {note && <span className="ml-1 text-xs text-gray-500">{note}</span>}
      </span>
      <span className="font-mono text-lg font-bold text-blue-700">{yen(value)} 円</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border-2 border-gray-700 bg-white p-3">
      <h3 className="mb-2 border-b-2 border-gray-700 pb-1 font-bold">{title}</h3>
      {children}
    </section>
  );
}

const low = (c: string) => c !== "高";

export function Guide({ data, calc }: { data: ReadResult; calc: Calculation }) {
  return (
    <div className="space-y-4">
      {calc.warnings.map((w) => (
        <p key={w} className="rounded border border-red-400 bg-red-50 p-2 text-sm text-red-800">{w}</p>
      ))}
      <p className="text-xs text-gray-600">
        黄色の欄は読み取りに自信がない箇所です。ハガキと見比べてから書いてください。続柄など空欄の箇所は、ご自身で記入してください。
      </p>

      {data.life.length > 0 && (
        <Section title="生命保険料控除">
          <Records
            cols={["保険会社等の名称", "保険等の種類", "保険期間又は年金支払期間", "保険等の契約者の氏名", "保険金等の受取人 氏名", "続柄", "新・旧の区分", "本年中に支払った保険料等の金額", "区分（目安）"]}
            rows={data.life.map((i) => {
              const w = low(i.confidence);
              return [
                { v: i.insurer, warn: w }, { v: i.policyType, warn: w }, { v: i.period, warn: w },
                { v: i.contractor, warn: w }, { v: i.beneficiary, warn: w }, { v: i.beneficiaryRelation },
                { v: i.system, warn: w },
                { v: <><span className="font-mono">{yen(i.amount)}</span>{i.amountBasis && <span className="ml-1 text-xs text-gray-500">{i.amountBasis}</span>}</>, warn: w },
                { v: i.category },
              ];
            })}
          />
          <p className="mt-1 text-xs text-gray-500">「区分（目安）」は申告書にはありません。どの合計欄に入るかの目安です。</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div>
              <h4 className="text-sm font-bold">一般の生命保険料</h4>
              <Total label="新保険料等の合計" value={calc.general.newTotal} />
              <Total label="旧保険料等の合計" value={calc.general.oldTotal} />
              <Total label="計算式Ⅰ（新）に当てはめた金額" value={calc.general.newDeduction} />
              <Total label="計算式Ⅱ（旧）に当てはめた金額" value={calc.general.oldDeduction} />
              <Total label="新＋旧" note="最高40,000円" value={calc.general.combined} />
              <Total label="いずれか大きい金額" value={calc.general.deduction} />
            </div>
            <div>
              <h4 className="text-sm font-bold">介護医療保険料</h4>
              <Total label="保険料等の合計" value={calc.care.total} />
              <Total label="計算式Ⅰに当てはめた金額" value={calc.care.deduction} />
            </div>
            <div>
              <h4 className="text-sm font-bold">個人年金保険料</h4>
              <Total label="新保険料等の合計" value={calc.pension.newTotal} />
              <Total label="旧保険料等の合計" value={calc.pension.oldTotal} />
              <Total label="計算式Ⅰ（新）に当てはめた金額" value={calc.pension.newDeduction} />
              <Total label="計算式Ⅱ（旧）に当てはめた金額" value={calc.pension.oldDeduction} />
              <Total label="新＋旧" note="最高40,000円" value={calc.pension.combined} />
              <Total label="いずれか大きい金額" value={calc.pension.deduction} />
            </div>
          </div>
          <div className="mt-3 rounded bg-blue-50 p-2">
            <Total label="生命保険料控除額" note="最高120,000円" value={calc.lifeDeduction} />
          </div>
        </Section>
      )}

      {data.earthquake.length > 0 && (
        <Section title="地震保険料控除">
          <Records
            cols={["保険会社等の名称", "保険等の種類（目的）", "保険期間", "保険等の契約者の氏名", "居住者等の氏名", "続柄", "地震保険料又は旧長期損害保険料区分", "控除対象金額"]}
            rows={data.earthquake.map((i) => {
              const w = low(i.confidence);
              return [
                { v: i.insurer, warn: w }, { v: i.policyType, warn: w }, { v: i.period, warn: w },
                { v: i.contractor, warn: w }, { v: i.resident }, { v: i.residentRelation },
                { v: i.category === "地震" ? "地震" : "旧長期", warn: w },
                { v: <span className="font-mono">{yen(i.amount)}</span>, warn: w },
              ];
            })}
          />
          <div className="mt-3">
            <Total label="地震保険料の金額の合計額" value={calc.earthquake.quakeTotal} />
            <Total label="旧長期損害保険料の金額の合計額" value={calc.earthquake.oldLongTotal} />
            <div className="rounded bg-blue-50 p-2">
              <Total label="地震保険料控除額" note="最高50,000円" value={calc.earthquake.deduction} />
            </div>
          </div>
        </Section>
      )}

      {data.social.length > 0 && (
        <Section title="社会保険料控除">
          <Records
            cols={["社会保険の種類", "保険料支払先の名称", "保険料を負担することになっている人 氏名", "続柄", "あなたが本年中に支払った保険料"]}
            rows={data.social.map((i) => {
              const w = low(i.confidence);
              return [
                { v: i.kind, warn: w }, { v: i.payee, warn: w }, { v: i.burdenPerson }, { v: i.burdenRelation },
                { v: <span className="font-mono">{yen(i.amount)}</span>, warn: w },
              ];
            })}
          />
          <div className="mt-3 rounded bg-blue-50 p-2">
            <Total label="社会保険料控除 合計" value={calc.social.deduction} />
          </div>
        </Section>
      )}

      {data.smallBiz.length > 0 && (
        <Section title="小規模企業共済等掛金控除">
          <Records
            cols={["種類", "あなたが本年中に支払った掛金"]}
            rows={data.smallBiz.map((i) => {
              const w = low(i.confidence);
              return [{ v: i.kind, warn: w }, { v: <span className="font-mono">{yen(i.amount)}</span>, warn: w }];
            })}
          />
          <div className="mt-3 rounded bg-blue-50 p-2">
            <Total label="小規模企業共済等掛金控除 合計" value={calc.smallBiz.deduction} />
          </div>
        </Section>
      )}

      {data.excluded.length > 0 && (
        <Section title="申告書に書かないもの">
          <ul className="list-disc pl-5 text-sm">
            {data.excluded.map((e, k) => (
              <li key={k}>{e.description}：{e.reason}</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
