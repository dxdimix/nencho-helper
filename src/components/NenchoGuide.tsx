"use client";

import { InfoTip } from "@/components/InfoTip";
import { Book, Calendar, Camera, Checklist, Family, FormPen, House, Office, PiggyBank, Postcard, Refund, Salary, Shield, Student } from "@/components/Illustrations";
import { lifeNewFormula, lifeNewFormulaUnder23 } from "@/lib/calc";
import { estimateSaving } from "@/lib/estimate";
import { emptySelf, newPerson, type Family as FamilyT } from "@/lib/family";

// 「ねんちょーガイド」：はじめての人向けに、年末調整のしくみ・いいこと・戻る金額の目安・今年の変更点を、
// 図を中心にさらっと読める形で説明する。

const yen = (n: number) => n.toLocaleString("ja-JP");
const roundTo = (n: number, unit: number) => Math.round(n / unit) * unit;

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="shrink-0">{icon}</div>
        <h2 className="text-lg font-bold leading-snug">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/** 申告しない場合と、した場合の税金を、横棒で比べる */
function Bars({ before, after }: { before: number; after: number }) {
  const max = Math.max(before, 1);
  return (
    <div className="space-y-1 text-xs">
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-gray-600">申告しない</span>
        <div className="h-4 rounded bg-gray-300" style={{ width: `${(before / max) * 100}%` }} />
        <span className="shrink-0 font-mono">{yen(before)}円</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-gray-600">申告する</span>
        <div className="h-4 rounded bg-blue-400" style={{ width: `${Math.max(after / max, 0.01) * 100}%` }} />
        <span className="shrink-0 font-mono">{yen(after)}円</span>
      </div>
    </div>
  );
}

// 代表例（計算はアプリと同じ関数で行う）
const EX = (() => {
  const single: FamilyT = { self: { ...emptySelf(), salary: 4_000_000 }, spouse: null, dependents: [] };
  const withKids: FamilyT = {
    self: { ...emptySelf(), salary: 5_000_000 },
    spouse: { ...newPerson("配偶者"), birth: "1988-04-01", salary: 1_000_000 },
    dependents: [{ ...newPerson(), birth: "2010-06-01" }], // 高校生
  };
  const home: FamilyT = { self: { ...emptySelf(), salary: 6_000_000 }, spouse: null, dependents: [] };
  return [
    {
      who: "独身・年収400万円",
      what: "生命保険に入っている（年に8万4千円）",
      icon: <Shield className="h-12 w-12" />,
      e: estimateSaving(single, lifeNewFormula(84_000)),
    },
    {
      who: "夫婦と高校生の子・年収500万円",
      what: "生命保険（年10万円）と地震保険（年2万円）",
      icon: <Family className="h-12 w-12" />,
      e: estimateSaving(withKids, lifeNewFormulaUnder23(100_000) + 20_000),
    },
    {
      who: "年収600万円・住宅ローン2年目",
      what: "年末のローン残高が2,500万円",
      icon: <House className="h-12 w-12" />,
      e: estimateSaving(home, 0, roundTo(25_000_000 * 0.007, 100)),
    },
  ];
})();

