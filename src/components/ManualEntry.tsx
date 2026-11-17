"use client";

import { useState } from "react";
import { House, Pension, PiggyBank, Shield } from "@/components/Illustrations";
import { InfoTip } from "@/components/InfoTip";
import type { DocId } from "@/lib/docs";
import { SMALL_BIZ_KINDS } from "@/lib/schema";

// 撮影の代わりに、ハガキ（控除証明書）の内容を手で入力する。
// 入力した1件ごとに、読み取り結果と同じ形（ReadResult の1項目）で onAdd に渡す。

const yen = (n: number) => n.toLocaleString("ja-JP");

type Kind = "life" | "earthquake" | "social" | "smallbiz";

function Pill<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} className={`rounded-full border px-3 py-2 text-sm ${value === v ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Amount({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-bold">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          inputMode="numeric"
          autoComplete="off"
          className="w-full rounded-xl border-2 border-gray-300 p-3 text-right font-mono text-lg"
          value={value ? yen(value) : ""}
          placeholder="ハガキに書いてある金額"
          onChange={(e) => onChange(Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
        />
        <span>円</span>
      </div>
    </label>
  );
}

function Text({ value, onChange, label, placeholder }: { value: string; onChange: (s: string) => void; label: string; placeholder?: string }) {
  return (
    <label className="block text-sm">
      <span className="font-bold">{label}</span>
      <input className="mt-1 w-full rounded-xl border-2 border-gray-300 p-3" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
    </label>
  );
}

const AMOUNT_TIP = "ハガキに「12月末までの見込額」「申告額」が書いてあれば、その金額を入れます。なければ書いてある証明額を入れてください。";

function LifeForm({ onAdd }: { onAdd: (item: Record<string, unknown>) => void }) {
  const [insurer, setInsurer] = useState("");
  const [category, setCategory] = useState<"一般" | "介護医療" | "個人年金">("一般");
  const [system, setSystem] = useState<"新" | "旧">("新");
  const [amount, setAmount] = useState(0);
  return (
    <div className="space-y-3">
      <Text label="保険会社の名前" value={insurer} onChange={setInsurer} placeholder="例：〇〇生命" />
      <div className="text-sm">
        <span className="font-bold">ハガキに書いてある区分</span>
        <InfoTip>ハガキに「一般生命保険料」「介護医療保険料」「個人年金保険料」のどれかが書いてあります。死亡保険・学資保険はふつう「一般」、医療保険・がん保険は「介護医療」です。</InfoTip>
        <div className="mt-1">
          <Pill value={category} onChange={setCategory} options={[["一般", "一般"], ["介護医療", "介護医療"], ["個人年金", "個人年金"]]} />
        </div>
      </div>
      <div className="text-sm">
        <span className="font-bold">新・旧</span>
        <InfoTip>ハガキに「新」「旧」（新制度・旧制度）と書いてあります。書いていなければ、契約日が2012年（平成24年）1月1日以後なら「新」、それより前なら「旧」です。</InfoTip>
        <div className="mt-1">
          <Pill value={system} onChange={setSystem} options={[["新", "新（2012年以後の契約）"], ["旧", "旧（それより前）"]]} />
        </div>
      </div>
      <Amount value={amount} onChange={setAmount} label={<>金額<InfoTip>{AMOUNT_TIP}</InfoTip></>} />
      <AddButton
        disabled={amount === 0}
        onClick={() => {
          // 旧制度には「介護医療」の区分がないので、旧の医療保険は「一般」として扱う
          const cat = category === "介護医療" && system === "旧" ? "一般" : category;
          onAdd({ life: [{ insurer, policyType: cat === "介護医療" ? "医療保険" : "", period: "", contractor: "", beneficiary: "", category: cat, system, amount, amountBasis: "手で入力", confidence: "高" }] });
          setInsurer("");
          setAmount(0);
          return `${insurer || "生命保険"}（${cat}・${system}）${yen(amount)}円`;
        }}
      />
    </div>
  );
}

function QuakeForm({ onAdd }: { onAdd: (item: Record<string, unknown>) => void }) {
  const [insurer, setInsurer] = useState("");
  const [category, setCategory] = useState<"地震" | "旧長期損害">("地震");
  const [amount, setAmount] = useState(0);
  return (
    <div className="space-y-3">
      <Text label="保険会社の名前" value={insurer} onChange={setInsurer} placeholder="例：〇〇損保" />
      <div className="text-sm">
        <span className="font-bold">区分</span>
        <InfoTip>ほとんどの人は「地震保険料」です。平成18年までに契約した長い期間の火災保険などで、ハガキに「旧長期損害保険料」と書いてある場合だけ、そちらを選びます。</InfoTip>
        <div className="mt-1">
          <Pill value={category} onChange={setCategory} options={[["地震", "地震保険料"], ["旧長期損害", "旧長期損害保険料"]]} />
        </div>
      </div>
      <Amount value={amount} onChange={setAmount} label={<>金額<InfoTip>火災保険の分は入れません。地震保険料（控除対象額）だけを入れてください。</InfoTip></>} />
      <AddButton
        disabled={amount === 0}
        onClick={() => {
          onAdd({ earthquake: [{ insurer, policyType: category === "地震" ? "地震保険" : "長期損害保険", period: "", contractor: "", category, amount, confidence: "高" }] });
          setInsurer("");
          setAmount(0);
          return `${insurer || "地震保険"} ${yen(amount)}円`;
        }}
      />
    </div>
  );
}

function SocialForm({ onAdd }: { onAdd: (item: Record<string, unknown>) => void }) {
  const [kind, setKind] = useState("国民年金保険料");
  const [payee, setPayee] = useState("");
  const [person, setPerson] = useState("");
  const [relation, setRelation] = useState("");
  const [amount, setAmount] = useState(0);
  return (
    <div className="space-y-3">
      <div className="text-sm">
        <span className="font-bold">種類</span>
        <div className="mt-1">
          <Pill
            value={kind}
            onChange={setKind}
            options={[
              ["国民年金保険料", "国民年金"],
              ["国民年金基金掛金", "国民年金基金"],
              ["国民健康保険料", "国民健康保険"],
              ["介護保険料", "介護保険"],
              ["後期高齢者医療保険料", "後期高齢者医療"],
            ]}
          />
        </div>
      </div>
      <Text label="支払先" value={payee} onChange={setPayee} placeholder={kind.startsWith("国民年金保険料") ? "例：日本年金機構" : "例：〇〇市"} />
      <Text label="保険料を払うことになっている人（だれの分か）" value={person} onChange={setPerson} placeholder="例：学生の子の名前" />
      <Text label="その人とあなたとの関係" value={relation} onChange={setRelation} placeholder="例：子、父" />
      <Amount value={amount} onChange={setAmount} label={<>あなたが今年払った金額<InfoTip>ハガキや領収書の、1年分（12月までの見込み）の金額です。</InfoTip></>} />
      <AddButton
        disabled={amount === 0}
        onClick={() => {
          onAdd({ social: [{ kind, payee, burdenPerson: person, burdenRelation: relation, amount, confidence: "高", note: "手で入力" }] });
          setAmount(0);
          return `${kind} ${yen(amount)}円`;
        }}
      />
    </div>
  );
}

function SmallBizForm({ onAdd }: { onAdd: (item: Record<string, unknown>) => void }) {
  const [kind, setKind] = useState<(typeof SMALL_BIZ_KINDS)[number]>(SMALL_BIZ_KINDS[2]);
  const [amount, setAmount] = useState(0);
  return (
    <div className="space-y-3">
      <div className="text-sm">
        <span className="font-bold">種類</span>
        <div className="mt-1">
          <Pill
            value={kind}
            onChange={setKind}
            options={[
              [SMALL_BIZ_KINDS[2], "iDeCo（個人型）"],
              [SMALL_BIZ_KINDS[1], "企業型DC（自分で上乗せ）"],
              [SMALL_BIZ_KINDS[0], "小規模企業共済"],
              [SMALL_BIZ_KINDS[3], "心身障害者扶養共済"],
            ]}
          />
        </div>
      </div>
      <Amount value={amount} onChange={setAmount} label="今年払った掛金（12月までの見込み）" />
      <AddButton
        disabled={amount === 0}
        onClick={() => {
          onAdd({ smallBiz: [{ kind, amount, confidence: "高" }] });
          setAmount(0);
          return `掛金 ${yen(amount)}円`;
        }}
      />
    </div>
  );
}

function AddButton({ disabled, onClick }: { disabled: boolean; onClick: () => string }) {
  const [msg, setMsg] = useState("");
  return (
    <div>
      <button disabled={disabled} onClick={() => setMsg(`「${onClick()}」を登録しました。続けて次のハガキを入力できます。`)} className="w-full rounded-full bg-blue-600 px-4 py-3 font-bold text-white disabled:bg-gray-300">
        追加する
      </button>
      {msg && <p className="mt-1 text-sm text-green-700">✓ {msg}</p>}
    </div>
  );
}

const KINDS: { kind: Kind; label: string; icon: React.ReactNode; docs: DocId[] }[] = [
  { kind: "life", label: "生命保険・医療保険", icon: <Shield className="h-8 w-8" />, docs: ["life"] },
  { kind: "earthquake", label: "地震保険", icon: <House quake className="h-8 w-8" />, docs: ["earthquake"] },
  { kind: "social", label: "国民年金・国民健康保険など", icon: <Pension className="h-8 w-8" />, docs: ["pension", "health"] },
  { kind: "smallbiz", label: "iDeCo・小規模企業共済", icon: <PiggyBank className="h-8 w-8" />, docs: ["smallbiz"] },
];

/**
 * ハガキを1枚ずつ手で入力する。種類を選んで入力し、「追加する」を押すと続けて次の1枚を入力できる。
 * @param selected アンケートで選んだ書類（最初に開く種類を決めるのに使う）
 */
export function ManualEntry({ selected, onAdd, onClose }: { selected: DocId[]; onAdd: (part: Record<string, unknown>) => void; onClose?: () => void }) {
  const first = KINDS.find((k) => k.docs.some((d) => selected.includes(d)))?.kind ?? "life";
  const [kind, setKind] = useState<Kind>(first);
  return (
    <div className="space-y-3 rounded-2xl border-2 border-blue-300 bg-white p-3">
      <div className="flex items-center justify-between">
        <p className="font-bold">どのハガキですか？</p>
        {onClose && (
          <button onClick={onClose} className="text-sm text-gray-600 underline">
            入力を閉じる
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {KINDS.map((k) => (
          <button
            key={k.kind}
            onClick={() => setKind(k.kind)}
            className={`flex items-center gap-2 rounded-xl border-2 p-2 text-left text-sm ${kind === k.kind ? "border-blue-600 bg-blue-50 font-bold" : "border-gray-200"}`}
          >
            {k.icon}
            {k.label}
          </button>
        ))}
      </div>
      {/* 種類を変えたら入力欄を作り直す */}
      <div key={kind}>
        {kind === "life" && <LifeForm onAdd={onAdd} />}
        {kind === "earthquake" && <QuakeForm onAdd={onAdd} />}
        {kind === "social" && <SocialForm onAdd={onAdd} />}
        {kind === "smallbiz" && <SmallBizForm onAdd={onAdd} />}
      </div>
      {selected.includes("housing") && (
        <p className="flex items-center gap-2 rounded-xl bg-gray-50 p-2 text-sm">
          <House className="h-8 w-8 shrink-0" />
          住宅ローンの金額は、最後の「④お手本」の画面で入力できます。
        </p>
      )}
    </div>
  );
}
