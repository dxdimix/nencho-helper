import { basicForm, dependentsForm, type DependentStatus, type Family } from "@/lib/family";

// 基礎控除申告書（令和8年分）と扶養控除等申告書（令和9年分）の記入お手本。

const yen = (n: number) => n.toLocaleString("ja-JP");
const man = (n: number) => `${(n / 10000).toLocaleString("ja-JP")}万円`;

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-gray-300 py-1">
      <span className="text-sm">{label}</span>
      <span className={`text-right font-mono ${strong ? "text-lg font-bold text-blue-700" : ""}`}>{value}</span>
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border-2 border-gray-700 bg-white p-3">
      <h3 className="mb-2 border-b-2 border-gray-700 pb-1 font-bold">{title}</h3>
      {children}
    </section>
  );
}

const Note = ({ children }: { children: React.ReactNode }) => <p className="mt-2 text-xs text-gray-600">{children}</p>;

function name(s: DependentStatus) {
  return s.person.label || s.person.relation;
}

export function BasicGuide({ family }: { family: Family }) {
  const r = basicForm(family);
  const b = r.basic;
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-600">令和8年分「給与所得者の基礎控除申告書 兼 配偶者控除等申告書 兼 特定親族特別控除申告書 兼 所得金額調整控除申告書」の記入例です。</p>

      <Box title="基礎控除申告書">
        <h4 className="text-sm font-bold">あなたの本年中の合計所得金額の見積額の計算</h4>
        <Row label="⑴ 給与所得　収入金額" value={`${yen(family.self.salary)} 円`} />
        <Row label="⑴ 給与所得　所得金額" value={`${yen(b.salaryIncome)} 円`} />
        <Row label="⑵ 給与所得以外の所得の合計額" value={`${yen(b.otherIncome)} 円`} />
        <Row label="あなたの本年中の合計所得金額の見積額（⑴と⑵の合計額）" value={`${yen(b.total)} 円`} strong />
        <h4 className="mt-3 text-sm font-bold">控除額の計算</h4>
        <Row label="「判定」欄でチェックを付ける行" value={b.judgeRow} />
        <Row label="区分Ⅰ" value={b.kubun1 ? `（${b.kubun1}）` : "記入しない（配偶者控除等は受けられません）"} />
        <Row label="基礎控除の額" value={`${yen(b.amount)} 円`} strong />
        {b.adjustment > 0 && <Note>所得金額調整控除（{yen(b.adjustment)} 円）を差し引いた後の給与所得で計算しています。</Note>}
        {(!family.spouse || !r.spouse?.kind) && <Note>配偶者控除・配偶者特別控除を受けない場合（配偶者がいない場合を含む）、区分Ⅰ欄は書かなくてかまいません。</Note>}
        {family.self.salary > 20_000_000 && (
          <p className="mt-2 rounded bg-yellow-50 p-2 text-sm">給与の収入が2,000万円を超える人は、年末調整の対象外です。来年の2月〜3月に確定申告をしてください。</p>
        )}
      </Box>

      {family.spouse && r.spouse && (
        <Box title="配偶者控除等申告書">
          {!family.spouse.birth && (
            <p className="mb-2 rounded bg-yellow-50 p-2 text-sm">配偶者の生年月日が入力されていません。70歳以上（昭和32年1月1日以前生まれ）の場合は控除額が変わるので、「家族と収入」タブで入力してください。</p>
          )}
          <Row label="配偶者の本年中の合計所得金額の見積額" value={`${yen(r.spouse.income)} 円`} />
          <Row label="区分Ⅱ（判定）" value={r.spouse.kubun2 ?? "該当なし"} />
          {r.spouse.kind ? (
            <Row label={`${r.spouse.kind}の額`} value={`${yen(r.spouse.amount)} 円`} strong />
          ) : (
            <p className="mt-2 rounded bg-yellow-50 p-2 text-sm">{r.spouse.reason}この申告書は書かなくてかまいません。</p>
          )}
          <Note>配偶者の氏名・生年月日・住所（別居の場合）・個人番号は、ご自身で記入してください。</Note>
        </Box>
      )}

      {r.specific.length > 0 && (
        <Box title="特定親族特別控除申告書">
          {r.specific.map(({ status, amount }, i) => (
            <div key={i} className="mb-2">
              <Row label={`${name(status)}（${status.age}歳）の本年中の合計所得金額の見積額`} value={`${yen(status.income)} 円`} />
              <Row label="特定親族特別控除の額" value={`${yen(amount)} 円`} strong />
            </div>
          ))}
          <Note>19歳以上23歳未満（平16.1.2生〜平20.1.1生）で、所得が62万円超123万円以下の家族が対象です。</Note>
        </Box>
      )}

      <Box title="所得金額調整控除申告書">
        {r.adjustment.applies ? (
          <>
            <p className="text-sm">記入が必要です。「要件」欄で次の項目にチェックを付けてください（2つ以上あれば、どれか1つでかまいません）。</p>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {r.adjustment.reasons.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <Row label="控除額の目安（勤務先が計算します）" value={`${yen(r.adjustment.amount)} 円`} />
          </>
        ) : (
          <p className="text-sm">
            {r.adjustment.overSalaryLimit
              ? "要件（特別障害者・23歳未満の扶養親族）に当てはまる人がいないため、記入不要です。"
              : "給与の収入が850万円以下なので、記入不要です。"}
          </p>
        )}
      </Box>
    </div>
  );
}

