"use client";

import { useState } from "react";
import { Bag, Calendar, Family as FamilyIcon, Health, House, Office, Pension, PiggyBank, Question, Salary, Shield, Student } from "@/components/Illustrations";
import { InfoTip } from "@/components/InfoTip";
import type { Timing } from "@/components/ReviewStep";
import type { DocId } from "@/lib/docs";
import { newPerson, type Disability, type Family, type Person } from "@/lib/family";

// ① アンケート（1画面に1問）。選ぶだけの質問は、タップすると次の質問へ進む。
// 答えは画面の状態にだけ持つ（保存しない）。

const yen = (n: number) => n.toLocaleString("ja-JP");
const man = (n: number) => `${n / 10000}万円`;

// ---------------------------------------------------------------------------
// 部品

function BigChoice({ icon, label, sub, onClick, selected }: { icon?: React.ReactNode; label: string; sub?: string; onClick: () => void; selected?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${selected ? "border-blue-600 bg-blue-50" : "border-gray-200 bg-white active:bg-gray-50"}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>
        <span className="block text-base font-bold">{label}</span>
        {sub && <span className="block text-xs text-gray-600">{sub}</span>}
      </span>
    </button>
  );
}

/** 金額の入力。よく使う金額はボタンで選べる */
function MoneyInput({ value, onChange, chips, placeholder }: { value: number; onChange: (n: number) => void; chips: number[]; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={`rounded-full border px-3 py-2 text-sm ${value === c ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white"}`}
          >
            {c === 0 ? "0円（なし）" : man(c)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          inputMode="numeric"
          autoComplete="off"
          className="w-full rounded-xl border-2 border-gray-300 p-3 text-right font-mono text-lg"
          value={value ? yen(value) : ""}
          placeholder={placeholder ?? "金額を入力"}
          onChange={(e) => onChange(Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
        />
        <span>円</span>
      </div>
    </div>
  );
}

function Next({ onClick, disabled, label = "次へ" }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} className="w-full rounded-full bg-blue-600 px-4 py-4 text-lg font-bold text-white disabled:bg-gray-300">
      {label}
    </button>
  );
}

const RELATIONS = ["子", "父", "母", "祖父", "祖母", "配偶者の父", "配偶者の母", "孫", "兄弟姉妹", "その他"];

function DisabilityPick({ value, onChange }: { value: Disability; onChange: (d: Disability) => void }) {
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      {(["なし", "障害者", "特別障害者"] as const).map((d) => (
        <button key={d} onClick={() => onChange(d)} className={`rounded-full border px-3 py-1 ${value === d ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300"}`}>
          {d === "障害者" ? "障害者手帳あり" : d === "特別障害者" ? "重い障害（1・2級など）" : "なし"}
        </button>
      ))}
    </div>
  );
}