export function NenchoGuide({
  onClose,
  onStart,
  mine,
}: {
  onClose: () => void;
  onStart: () => void;
  /** アンケートや読み取りが済んでいれば、その人の目安 */
  mine?: { saving: number; before: number; after: number; note: string } | null;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm">
          ← もどる
        </button>
        <span className="flex items-center gap-1 text-sm font-bold text-green-700">
          <Book className="h-6 w-6" /> ねんちょーガイド
        </span>
      </div>

      <div className="rounded-2xl bg-gradient-to-b from-green-50 to-white p-4 text-center">
        <p className="text-xl font-bold">はじめての年末調整</p>
        <p className="mt-1 text-sm text-gray-700">3分でわかる、しくみと今年のポイント</p>
      </div>

      <Section title="年末調整ってなに？" icon={<Office className="h-12 w-12" />}>
        <div className="flex items-center justify-around rounded-xl bg-gray-50 p-2 text-center text-xs">
          <div>
            <Salary className="mx-auto h-12 w-12" />
            毎月の給料から
            <br />
            税金が<b>仮に</b>引かれる
          </div>
          <span className="text-2xl text-gray-400">→</span>
          <div>
            <Calendar className="mx-auto h-12 w-12" />
            12月に会社が
            <br />
            1年分を<b>計算し直す</b>
          </div>
          <span className="text-2xl text-gray-400">→</span>
          <div>
            <Refund className="mx-auto h-12 w-12" />
            払いすぎた分が
            <br />
            <b>戻ってくる</b>
          </div>
        </div>
        <p className="text-sm">
          毎月の税金は、だいたいの金額で引かれています。12月に、保険料や家族のことを反映して正しい金額に直すのが年末調整です。
          <InfoTip>足りなかった場合は、12月の給料から追加で引かれることもあります。会社員の多くは、年末調整をすれば確定申告をしなくて済みます。</InfoTip>
        </p>
      </Section>

      <Section title="申告すると、どんないいことがある？" icon={<Refund className="h-12 w-12" />}>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-3">
            <Postcard className="h-10 w-10 shrink-0" />
            <span>
              <b>保険料</b>を払っている人は、その分税金が安くなります
            </span>
          </li>
          <li className="flex items-center gap-3">
            <Family className="h-10 w-10 shrink-0" />
            <span>
              <b>家族</b>を養っている人も、税金が安くなります
            </span>
          </li>
          <li className="flex items-center gap-3">
            <House className="h-10 w-10 shrink-0" />
            <span>
              <b>住宅ローン</b>がある人は、2年目から大きく戻ります
            </span>
          </li>
        </ul>
        <p className="rounded-lg bg-yellow-50 p-2 text-sm">
          戻ったお金は、<b>12月か1月の給料と一緒に</b>振り込まれるのがふつうです。
        </p>
      </Section>

      <Section title="いくらくらい戻るの？" icon={<PiggyBank className="h-12 w-12" />}>
        <p className="text-sm">
          所得税が安くなる金額の目安です。
          <InfoTip>
            会社の社会保険料を給料の約14.7%として計算した、おおまかな目安です。所得税（復興特別所得税を含む）だけの金額で、住民税も翌年少し安くなります。実際の金額は勤務先の計算で決まります。
          </InfoTip>
        </p>
        <div className="space-y-3">
          {EX.map((x) => (
            <div key={x.who} className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-center gap-3">
                {x.icon}
                <div className="text-sm">
                  <p className="font-bold">{x.who}</p>
                  <p className="text-gray-600">{x.what}</p>
                </div>
              </div>
              <p className="my-2 text-center text-lg">
                約 <b className="text-2xl text-blue-700">{yen(roundTo(x.e.saving, 100))}</b> 円 戻る
              </p>
              <Bars before={x.e.before} after={x.e.after} />
            </div>
          ))}
        </div>
        {mine ? (
          <div className="rounded-xl border-2 border-blue-400 bg-blue-50 p-3">
            <p className="font-bold">あなたの場合の目安</p>
            <p className="my-2 text-center text-lg">
              約 <b className="text-2xl text-blue-700">{yen(roundTo(mine.saving, 100))}</b> 円
            </p>
            <Bars before={mine.before} after={mine.after} />
            <p className="mt-1 text-xs text-gray-600">{mine.note}</p>
          </div>
        ) : (
          <p className="rounded-lg bg-gray-50 p-2 text-xs text-gray-700">アンケートに答えて書類を撮影すると、ここに「あなたの場合の目安」が出ます。</p>
        )}
      </Section>

      <Section title="今年（令和8年）は、ここが変わりました" icon={<Calendar className="h-12 w-12" />}>
        <p className="rounded-lg bg-green-50 p-2 text-sm">
          今年は、<b>いつもより多く戻る人が多い</b>年です。
          <InfoTip>
            税金が安くなる改正がありましたが、11月までの毎月の給料は前の基準のまま税金が引かれています。12月の年末調整で新しい基準で計算し直すので、その差が戻ってきます。
          </InfoTip>
        </p>
        <div className="space-y-3">
          <Change
            icon={<Student className="h-12 w-12" />}
            title="子どもなどを扶養に入れられる年収が上がった"
            before="123万円まで"
            after="136万円まで"
            note="アルバイトをしている子どもや親も、年収136万円までなら扶養に入れられます（給料だけの場合）。"
          />
          <Change
            icon={<Student className="h-12 w-12" />}
            title="大学生くらいの子（19〜22歳）は、年収197万円までOK"
            before="188万円まで"
            after="197万円まで"
            note="136万円を超えても、197万円までは、稼ぎに応じて少しずつ控除が受けられます（特定親族特別控除）。"
          />
          <Change
            icon={<Shield className="h-12 w-12" />}
            title="23歳未満の子どもがいる人は、生命保険の控除が増えた"
            before="最大4万円"
            after="最大6万円"
            note="新しい契約（平成24年以後）の一般の生命保険が対象です。このアプリが自動で判定します。"
          />
          <Change
            icon={<Family className="h-12 w-12" />}
            title="配偶者控除を受けられる、配偶者の年収が上がった"
            before="123万円まで"
            after="136万円まで"
            note="136万円を超えても、207万円までは配偶者特別控除が受けられます。"
          />
          <Change
            icon={<Refund className="h-12 w-12" />}
            title="みんなが受けられる基礎控除が増えた"
            before="58万〜95万円"
            after="最大104万円"
            note="年収がおよそ665万円以下の人は104万円になります。何も申告しなくても自動で反映されます。"
          />
        </div>
      </Section>

      <Section title="やることは、3つだけ" icon={<Checklist className="h-12 w-12" />}>
        <ol className="grid grid-cols-3 gap-2 text-center text-xs">
          <li className="rounded-xl bg-gray-50 p-2">
            <Checklist className="mx-auto h-10 w-10" />
            <b>1. 質問に答える</b>
            <br />
            タップで選ぶだけ
          </li>
          <li className="rounded-xl bg-gray-50 p-2">
            <Camera className="mx-auto h-10 w-10" />
            <b>2. ハガキを撮る</b>
            <br />
            自動で読み取り
          </li>
          <li className="rounded-xl bg-gray-50 p-2">
            <FormPen className="mx-auto h-10 w-10" />
            <b>3. お手本を見て書く</b>
            <br />
            書き写すだけ
          </li>
        </ol>
        <button onClick={onStart} className="w-full rounded-full bg-blue-600 px-4 py-4 text-lg font-bold text-white">
          さっそく始める
        </button>
      </Section>

      <Section title="よくある質問" icon={<Book className="h-12 w-12" />}>
        <dl className="space-y-3 text-sm">
          {[
            ["ハガキをなくしてしまった", "保険会社に連絡すれば、再発行してもらえます。ネットで手続きできる会社も多いです。"],
            ["出さないとどうなる？", "控除が受けられず、税金が多いままになります。あとから自分で確定申告をすれば取り戻せます。"],
            ["医療費やふるさと納税は？", "年末調整ではできません。来年の2月〜3月に確定申告をします（ふるさと納税はワンストップ特例でも可）。"],
            ["マイナンバーは書くの？", "会社によっては書かなくてよい場合があります。会社の案内に従ってください。"],
          ].map(([q, a]) => (
            <div key={q} className="rounded-lg bg-gray-50 p-2">
              <dt className="font-bold">Q. {q}</dt>
              <dd className="mt-1 text-gray-700">{a}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <p className="text-center text-[10px] text-gray-500">令和8年分の国税庁「年末調整のしかた」などをもとに作成しています。</p>
    </div>
  );
}

function Change({ icon, title, before, after, note }: { icon: React.ReactNode; title: string; before: string; after: string; note: string }) {
  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <div className="flex items-center gap-3">
        {icon}
        <p className="text-sm font-bold">{title}</p>
      </div>
      <div className="my-2 flex items-center justify-center gap-2 text-sm">
        <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-500 line-through">{before}</span>
        <span className="text-xl text-green-600">→</span>
        <span className="rounded-full bg-green-100 px-3 py-1 font-bold text-green-800">{after}</span>
      </div>
      <p className="text-xs text-gray-600">{note}</p>
    </div>
  );
}
