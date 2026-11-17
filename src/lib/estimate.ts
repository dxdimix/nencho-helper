import { basicForm, classify, salaryIncome, type Family } from "./family";

// 「年末調整で、いくら税金が戻るか（安くなるか）」の目安。
// 保険料控除などを申告したときに、所得税（復興特別所得税を含む）がいくら減るかを計算する。
// 勤務先の社会保険料（健康保険・厚生年金など）は分からないので、給与の約14.7%として見積もる。
// あくまで目安であり、実際の金額は勤務先の計算で決まる。

/** 所得税の速算表（課税される所得金額は1,000円未満切捨て） */
export function incomeTax(taxable: number): number {
  const t = Math.max(0, Math.floor(taxable / 1000) * 1000);
  const rows: [number, number, number][] = [
    [1_950_000, 0.05, 0],
    [3_300_000, 0.1, 97_500],
    [6_950_000, 0.2, 427_500],
    [9_000_000, 0.23, 636_000],
    [18_000_000, 0.33, 1_536_000],
    [40_000_000, 0.4, 2_796_000],
    [Infinity, 0.45, 4_796_000],
  ];
  const [, rate, sub] = rows.find(([max]) => t <= max)!;
  return Math.max(0, Math.round(t * rate) - sub);
}

/** 復興特別所得税（2.1%）を含めた税額（100円未満切捨て） */
export function withReconstruction(tax: number): number {
  return Math.floor((tax * 1.021) / 100) * 100;
}

/** 税率（所得税のみ）。説明用 */
export function marginalRate(taxable: number): number {
  const t = Math.max(0, taxable);
  if (t <= 1_950_000) return 5;
  if (t <= 3_300_000) return 10;
  if (t <= 6_950_000) return 20;
  if (t <= 9_000_000) return 23;
  if (t <= 18_000_000) return 33;
  if (t <= 40_000_000) return 40;
  return 45;
}

export const COMPANY_SOCIAL_RATE = 0.147;

/** 扶養控除の額（令和8年分。年齢は12月31日時点） */
function dependentDeductions(f: Family): number {
  return f.dependents.reduce((sum, p) => {
    const s = classify(p, 2026);
    if (!s.isQualified) return sum;
    if (s.isCoResidentParent) return sum + 580_000;
    if (s.isElderly) return sum + 480_000;
    if (s.isSpecialDependent) return sum + 630_000;
    return sum + 380_000;
  }, 0);
}

export type Estimate = {
  /** 課税される所得金額（見積もり） */
  taxable: number;
  /** 税率（%） */
  rate: number;
  /** 申告しなかった場合の税額 */
  before: number;
  /** 申告した場合の税額 */
  after: number;
  /** 戻る（安くなる）金額の目安 */
  saving: number;
};

/**
 * @param insuranceDeduction 保険料控除などの合計（生命保険・地震保険・自分で払った社会保険料・iDeCo など）
 * @param housingCredit 住宅ローン控除の額（税金から直接差し引く）
 */
export function estimateSaving(f: Family, insuranceDeduction: number, housingCredit = 0): Estimate {
  const b = basicForm(f);
  const companySocial = Math.round(f.self.salary * COMPANY_SOCIAL_RATE);
  const other = b.basic.amount + companySocial + (b.spouse?.amount ?? 0) + b.specific.reduce((a, s) => a + s.amount, 0) + dependentDeductions(f);
  const income = salaryIncome(f.self.salary) - b.adjustment.amount + f.self.otherIncome;
  const taxable = Math.max(0, income - other);
  const before = withReconstruction(incomeTax(taxable));
  const afterDeduction = withReconstruction(incomeTax(taxable - insuranceDeduction));
  const after = Math.max(0, afterDeduction - housingCredit);
  return { taxable, rate: marginalRate(taxable - insuranceDeduction), before, after, saving: before - after };
}
