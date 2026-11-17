import { describe, expect, it } from "vitest";
import { estimateSaving, incomeTax, withReconstruction } from "../src/lib/estimate";
import { emptySelf, newPerson, type Family } from "../src/lib/family";

describe("所得税の速算表", () => {
  it.each([
    [1_000_000, 50_000],
    [1_950_000, 97_500],
    [3_000_000, 202_500], // 10% − 97,500
    [5_000_000, 572_500], // 20% − 427,500
    [8_000_000, 1_204_000], // 23% − 636,000
  ])("課税所得 %i 円 → %i 円", (t, tax) => expect(incomeTax(t)).toBe(tax));
  it("復興特別所得税を含め、100円未満を切り捨てる", () => expect(withReconstruction(55_000)).toBe(56_100));
});

describe("戻る金額の目安", () => {
  const single = (salary: number): Family => ({ self: { ...emptySelf(), salary }, spouse: null, dependents: [] });
  it("年収400万円・独身・生命保険料控除4万円 → 約2,000円", () => {
    // 給与所得276万（100万×3.2−44万） − 社会保険58.8万 − 基礎控除104万 = 課税所得113.2万（税率5%）
    const e = estimateSaving(single(4_000_000), 40_000);
    expect(e.taxable).toBe(1_132_000);
    expect(e.rate).toBe(5);
    expect(e.saving).toBe(2_000);
  });
  it("住宅ローン控除は税金から直接引くが、税額より多くは戻らない", () => {
    const e = estimateSaving(single(4_000_000), 0, 500_000);
    expect(e.after).toBe(0);
    expect(e.saving).toBe(e.before);
  });
  it("家族がいると課税所得が下がる（配偶者控除・扶養控除を反映）", () => {
    const f: Family = {
      self: { ...emptySelf(), salary: 5_000_000 },
      spouse: { ...newPerson("配偶者"), birth: "1985-01-01", salary: 1_000_000 },
      dependents: [{ ...newPerson(), birth: "2009-05-05" }], // 17歳 → 一般の扶養 38万
    };
    expect(estimateSaving(f, 0).taxable).toBe(estimateSaving(single(5_000_000), 0).taxable - 380_000 - 380_000);
  });
});
