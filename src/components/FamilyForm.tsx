"use client";

import { newPerson, type Disability, type Family, type Person } from "@/lib/family";

// 本人・配偶者・家族の情報の入力欄。入力内容は画面の状態にだけ持つ（保存しない）。

const RELATIONS = ["子", "父", "母", "祖父", "祖母", "配偶者の父", "配偶者の母", "孫", "兄弟姉妹", "その他"];

function Yen({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="text-gray-700">{label}</span>
      <div className="mt-1 flex items-center gap-1">
        <input
          inputMode="numeric"
          autoComplete="off"
          className="w-full rounded border border-gray-400 p-2 text-right font-mono"
          value={value ? value.toLocaleString("ja-JP") : ""}
          placeholder="0"
          onChange={(e) => onChange(Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
        />
        <span>円</span>
      </div>
      {hint && <span className="text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

function DisabilitySelect({ value, onChange }: { value: Disability; onChange: (v: Disability) => void }) {
  return (
    <label className="block text-sm">
      <span className="text-gray-700">障害</span>
      <select className="mt-1 w-full rounded border border-gray-400 p-2" value={value} onChange={(e) => onChange(e.target.value as Disability)}>
        <option>なし</option>
        <option>障害者</option>
        <option>特別障害者</option>
      </select>
    </label>
  );
}

function PersonFields({ p, onChange, isSpouse }: { p: Person; onChange: (p: Person) => void; isSpouse?: boolean }) {
  const set = <K extends keyof Person>(k: K, v: Person[K]) => onChange({ ...p, [k]: v });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {!isSpouse && (
        <>
          <label className="block text-sm">
            <span className="text-gray-700">呼び名（例：長男。氏名は不要）</span>
            <input className="mt-1 w-full rounded border border-gray-400 p-2" value={p.label} onChange={(e) => set("label", e.target.value)} autoComplete="off" />
          </label>
          <label className="block text-sm">
            <span className="text-gray-700">続柄</span>
            <select className="mt-1 w-full rounded border border-gray-400 p-2" value={p.relation} onChange={(e) => set("relation", e.target.value)}>
              {RELATIONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
        </>
      )}
      <label className="block text-sm">
        <span className="text-gray-700">生年月日</span>
        <input type="date" className="mt-1 w-full rounded border border-gray-400 p-2" value={p.birth} onChange={(e) => set("birth", e.target.value)} />
      </label>
      <Yen label="1年間の給与の収入（見込み）" value={p.salary} onChange={(v) => set("salary", v)} hint="パート・アルバイト代を含む。なければ 0" />
      <Yen label="給与以外の所得（年金・事業など）" value={p.otherIncome} onChange={(v) => set("otherIncome", v)} hint="収入から経費などを引いた後の金額。なければ 0" />
      <DisabilitySelect value={p.disability} onChange={(v) => set("disability", v)} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-5 w-5" checked={p.livingTogether} onChange={(e) => set("livingTogether", e.target.checked)} />
        同居している
      </label>
    </div>
  );
}

export function FamilyForm({ value, onChange }: { value: Family; onChange: (f: Family) => void }) {
  const self = value.self;
  const setSelf = <K extends keyof Family["self"]>(k: K, v: Family["self"][K]) => onChange({ ...value, self: { ...self, [k]: v } });
  const setDep = (i: number, p: Person) => onChange({ ...value, dependents: value.dependents.map((d, j) => (j === i ? p : d)) });

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-600">
        入力した内容は、この画面を閉じると消えます。どこにも送信・保存しません。氏名やマイナンバーは入力不要です。
      </p>

      <section className="space-y-3 rounded border border-gray-300 bg-white p-3">
        <h3 className="font-bold">あなた</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Yen label="今年の給与の収入（見込み）" value={self.salary} onChange={(v) => setSelf("salary", v)} hint="勤務先から受け取る給与・賞与の1年分（税金などを引く前）" />
          <Yen label="給与以外の所得" value={self.otherIncome} onChange={(v) => setSelf("otherIncome", v)} hint="副業・年金など。なければ 0" />
          <DisabilitySelect value={self.disability} onChange={(v) => setSelf("disability", v)} />
          <label className="block text-sm">
            <span className="text-gray-700">寡婦・ひとり親</span>
            <select className="mt-1 w-full rounded border border-gray-400 p-2" value={self.widow} onChange={(e) => setSelf("widow", e.target.value as Family["self"]["widow"])}>
              <option>なし</option>
              <option>寡婦</option>
              <option>ひとり親</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={self.workingStudent} onChange={(e) => setSelf("workingStudent", e.target.checked)} />
            勤労学生である
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded border border-gray-300 bg-white p-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">配偶者</h3>
          {value.spouse ? (
            <button className="text-sm text-red-700" onClick={() => onChange({ ...value, spouse: null })}>
              削除
            </button>
          ) : (
            <button className="rounded border border-blue-600 px-3 py-1 text-sm text-blue-700" onClick={() => onChange({ ...value, spouse: newPerson("配偶者") })}>
              配偶者を追加
            </button>
          )}
        </div>
        {value.spouse && <PersonFields p={value.spouse} isSpouse onChange={(p) => onChange({ ...value, spouse: p })} />}
      </section>

      <section className="space-y-3 rounded border border-gray-300 bg-white p-3">
        <h3 className="font-bold">生計を一にする家族（子・親など）</h3>
        <p className="text-xs text-gray-600">一緒に暮らしている、または仕送りなどで生活費を出している家族を入力します。配偶者はここに入れません。</p>
        {value.dependents.map((d, i) => (
          <div key={i} className="space-y-2 rounded border border-gray-200 p-2">
            <div className="flex items-center justify-between text-sm font-bold">
              <span>{d.label || `家族${i + 1}`}</span>
              <button className="font-normal text-red-700" onClick={() => onChange({ ...value, dependents: value.dependents.filter((_, j) => j !== i) })}>
                削除
              </button>
            </div>
            <PersonFields p={d} onChange={(p) => setDep(i, p)} />
          </div>
        ))}
        <button className="rounded border border-blue-600 px-3 py-1 text-sm text-blue-700" onClick={() => onChange({ ...value, dependents: [...value.dependents, newPerson()] })}>
          家族を追加
        </button>
      </section>
    </div>
  );
}
