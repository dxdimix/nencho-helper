import { calculate, type NewOldBlock } from "./calc";
import { fitRows } from "./formOps";
import { COMPANY_SOCIAL_RATE, estimateSaving, incomeTax, withReconstruction } from "./estimate";
import { basicForm, classify, dependentsForm, salaryIncome, totalIncome, under23DependentFor, type Family } from "./family";
import { calcHousing, type HousingInput } from "./housing";
import { OTHER_DOC_ADVICE } from "./review";
import type { ReadResult } from "./schema";

// 「結果の詳細」：お手本の元になった計算を、途中の式・上限・除外の理由まで含めて並べる。
// 計算そのものは calc.ts / family.ts / housing.ts / estimate.ts の結果を使い、ここでは説明の文を作るだけ。

export type DetailRow = { label: string; value?: string; note?: string; strong?: boolean };
export type DetailSection = { title: string; intro?: string; rows: DetailRow[] };

export const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

// ---------------------------------------------------------------------------
// 生命保険料・旧長期損害保険料の計算式の説明（calc.ts の式と同じ区切り）

type Band = { max: number; div: number; add: number };
type Formula = { name: string; bands: Band[]; cap: number };

export const FORMULA_NEW: Formula = { name: "計算式Ⅰ（新契約）", bands: [{ max: 20000, div: 1, add: 0 }, { max: 40000, div: 2, add: 10000 }, { max: 80000, div: 4, add: 20000 }], cap: 40000 };
export const FORMULA_NEW_UNDER23: Formula = { name: "令和8年分の特例の計算式（23歳未満の扶養親族がいる場合の一般・新契約）", bands: [{ max: 30000, div: 1, add: 0 }, { max: 60000, div: 2, add: 15000 }, { max: 120000, div: 4, add: 30000 }], cap: 60000 };
export const FORMULA_OLD: Formula = { name: "計算式Ⅱ（旧契約）", bands: [{ max: 25000, div: 1, add: 0 }, { max: 50000, div: 2, add: 12500 }, { max: 100000, div: 4, add: 25000 }], cap: 50000 };
export const FORMULA_LONG: Formula = { name: "旧長期損害保険料の計算式", bands: [{ max: 10000, div: 1, add: 0 }, { max: 20000, div: 2, add: 5000 }], cap: 15000 };

/** 計算式に当てはめた結果と、その説明 */
export function explainFormula(x: number, f: Formula): { result: number; text: string } {
  if (x <= 0) return { result: 0, text: "支払った金額がないため 0円" };
  let low = 0;
  for (const b of f.bands) {
    if (x <= b.max) {
      const range = low === 0 ? `${yen(b.max)}以下` : `${yen(low)}超 ${yen(b.max)}以下`;
      if (b.div === 1) return { result: x, text: `${range}なので、支払った金額がそのまま控除額 → ${yen(x)}` };
      const result = Math.ceil(x / b.div + b.add);
      return { result, text: `${range}なので、${yen(x)} ÷ ${b.div} ＋ ${yen(b.add)} ＝ ${yen(result)}（1円未満切り上げ）` };
    }
    low = b.max;
  }
  return { result: f.cap, text: `${yen(low)}を超えるので、上限の ${yen(f.cap)}` };
}

