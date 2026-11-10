import type { ReadResult } from "./schema";

// 国税庁「給与所得者の保険料控除申告書」の計算式（所得税）。1円未満の端数は切り上げ。

/** 計算式Ⅰ（新保険料等用） */
export function lifeNewFormula(x: number): number {
  if (x <= 0) return 0;
  if (x <= 20000) return x;
  if (x <= 40000) return Math.ceil(x / 2 + 10000);
  if (x <= 80000) return Math.ceil(x / 4 + 20000);
  return 40000;
}

/** 計算式Ⅱ（旧保険料等用） */
export function lifeOldFormula(x: number): number {
  if (x <= 0) return 0;
  if (x <= 25000) return x;
  if (x <= 50000) return Math.ceil(x / 2 + 12500);
  if (x <= 100000) return Math.ceil(x / 4 + 25000);
  return 50000;
}

/** 旧長期損害保険料の計算式 */
export function oldLongTermFormula(x: number): number {
  if (x <= 0) return 0;
  if (x <= 10000) return x;
  if (x <= 20000) return Math.ceil(x / 2 + 5000);
  return 15000;
}

export type NewOldBlock = {
  newTotal: number; // 新保険料等の合計
  oldTotal: number; // 旧保険料等の合計
  newDeduction: number; // 計算式Ⅰに当てはめた金額
  oldDeduction: number; // 計算式Ⅱに当てはめた金額
  combined: number; // 新＋旧（最高40,000円）
  deduction: number; // 旧のみと（新＋旧）のいずれか大きい金額
};

function newOldBlock(newTotal: number, oldTotal: number): NewOldBlock {
  const newDeduction = lifeNewFormula(newTotal);
  const oldDeduction = lifeOldFormula(oldTotal);
  const combined = Math.min(newDeduction + oldDeduction, 40000);
  return { newTotal, oldTotal, newDeduction, oldDeduction, combined, deduction: Math.max(oldDeduction, combined) };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function calculate(r: ReadResult) {
  const lifeSum = (cat: string, sys: string) =>
    sum(r.life.filter((i) => i.category === cat && i.system === sys).map((i) => i.amount));

  const general = newOldBlock(lifeSum("一般", "新"), lifeSum("一般", "旧"));
  const pension = newOldBlock(lifeSum("個人年金", "新"), lifeSum("個人年金", "旧"));
  const careTotal = lifeSum("介護医療", "新") + lifeSum("介護医療", "旧");
  const care = { total: careTotal, deduction: lifeNewFormula(careTotal) };
  const lifeDeduction = Math.min(general.deduction + pension.deduction + care.deduction, 120000);

  const quakeTotal = sum(r.earthquake.filter((i) => i.category === "地震").map((i) => i.amount));
  const oldLongTotal = sum(r.earthquake.filter((i) => i.category === "旧長期損害").map((i) => i.amount));
  const quakePart = Math.min(quakeTotal, 50000);
  const oldLongPart = oldLongTermFormula(oldLongTotal);
  const earthquake = {
    quakeTotal,
    oldLongTotal,
    quakePart,
    oldLongPart,
    deduction: Math.min(quakePart + oldLongPart, 50000),
  };

  const social = { deduction: sum(r.social.map((i) => i.amount)) };
  const smallBiz = { deduction: sum(r.smallBiz.map((i) => i.amount)) };

  // 介護医療に「旧」が入っていたら、分類の誤りの可能性が高い（旧制度に介護医療区分はない）。
  const warnings: string[] = [];
  if (lifeSum("介護医療", "旧") > 0) {
    warnings.push("介護医療保険料に「旧」の契約があります。旧制度の医療保険は「一般」に入れるのが正しいので、ハガキの区分を確認してください。");
  }

  return { general, pension, care, lifeDeduction, earthquake, social, smallBiz, warnings };
}

export type Calculation = ReturnType<typeof calculate>;
