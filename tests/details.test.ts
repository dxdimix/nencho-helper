import { describe, expect, it } from "vitest";
import { lifeNewFormula, lifeNewFormulaUnder23, lifeOldFormula, oldLongTermFormula } from "../src/lib/calc";
import { buildDetails, explainFormula, FORMULA_LONG, FORMULA_NEW, FORMULA_NEW_UNDER23, FORMULA_OLD } from "../src/lib/details";
import { emptySelf, newPerson } from "../src/lib/family";
import { ReadResult } from "../src/lib/schema";

describe("計算式の説明は、実際の計算と同じ結果になる", () => {
  const xs = [0, 1, 15000, 20000, 20001, 33333, 40000, 40001, 59999, 80000, 80001, 100000, 120001, 300000];
  it.each([
    [FORMULA_NEW, lifeNewFormula],
    [FORMULA_NEW_UNDER23, lifeNewFormulaUnder23],
    [FORMULA_OLD, lifeOldFormula],
    [FORMULA_LONG, oldLongTermFormula],
  ] as const)("%#", (f, fn) => {
    for (const x of xs) expect(explainFormula(x, f).result).toBe(fn(x));
  });
});

describe("結果の詳細", () => {
  const life = (category: string, system: string, amount: number) => ({ insurer: "テスト生命", policyType: "終身", period: "", contractor: "", beneficiary: "", beneficiaryRelation: "", category, system, amount, amountBasis: "", confidence: "高", note: "" });
  const data = ReadResult.parse({
    life: [life("一般", "新", 100000), life("一般", "旧", 120000), life("介護医療", "新", 50000), life("個人年金", "新", 90000)],
    earthquake: [{ insurer: "テスト損保", policyType: "地震", period: "", contractor: "", resident: "", residentRelation: "", category: "地震", amount: 60000, confidence: "高", note: "" }],
    social: [],
    smallBiz: [],
    excluded: [{ description: "団体信用生命保険", reason: "控除の対象外" }],
    housing: [],
    otherDocs: [{ docType: "源泉徴収票", summary: "前の会社" }],
  });
  const family = { self: { ...emptySelf(), salary: 5_000_000 }, spouse: { ...newPerson("配偶者"), birth: "1988-12-12", salary: 4_500_000 }, dependents: [{ ...newPerson("子"), birth: "2010-04-01" }] };
  const sections = buildDetails({ data, family, under23: true, under23IncomeLimit: 620_000, under23Auto: true, housingInput: null });
  const text = JSON.stringify(sections);

  it("上限で抑えたこと・除外した理由・書類以外の扱いを含む", () => {
    expect(text).toContain("120,000円 に抑えています"); // 生命保険の合計上限
    expect(text).toContain("50,000円"); // 地震保険の上限
    expect(text).toContain("団体信用生命保険");
    expect(text).toContain("控除の対象外");
    expect(text).toContain("源泉徴収票");
  });
  it("23歳未満の特例と、共働きの配偶者の判定を説明する", () => {
    expect(text).toContain("令和8年分の特例の計算式");
    expect(text).toContain("配偶者の所得が133万円を超える");
  });
  it("旧だけの方が大きいときは、そのことを書く", () => {
    const d = ReadResult.parse({ ...data, life: [life("一般", "新", 10000), life("一般", "旧", 120000)] });
    const t = JSON.stringify(buildDetails({ data: d, family, under23: false, under23IncomeLimit: 620_000, under23Auto: true, housingInput: null }));
    expect(t).toContain("旧だけの方が大きいため");
  });
});