function newOldRows(name: string, b: NewOldBlock, newFormula: Formula): DetailRow[] {
  const rows: DetailRow[] = [];
  if (b.newTotal === 0 && b.oldTotal === 0) return [{ label: name, value: "0円", note: "この区分のハガキはありません。" }];
  const n = explainFormula(b.newTotal, newFormula);
  const o = explainFormula(b.oldTotal, FORMULA_OLD);
  if (b.newTotal > 0) rows.push({ label: `${name}：新契約の合計 ${yen(b.newTotal)}`, value: yen(n.result), note: `${newFormula.name}：${n.text}` });
  if (b.oldTotal > 0) rows.push({ label: `${name}：旧契約の合計 ${yen(b.oldTotal)}`, value: yen(o.result), note: `${FORMULA_OLD.name}：${o.text}` });
  if (b.newTotal > 0 && b.oldTotal > 0) {
    const sum = b.newDeduction + b.oldDeduction;
    rows.push({
      label: `${name}：新＋旧`,
      value: yen(b.combined),
      note: `${yen(b.newDeduction)} ＋ ${yen(b.oldDeduction)} ＝ ${yen(sum)}${sum > b.cap ? `。新と旧を合わせた上限は ${yen(b.cap)} なので、${yen(b.cap)} に抑えています` : ""}。`,
    });
    rows.push({
      label: `${name}の控除額`,
      value: yen(b.deduction),
      strong: true,
      note: `「旧だけの ${yen(b.oldDeduction)}」と「新＋旧の ${yen(b.combined)}」のうち、大きい方を使います（国税庁の申告書のルール）。${
        b.deduction === b.oldDeduction && b.oldDeduction > b.combined ? "旧だけの方が大きいため、新契約の分は使っていません。" : ""
      }`,
    });
  } else {
    rows.push({ label: `${name}の控除額`, value: yen(b.deduction), strong: true });
  }
  return rows;
}

// ---------------------------------------------------------------------------

export type DetailsInput = {
  data: ReadResult | null;
  family: Family;
  /** 23歳未満の扶養親族がいる（画面で使っている判定） */
  under23: boolean;
  /** 23歳未満の扶養親族の所得の基準（11月以前の年末調整は58万円） */
  under23IncomeLimit: number;
  /** 23歳未満の判定を自動で行ったか（false なら画面のチェックによる） */
  under23Auto: boolean;
  housingInput: HousingInput | null;
};

