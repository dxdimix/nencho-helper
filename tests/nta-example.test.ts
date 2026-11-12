import { expect, it } from "vitest";
import { calculate } from "../src/lib/calc";
import { ReadResult } from "../src/lib/schema";
const L = (category: string, system: string, amount: number) => ({ insurer: "x", policyType: "x", period: "x", contractor: "x", beneficiary: "x", category, system, amount, confidence: "高" });
it("国税庁 記載例（令和8年分 保険料控除申告書）と一致する", () => {
  const r = ReadResult.parse({
    life: [L("一般", "新", 80000), L("一般", "旧", 35000), L("介護医療", "新", 80000), L("個人年金", "新", 30000), L("個人年金", "旧", 90000)],
    earthquake: [
      { insurer: "x", policyType: "x", period: "x", contractor: "x", category: "地震", amount: 42000, confidence: "高" },
      { insurer: "x", policyType: "x", period: "x", contractor: "x", category: "旧長期損害", amount: 14800, confidence: "高" },
    ],
  });
  const c = calculate(r, { under23: true });
  expect([c.general.newDeduction, c.general.oldDeduction, c.general.combined, c.general.deduction]).toEqual([50000, 30000, 60000, 60000]); // ② ③ ⑤ ㋑
  expect(c.care.deduction).toBe(40000); // ㋺
  expect([c.pension.newDeduction, c.pension.oldDeduction, c.pension.combined, c.pension.deduction]).toEqual([25000, 47500, 40000, 47500]); // ⑥ ⑦ ⑧ ㋩
  expect(c.lifeDeduction).toBe(120000);
  expect([c.earthquake.quakePart, c.earthquake.oldLongPart, c.earthquake.deduction]).toEqual([42000, 12400, 50000]);
});

import { basicForm, emptySelf, newPerson } from "../src/lib/family";

it("国税庁 記載例（令和8年分 基礎控除申告書）と一致する", () => {
  // 給与897万円、配偶者の給与124万円、子（平18.3.3生）の所得100万円（給与174万円）、23歳未満の扶養親族あり
  const r = basicForm({
    self: { ...emptySelf(), salary: 8_970_000 },
    spouse: { ...newPerson("配偶者"), birth: "1985-05-05", salary: 1_240_000 },
    dependents: [
      { ...newPerson(), birth: "2006-03-03", salary: 1_740_000 },
      { ...newPerson(), birth: "2012-04-04" },
    ],
  });
  expect(r.adjustment.amount).toBe(47_000); // 所得金額調整控除
  expect(r.basic.total).toBe(6_973_000); // 合計所得金額の見積額
  expect(r.basic.amount).toBe(620_000); // 基礎控除の額
  expect(r.basic.kubun1).toBe("A");
  expect(r.spouse).toMatchObject({ income: 500_000, kubun2: "②", amount: 380_000 }); // 配偶者控除の額
  expect(r.specific[0].amount).toBe(410_000); // 特定親族特別控除の額
});