/** 家族1人分のカード */
function PersonCard({ p, onChange, onRemove, isSpouse }: { p: Person; onChange: (p: Person) => void; onRemove?: () => void; isSpouse?: boolean }) {
  const set = <K extends keyof Person>(k: K, v: Person[K]) => onChange({ ...p, [k]: v });
  return (
    <div className="space-y-3 rounded-2xl border-2 border-gray-200 bg-white p-3">
      {!isSpouse && (
        <div className="flex items-center justify-between">
          <select className="rounded-lg border border-gray-300 p-2 text-base font-bold" value={p.relation} onChange={(e) => set("relation", e.target.value)} aria-label="続柄">
            {RELATIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <input
            className="ml-2 w-28 rounded-lg border border-gray-300 p-2 text-sm"
            placeholder="呼び名（任意）"
            value={p.label}
            onChange={(e) => set("label", e.target.value)}
            autoComplete="off"
          />
          {onRemove && (
            <button onClick={onRemove} className="ml-2 text-sm text-red-600">
              削除
            </button>
          )}
        </div>
      )}
      <label className="block text-sm">
        <span className="font-bold">生年月日</span>
        <input type="date" className="mt-1 w-full rounded-xl border-2 border-gray-300 p-3 text-base" value={p.birth} onChange={(e) => set("birth", e.target.value)} />
      </label>
      <div className="text-sm">
        <span className="font-bold">今年の年収（給料の合計）</span>
        <InfoTip>
          税金などが引かれる前の、1年分の給料の合計です（ボーナス・パート代も含みます）。働いていなければ 0円 を選んでください。
          {isSpouse && " 共働きで年収が約207万円より多い場合は、配偶者についての控除はありません。その場合も、だいたいの年収を入れてください。"}
        </InfoTip>
        <div className="mt-1">
          <MoneyInput
            value={p.salary}
            onChange={(v) => set("salary", v)}
            chips={isSpouse ? [0, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000] : [0, 500_000, 1_000_000, 1_300_000, 1_500_000, 2_000_000]}
          />
        </div>
        {isSpouse && <p className="mt-1 text-xs text-gray-600">共働きの方も入れてください。金額は上の欄に直接入力もできます。</p>}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-5 w-5" checked={p.livingTogether} onChange={(e) => set("livingTogether", e.target.checked)} />
        一緒に住んでいる
      </label>
      <details className="text-sm">
        <summary className="cursor-pointer text-gray-600">あてはまる人だけ：年金などの収入・障害</summary>
        <div className="mt-2 space-y-3">
          <div>
            <span>給料以外の1年分のもうけ（年金・事業など）</span>
            <InfoTip>収入から経費などを引いた金額です。公的年金は、65歳以上なら年金額から110万円、65歳未満なら60万円を引いたくらいが目安です。</InfoTip>
            <MoneyInput value={p.otherIncome} onChange={(v) => set("otherIncome", v)} chips={[0]} />
          </div>
          <div>
            <span>障害</span>
            <DisabilityPick value={p.disability} onChange={(v) => set("disability", v)} />
          </div>
        </div>
      </details>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 質問

const DOC_CARDS: { id: DocId; label: string; sub: string; icon: React.ReactNode }[] = [
  { id: "life", label: "生命保険・医療保険", sub: "学資保険・がん保険・個人年金・共済も", icon: <Shield className="h-12 w-12" /> },
  { id: "earthquake", label: "地震保険", sub: "火災保険とセットのことが多い", icon: <House quake className="h-12 w-12" /> },
  { id: "pension", label: "家族の国民年金を払った", sub: "学生の子・会社を辞めた配偶者の分など", icon: <Pension className="h-12 w-12" /> },
  { id: "health", label: "家族の国民健康保険を払った", sub: "介護保険・後期高齢者医療も", icon: <Health className="h-12 w-12" /> },
  { id: "smallbiz", label: "iDeCo（イデコ）", sub: "小規模企業共済も", icon: <PiggyBank className="h-12 w-12" /> },
  { id: "housing", label: "住宅ローン（2年目以降）", sub: "家を買って2年目から", icon: <House className="h-12 w-12" /> },
  { id: "housingFirst", label: "住宅ローン（今年住み始めた）", sub: "1年目は確定申告が必要", icon: <House className="h-12 w-12" /> },
  { id: "previousJob", label: "今年、転職した", sub: "前の会社の源泉徴収票が必要", icon: <Bag className="h-12 w-12" /> },
];

const DOC_INFO: Partial<Record<DocId, string>> = {
  pension: "会社員の給料から引かれる厚生年金は関係ありません。あなたが家族の分の国民年金を払った場合だけ選んでください。",
  health: "給料から引かれる健康保険は関係ありません。親などの国民健康保険料をあなたが払った場合だけ選んでください。",
  smallbiz: "個人で入る年金づくりの制度です。会社の給料から天引きの場合は、会社がすでに知っていることがあります。",
};

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
  const [q, setQ] = useState(0);
  const [hasOther, setHasOther] = useState<boolean | null>(family.self.otherIncome > 0 ? true : null);
  const [married, setMarried] = useState<boolean | null>(family.spouse ? true : null);
  const [hasFamily, setHasFamily] = useState<boolean | null>(family.dependents.length > 0 ? true : null);
  const TOTAL = 7;
  const next = () => {
    setQ((x) => x + 1);
    window.scrollTo({ top: 0 });
  };
  const toggleDoc = (id: DocId, on: boolean) => () => {
    onNoneSelected(false);
    onSelected(on ? selected.filter((x) => x !== id) : [...selected, id]);
  };
  const setSelf = <K extends keyof Family["self"]>(k: K, v: Family["self"][K]) => onFamily({ ...family, self: { ...family.self, [k]: v } });

  const header = (title: string, icon: React.ReactNode, info?: React.ReactNode) => (
    <div className="space-y-2 text-center">
      <div className="flex justify-center">{icon}</div>
      <h2 className="text-xl font-bold leading-snug">
        {title}
        {info && <InfoTip>{info}</InfoTip>}
      </h2>
    </div>
  );

  let body: React.ReactNode;
  switch (q) {
    case 0:
      body = (
        <>
          {header("会社の年末調整は、いつありますか？", <Calendar className="h-20 w-20" />, "会社から書類を出すように言われた時期で考えてください。多くの会社は12月です。11月中の会社では、扶養の基準が少し変わります。")}
          <div className="space-y-2">
            {(
              [
                ["12月", "ふつうはこちら"],
                ["11月以前", "11月中に年末調整をする会社"],
                ["分からない", "12月として進めます"],
              ] as const
            ).map(([t, sub]) => (
              <BigChoice key={t} label={t} sub={sub} selected={timing === t} onClick={() => (onTiming(t), next())} />
            ))}
          </div>
        </>
      );
      break;
    case 1:
      body = (
        <>
          {header(
            "今年のお給料は、だいたいいくら？",
            <Salary className="h-20 w-20" />,
            "ボーナスも含めた1年分の合計で、税金や保険料が引かれる前の金額です。去年の源泉徴収票の「支払金額」や、給与明細の「総支給額」が参考になります。だいたいでかまいません。",
          )}
          <MoneyInput
            value={family.self.salary}
            onChange={(v) => setSelf("salary", v)}
            chips={[3_000_000, 4_000_000, 5_000_000, 6_000_000, 7_000_000, 8_000_000]}
          />
          <Next onClick={next} disabled={family.self.salary === 0} />
        </>
      );
      break;
    case 2:
      body = (
        <>
          {header("お給料のほかに、収入はありますか？", <PiggyBank className="h-20 w-20" />, "副業・家賃収入・年金などです。少額の副業でも、もうけ（収入−経費）があれば「ある」を選んでください。")}
          <div className="space-y-2">
            <BigChoice
              label="ない"
              selected={hasOther === false}
              onClick={() => {
                setHasOther(false);
                setSelf("otherIncome", 0);
                next();
              }}
            />
            <BigChoice label="ある" selected={hasOther === true} onClick={() => setHasOther(true)} />
          </div>
          {hasOther && (
            <div className="space-y-2">
              <p className="text-sm font-bold">1年分のもうけ（収入から経費を引いた金額）</p>
              <MoneyInput value={family.self.otherIncome} onChange={(v) => setSelf("otherIncome", v)} chips={[100_000, 200_000, 500_000]} />
              <Next onClick={next} />
            </div>
          )}
        </>
      );
      break;
    case 3:
      body = (
        <>
          {header("結婚していますか？", <FamilyIcon className="h-20 w-20" />)}
          <div className="space-y-2">
            <BigChoice
              label="していない"
              selected={married === false}
              onClick={() => {
                setMarried(false);
                onFamily({ ...family, spouse: null });
                next();
              }}
            />
            <BigChoice
              label="している"
              selected={married === true}
              onClick={() => {
                setMarried(true);
                if (!family.spouse) onFamily({ ...family, spouse: newPerson("配偶者") });
              }}
            />
          </div>
          {married && family.spouse && (
            <div className="space-y-3">
              <p className="text-center text-sm font-bold">夫・妻について教えてください</p>
              <PersonCard p={family.spouse} isSpouse onChange={(p) => onFamily({ ...family, spouse: p })} />
              <Next onClick={next} disabled={!family.spouse.birth} label={family.spouse.birth ? "次へ" : "生年月日を入れてください"} />
            </div>
          )}
        </>
      );
      break;
    case 4:
      body = (
        <>
          {header(
            "生活費を出している家族はいますか？",
            <Student className="h-20 w-20" />,
            "一緒に住んでいる子どもや親、仕送りをしている学生の子などです。夫・妻はここには入れません。",
          )}
          <div className="space-y-2">
            <BigChoice
              label="いない"
              selected={hasFamily === false}
              onClick={() => {
                setHasFamily(false);
                onFamily({ ...family, dependents: [] });
                next();
              }}
            />
            <BigChoice
              label="いる"
              sub="子ども・親など"
              selected={hasFamily === true}
              onClick={() => {
                setHasFamily(true);
                if (family.dependents.length === 0) onFamily({ ...family, dependents: [newPerson("子")] });
              }}
            />
          </div>
          {hasFamily && (
            <div className="space-y-3">
              {family.dependents.map((d, i) => (
                <PersonCard
                  key={i}
                  p={d}
                  onChange={(p) => onFamily({ ...family, dependents: family.dependents.map((x, j) => (j === i ? p : x)) })}
                  onRemove={() => onFamily({ ...family, dependents: family.dependents.filter((_, j) => j !== i) })}
                />
              ))}
              <button
                onClick={() => onFamily({ ...family, dependents: [...family.dependents, newPerson("子")] })}
                className="w-full rounded-2xl border-2 border-dashed border-blue-400 p-3 text-blue-700"
              >
                ＋ もう1人追加する
              </button>
              <Next
                onClick={next}
                disabled={family.dependents.length === 0 || family.dependents.some((d) => !d.birth)}
                label={family.dependents.some((d) => !d.birth) ? "全員の生年月日を入れてください" : "次へ"}
              />
            </div>
          )}
        </>
      );
      break;
    case 5:
      body = (
        <>
          {header("あてはまるものを、全部タップ", <Shield className="h-20 w-20" />, "選んだものに合わせて、登録するハガキをお知らせします。分からないものは選ばなくて大丈夫です。届いたハガキを撮れば、自動で見分けます。")}
          <div className="grid grid-cols-2 gap-2">
            {DOC_CARDS.map((c) => {
              const on = selected.includes(c.id);
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={toggleDoc(c.id, on)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggleDoc(c.id, on)())}
                  aria-pressed={on}
                  className={`relative flex cursor-pointer flex-col items-center rounded-2xl border-2 p-2 text-center ${on ? "border-blue-600 bg-blue-50" : "border-gray-200 bg-white"}`}
                >
                  {on && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-sm text-white">✓</span>}
                  {c.icon}
                  <span className="text-sm font-bold leading-tight">{c.label}</span>
                  <span className="mt-0.5 text-[11px] leading-tight text-gray-600">{c.sub}</span>
                  {DOC_INFO[c.id] && (
                    <span onClick={(e) => e.stopPropagation()}>
                      <InfoTip>{DOC_INFO[c.id]}</InfoTip>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <BigChoice
            icon={<Question className="h-10 w-10" />}
            label="どれもあてはまらない"
            selected={noneSelected}
            onClick={() => {
              onNoneSelected(true);
              onSelected([]);
            }}
          />
          <Next onClick={next} disabled={selected.length === 0 && !noneSelected} label={selected.length === 0 && !noneSelected ? "1つ以上選んでください" : "次へ"} />
        </>
      );
      break;
    default:
      body = (
        <>
          {header("最後に、あなた自身にあてはまるものは？", <Office className="h-20 w-20" />, "あてはまるものがなければ、そのまま「次へ」を押してください。")}
          <div className="space-y-3 rounded-2xl bg-white p-3 text-sm">
            <div>
              <p className="font-bold">障害</p>
              <DisabilityPick value={family.self.disability} onChange={(v) => setSelf("disability", v)} />
            </div>
            <div>
              <p className="font-bold">
                ひとり親・寡婦
                <InfoTip>
                  ひとり親：結婚しておらず（離婚・死別など）、生計が同じ子どもがいる人。寡婦：夫と離婚・死別して再婚していない女性で、条件にあてはまる人。どちらも本人の所得が500万円以下の場合です。
                </InfoTip>
              </p>
              <div className="flex flex-wrap gap-2">
                {(["なし", "ひとり親", "寡婦"] as const).map((w) => (
                  <button
                    key={w}
                    onClick={() => setSelf("widow", w)}
                    className={`rounded-full border px-3 py-1 ${family.self.widow === w ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300"}`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-5 w-5" checked={family.self.workingStudent} onChange={(e) => setSelf("workingStudent", e.target.checked)} />
              働きながら学校に通っている（勤労学生）
              <InfoTip>大学・専門学校などに通いながら働いている人で、所得が89万円以下（給料だけなら年収163万円以下）の場合です。</InfoTip>
            </label>
          </div>
          <Next onClick={onNext} label="質問はおしまい。ハガキの登録へ" />
        </>
      );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <button onClick={() => (q > 0 ? setQ(q - 1) : undefined)} disabled={q === 0} className="rounded-full px-2 py-1 disabled:invisible">
            ← 前の質問
          </button>
          <span>
            質問 {Math.min(q + 1, TOTAL)} / {TOTAL}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-200">
          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${(Math.min(q + 1, TOTAL) / TOTAL) * 100}%` }} />
        </div>
      </div>
      {body}
    </div>
  );
}