export function buildDetails(inp: DetailsInput): DetailSection[] {
  const { data, family } = inp;
  const sections: DetailSection[] = [];

  // 1. 登録した書類 ---------------------------------------------------------
  if (data) {
    const rows: DetailRow[] = [];
    const conf = (c: string) => (c === "高" ? "" : `／読み取りの確かさ：${c}`);
    for (const i of data.life)
      rows.push({
        label: `生命保険：${i.insurer || "（会社名なし）"} ${i.policyType}`,
        value: yen(i.amount),
        note: `区分：${i.category}・${i.system}契約${i.amountBasis ? `／使った金額：${i.amountBasis}` : ""}${i.contractor ? `／契約者：${i.contractor}` : ""}${i.beneficiary ? `／受取人：${i.beneficiary}` : ""}${conf(i.confidence)}${i.note ? `／メモ：${i.note}` : ""}`,
      });
    for (const i of data.earthquake)
      rows.push({
        label: `地震保険：${i.insurer || "（会社名なし）"} ${i.policyType}`,
        value: yen(i.amount),
        note: `区分：${i.category === "地震" ? "地震保険料" : "旧長期損害保険料"}${conf(i.confidence)}${i.note ? `／メモ：${i.note}` : ""}`,
      });
    for (const i of data.social)
      rows.push({ label: `社会保険：${i.kind}`, value: yen(i.amount), note: `支払先：${i.payee || "不明"}${i.burdenPerson ? `／負担する人：${i.burdenPerson}` : ""}${conf(i.confidence)}${i.note ? `／メモ：${i.note}` : ""}` });
    for (const i of data.smallBiz) rows.push({ label: `iDeCo など：${i.kind}`, value: yen(i.amount), note: `${conf(i.confidence).replace(/^／/, "")}${i.note ? ` メモ：${i.note}` : ""}` || undefined });
    for (const i of data.housing)
      rows.push({
        label: `住宅ローン：${i.docKind}`,
        value: i.yearEndBalance !== null ? `年末残高 ${yen(i.yearEndBalance)}` : undefined,
        note: [i.residenceStart && `居住開始：${i.residenceStart}`, i.ratePercent !== null && `控除率：${i.ratePercent}%`, i.limit !== null && `限度額：${yen(i.limit)}`, i.acquisitionCost !== null && `取得対価：${yen(i.acquisitionCost)}`]
          .filter(Boolean)
          .join("／") || undefined,
      });
    for (const e of data.excluded) rows.push({ label: `計算に入れなかったもの：${e.description}`, note: `理由：${e.reason || "理由の記載なし"}` });
    for (const d of data.otherDocs) rows.push({ label: `控除証明書ではない書類：${d.docType}${d.summary ? `（${d.summary}）` : ""}`, note: `計算には使っていません。${OTHER_DOC_ADVICE[d.docType]}` });
    sections.push({ title: "登録したハガキ・書類", intro: "読み取った（入力した）内容のすべてです。金額はこの値をもとに計算しています。", rows: rows.length ? rows : [{ label: "登録した書類はありません" }] });
  }

  // 2. 保険料控除 -----------------------------------------------------------
  if (data) {
    const calc = calculate(data, { under23: inp.under23 });
    const who = under23DependentFor(family, 2026, inp.under23IncomeLimit);
    const u23: DetailRow = {
      label: "23歳未満の扶養親族（令和8年分の特例）",
      value: inp.under23 ? "あり" : "なし",
      note: `${inp.under23Auto ? "アンケートの家族の情報から自動で判定" : "画面のチェックで指定"}。対象は、平成16年1月2日以後に生まれ、所得${inp.under23IncomeLimit / 10000}万円以下の家族です。${
        who ? `該当：${who.person.label || who.person.relation}（${who.birthWareki}生まれ、所得 ${yen(who.income)}）。` : ""
      }${inp.under23 ? "一般の生命保険（新契約）に特例の計算式を使い、新＋旧の上限を6万円にしています。" : "特例は使っていません。"}`,
    };

    const lifeRows: DetailRow[] = [u23, ...newOldRows("一般の生命保険", calc.general, inp.under23 ? FORMULA_NEW_UNDER23 : FORMULA_NEW)];
    const careX = explainFormula(calc.care.total, FORMULA_NEW);
    lifeRows.push(
      calc.care.total > 0
        ? { label: `介護医療保険：合計 ${yen(calc.care.total)}`, value: yen(calc.care.deduction), strong: true, note: `介護医療保険は新契約だけの区分で、${FORMULA_NEW.name}を使います：${careX.text}` }
        : { label: "介護医療保険", value: "0円", note: "この区分のハガキはありません。" },
    );
    lifeRows.push(...newOldRows("個人年金保険", calc.pension, FORMULA_NEW));
    const lifeSum = calc.general.deduction + calc.pension.deduction + calc.care.deduction;
    lifeRows.push({
      label: "生命保険料控除の合計",
      value: yen(calc.lifeDeduction),
      strong: true,
      note: `${yen(calc.general.deduction)} ＋ ${yen(calc.care.deduction)} ＋ ${yen(calc.pension.deduction)} ＝ ${yen(lifeSum)}${lifeSum > 120000 ? `。生命保険料控除の上限は12万円なので、${yen(120000)} に抑えています` : "（上限12万円の範囲内）"}。`,
    });
    for (const n of fitRows(data, inp.under23).notes) lifeRows.push({ label: "申告書に書かないハガキ", note: n });
    sections.push({ title: "生命保険料控除", intro: "国税庁の保険料控除申告書の計算式で計算しています。", rows: lifeRows });

    const e = calc.earthquake;
    const quakeRows: DetailRow[] = [];
    if (e.quakeTotal === 0 && e.oldLongTotal === 0) quakeRows.push({ label: "地震保険", value: "0円", note: "地震保険のハガキはありません。" });
    else {
      if (e.quakeTotal > 0)
        quakeRows.push({ label: `地震保険料の合計 ${yen(e.quakeTotal)}`, value: yen(e.quakePart), note: e.quakeTotal > 50000 ? `5万円を超えるので、上限の ${yen(50000)}。` : "5万円以下なので、そのまま控除額になります。" });
      if (e.oldLongTotal > 0) {
        const x = explainFormula(e.oldLongTotal, FORMULA_LONG);
        quakeRows.push({ label: `旧長期損害保険料の合計 ${yen(e.oldLongTotal)}`, value: yen(e.oldLongPart), note: `${FORMULA_LONG.name}：${x.text}` });
      }
      quakeRows.push({
        label: "地震保険料控除",
        value: yen(e.deduction),
        strong: true,
        note: `${yen(e.quakePart)} ＋ ${yen(e.oldLongPart)} ＝ ${yen(e.quakePart + e.oldLongPart)}${e.quakePart + e.oldLongPart > 50000 ? `。上限は5万円なので ${yen(50000)} に抑えています` : "（上限5万円の範囲内）"}。`,
      });
    }
    sections.push({ title: "地震保険料控除", rows: quakeRows });

    sections.push({
      title: "社会保険料控除・小規模企業共済等掛金控除（iDeCo など）",
      intro: "どちらも上限はなく、支払った金額の全額が控除になります。給料から引かれている健康保険・厚生年金は、会社が別に計算するので、ここには入りません。",
      rows: [
        ...data.social.map((i) => ({ label: `社会保険：${i.kind}`, value: yen(i.amount) })),
        { label: "社会保険料控除", value: yen(calc.social.deduction), strong: true },
        ...data.smallBiz.map((i) => ({ label: i.kind, value: yen(i.amount) })),
        { label: "小規模企業共済等掛金控除", value: yen(calc.smallBiz.deduction), strong: true },
      ],
    });

    const total = calc.lifeDeduction + calc.earthquake.deduction + calc.social.deduction + calc.smallBiz.deduction;
    sections.push({
      title: "保険料控除申告書で受ける控除の合計",
      rows: [
        { label: "生命保険料控除", value: yen(calc.lifeDeduction) },
        { label: "地震保険料控除", value: yen(calc.earthquake.deduction) },
        { label: "社会保険料控除", value: yen(calc.social.deduction) },
        { label: "小規模企業共済等掛金控除", value: yen(calc.smallBiz.deduction) },
        { label: "合計（所得から差し引かれる金額）", value: yen(total), strong: true },
        ...calc.warnings.map((w) => ({ label: "注意", note: w })),
      ],
    });
  }

  // 3. 住宅ローン控除 -------------------------------------------------------
  if (inp.housingInput) {
    const h = inp.housingInput;
    const r = calcHousing(h);
    const rows: DetailRow[] = [
      { label: "年末残高", value: h.balance === null ? "未入力" : yen(h.balance) },
      { label: "あなたの負担割合", value: `${h.sharePercent}%`, note: r.myBalance !== null ? `あなたの分の年末残高：${yen(r.myBalance)}` : undefined },
      { label: "家屋・土地の取得対価の額", value: h.acquisitionCost === null ? "未入力（残高だけで計算）" : yen(h.acquisitionCost) },
      { label: "居住用の割合", value: `${h.residentialPercent}%`, note: h.residentialPercent >= 90 && h.residentialPercent < 100 ? "90%以上なので100%として計算しています。" : undefined },
      {
        label: "計算に使う残高",
        value: r.target === null ? "計算できません" : yen(r.target),
        note: "年末残高（あなたの分）と取得対価の額の小さい方に、居住用の割合を掛けた金額です。",
      },
      { label: "控除率", value: h.ratePercent === null ? "未入力" : `${h.ratePercent}%` },
      { label: "残高 × 控除率", value: r.raw === null ? "計算できません" : yen(r.raw), note: "100円未満は切り捨てます。" },
      { label: "控除限度額", value: h.limit === null ? "未入力" : yen(h.limit) },
      {
        label: "住宅ローン控除の額",
        value: r.amount === null ? "計算できません" : yen(r.amount),
        strong: true,
        note: r.raw !== null && h.limit !== null && r.raw > h.limit ? `限度額を超えるので、${yen(h.limit)} に抑えています。` : "税金から直接差し引かれる金額です。",
      },
      ...r.missing.map((m) => ({ label: "足りない情報", note: m })),
      ...r.warnings.map((w) => ({ label: "注意", note: w })),
    ];
    sections.push({ title: "住宅ローン控除", intro: "お手本の住宅ローンの欄で直した値を使っています。", rows });
  }

  // 4. 基礎控除・配偶者控除など（令和8年分）----------------------------------
  const b = basicForm(family);
  const basicRows: DetailRow[] = [
    {
      label: `あなたの給料の年収 ${yen(family.self.salary)}`,
      value: `給与所得 ${yen(salaryIncome(family.self.salary))}`,
      note: "年収から給与所得控除（令和8年分は最低74万円）を引いた金額です。基礎控除申告書の裏面の表で計算しています。",
    },
  ];
  if (b.adjustment.overSalaryLimit)
    basicRows.push({
      label: "所得金額調整控除",
      value: yen(b.adjustment.amount),
      note: b.adjustment.applies ? `年収が850万円を超え、次にあてはまるため：${b.adjustment.reasons.join("、")}。（年収（上限1,000万円）− 850万円）× 10% で計算しています。` : "年収は850万円を超えていますが、23歳未満の扶養親族や特別障害者がいないため対象外です。",
    });
  basicRows.push(
    { label: "給料以外の所得", value: yen(family.self.otherIncome) },
    { label: "合計所得金額の見積額", value: yen(b.basic.total), note: `判定の欄：「${b.basic.judgeRow}」にチェック。${b.basic.kubun1 ? `区分Ⅰ：${b.basic.kubun1}` : "所得が1,000万円を超えるため、配偶者控除の区分Ⅰはありません。"}` },
    { label: "基礎控除の額", value: yen(b.basic.amount), strong: true, note: "令和8年分の基礎控除の表（所得489万円以下は104万円など）によります。" },
  );
  if (family.spouse) {
    const s = b.spouse!;
    basicRows.push({
      label: `配偶者：年収 ${yen(family.spouse.salary)}、所得 ${yen(s.income)}`,
      value: s.kind ? `${s.kind} ${yen(s.amount)}` : "控除なし",
      strong: true,
      note: s.kind
        ? `配偶者の所得から区分Ⅱは「${s.kubun2}」。あなたの区分Ⅰ「${b.basic.kubun1}」との組み合わせで、申告書の表から金額を出しています。`
        : `${s.reason}（年収でいうと約207万円を超える場合です）`,
    });
  } else basicRows.push({ label: "配偶者", value: "いない（控除なし）" });
  for (const sp of b.specific)
    basicRows.push({
      label: `特定親族特別控除：${sp.status.person.label || sp.status.person.relation}`,
      value: yen(sp.amount),
      note: `19歳以上23歳未満で、所得が62万円を超え123万円以下（所得 ${yen(sp.status.income)}）のため。`,
    });
  sections.push({ title: "基礎控除申告書（令和8年分）", rows: basicRows });

  // 5. 家族ごとの判定 -------------------------------------------------------
  const famRows: DetailRow[] = [];
  for (const p of family.dependents) {
    const s8 = classify(p, 2026);
    const s9 = classify(p, 2027);
    const name = p.label || p.relation;
    const kind = (s: typeof s8) =>
      !s.isDependent
        ? s.isSpecificRelative
          ? "特定親族（扶養親族ではない）"
          : "扶養親族ではない（所得62万円超）"
        : s.age === null
          ? "扶養親族（生年月日がないため年齢の区分は不明）"
          : s.isUnder16
            ? "16歳未満の扶養親族（扶養控除はなし）"
            : s.isCoResidentParent
              ? "同居老親等（扶養控除58万円）"
              : s.isElderly
                ? "老人扶養親族（扶養控除48万円）"
                : s.isSpecialDependent
                  ? "特定扶養親族（扶養控除63万円）"
                  : "一般の控除対象扶養親族（扶養控除38万円）";
    famRows.push({
      label: `${name}：年収 ${yen(p.salary)}、所得 ${yen(totalIncome(p))}`,
      value: s8.age === null ? "年齢不明" : `${s8.age}歳（令和8年末）`,
      note: `令和8年分：${kind(s8)}。令和9年分：${s9.age === null ? "" : `${s9.age}歳、`}${kind(s9)}。${s8.isUnder23Dependent ? "23歳未満の扶養親族にあたります。" : ""}`,
    });
  }
  const d = dependentsForm(family);
  if (d.spouseA) famRows.push({ label: "扶養控除等申告書のＡ欄（源泉控除対象配偶者）", value: d.spouseA.show ? "書く" : "書かない", note: d.spouseA.show ? `配偶者の所得の見積額 ${yen(d.spouseA.income)}（95万円以下）。` : d.spouseA.reason });
  famRows.push({
    label: "扶養控除等申告書のＢ欄（控除対象扶養親族など）",
    value: d.withholding.length ? `${d.withholding.length}人` : "なし",
    note: d.withholding.map((s) => s.person.label || s.person.relation).join("、") || undefined,
  });
  if (d.under16.length) famRows.push({ label: "住民税の欄（16歳未満の扶養親族）", value: `${d.under16.length}人`, note: d.under16.map((s) => s.person.label || s.person.relation).join("、") });
  for (const s of d.notListed) famRows.push({ label: `申告書に書かない家族：${s.person.label || s.person.relation}`, note: s.age === null ? "生年月日がないため判定できません。" : `所得 ${yen(s.income)}。扶養親族の条件（所得62万円以下）にあてはまらないため。` });
  for (const c of d.c) famRows.push({ label: "Ｃ欄（障害者・寡婦・ひとり親・勤労学生）", value: c });
  sections.push({ title: "家族ごとの判定（扶養控除等申告書は令和9年分）", intro: "年齢は各年の12月31日時点です。所得は「年収 − 給与所得控除 ＋ 給料以外の所得」です。", rows: famRows.length ? famRows : [{ label: "家族の登録はありません" }] });

  // 6. 戻る金額の目安 -------------------------------------------------------
  if (data && family.self.salary > 0) {
    const calc = calculate(data, { under23: inp.under23 });
    const ins = calc.lifeDeduction + calc.earthquake.deduction + calc.social.deduction + calc.smallBiz.deduction;
    const housing = inp.housingInput ? (calcHousing(inp.housingInput).amount ?? 0) : 0;
    const est = estimateSaving(family, ins, housing);
    const companySocial = Math.round(family.self.salary * COMPANY_SOCIAL_RATE);
    const beforeTax = withReconstruction(incomeTax(est.taxable));
    sections.push({
      title: "税金が安くなる目安の計算",
      intro: "あくまで目安です。会社の社会保険料は給料の14.7%と仮定しています。実際の金額は勤務先の計算で決まります。",
      rows: [
        { label: "会社の給料から引かれる社会保険料（仮定）", value: yen(companySocial), note: `年収 ${yen(family.self.salary)} × 14.7%` },
        { label: "課税される所得（保険料控除の前）", value: yen(est.taxable), note: "所得から、基礎控除・会社の社会保険料・配偶者控除・扶養控除などを引いた金額です。" },
        { label: "所得税（保険料控除の前）", value: yen(beforeTax), note: "速算表で計算し、復興特別所得税（×102.1%）を含め、100円未満を切り捨てています。" },
        { label: "保険料控除を引いた後の所得税", value: yen(withReconstruction(incomeTax(Math.max(0, est.taxable - ins)))), note: `課税される所得から ${yen(ins)} を引いて計算。税率は ${est.rate}%。` },
        ...(housing > 0 ? [{ label: "住宅ローン控除", value: `−${yen(housing)}`, note: "所得税から直接差し引きます（所得税が0円より少なくはなりません）。" }] : []),
        { label: "安くなる金額の目安", value: yen(est.saving), strong: true, note: `${yen(est.before)} − ${yen(est.after)}` },
      ],
    });
  }

  return sections;
}