export function DependentsGuide({ family }: { family: Family }) {
  const r = dependentsForm(family);
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-600">
        年末調整の時期に、来年分として提出する「令和9年分 給与所得者の扶養控除等（異動）申告書」の記入例です。
        年齢は令和9年12月31日時点、所得は入力した金額が来年も同じと仮定して判定しています。
      </p>

      <Box title="Ａ 源泉控除対象配偶者">
        {!r.spouseA ? (
          <p className="text-sm">配偶者がいないので、書きません。</p>
        ) : r.spouseA.show ? (
          <>
            <p className="text-sm">配偶者を記入します。</p>
            <Row label="令和9年中の所得の見積額" value={`${yen(r.spouseA.income)} 円`} />
          </>
        ) : (
          <p className="text-sm">{r.spouseA.reason}</p>
        )}
      </Box>

      <Box title="Ｂ 控除対象扶養親族・特定親族（源泉控除対象親族）">
        {r.withholding.length === 0 ? (
          <p className="text-sm">該当する家族はいません。</p>
        ) : (
          r.withholding.map((s, i) => (
            <div key={i} className="mb-3 rounded border border-gray-200 p-2">
              <p className="font-bold">
                {name(s)}（{s.age}歳）
              </p>
              <Row label="令和9年中の所得の見積額" value={`${yen(s.income)} 円`} />
              <Row
                label="チェックを付ける欄"
                value={
                  s.isCoResidentParent
                    ? "老人扶養親族「同居老親等」"
                    : s.isElderly
                      ? "老人扶養親族「その他」"
                      : s.isSpecialDependent
                        ? "特定扶養親族・特定親族「特定扶養親族」"
                        : s.isSpecificRelative
                          ? "特定扶養親族・特定親族「特定親族」"
                          : "なし（一般の控除対象扶養親族）"
                }
              />
            </div>
          ))
        )}
      </Box>

      <Box title="Ｃ 障害者・寡婦・ひとり親・勤労学生">
        {r.c.length === 0 ? (
          <p className="text-sm">該当なし。書きません。</p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {r.c.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        )}
        {r.c.length > 0 && <Note>障害者の場合は、「障害者又は勤労学生の内容」欄に手帳の種類・交付日・等級などを記入します。</Note>}
      </Box>

      <Box title="住民税に関する事項（16歳未満の扶養親族）">
        {r.under16.length === 0 ? (
          <p className="text-sm">該当する家族はいません。</p>
        ) : (
          r.under16.map((s, i) => (
            <div key={i} className="mb-2">
              <Row label={`${name(s)}（${s.age}歳・平24.1.2以後生）`} value={`所得 ${yen(s.income)} 円`} />
            </div>
          ))
        )}
      </Box>

      {r.notListed.length > 0 && (
        <Box title="この申告書に書かない家族">
          <ul className="list-disc pl-5 text-sm">
            {r.notListed.map((s, i) => (
              <li key={i}>
                {name(s)}（{s.age ?? "年齢不明"}歳）：
                {s.age === null
                  ? "生年月日を入力してください。"
                  : s.isSpecificRelative
                    ? `特定親族ですが、所得が100万円を超えるため、この申告書には書きません（基礎控除申告書の特定親族特別控除で申告します）。`
                    : s.income > 620_000
                      ? `所得（${man(s.income)}）が62万円を超えるため、扶養親族になりません。`
                      : "対象外です。"}
              </li>
            ))}
          </ul>
        </Box>
      )}

      <Note>氏名・個人番号・住所などはご自身で記入してください。前年と内容が同じ場合は、簡易な申告書（異動がない旨の記載）で提出できる場合があります。勤務先に確認してください。</Note>
    </div>
  );
}
