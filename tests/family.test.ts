import { describe, expect, it } from "vitest";
import {
  ageAtYearEnd,
  basicForm,
  classify,
  dependentsForm,
  emptySelf,
  hasUnder23Dependent,
  newPerson,
  salaryIncome,
  specificRelativeAmount,
  spouseDeduction,
  toWareki,
  under23DependentFor,
  type Family,
  type Person,
} from "../src/lib/family";

const person = (over: Partial<Person>): Person => ({ ...newPerson(), ...over });

describe("給与所得（令和8・9年分、基礎控除申告書の裏面の表）", () => {
  it.each([
    [740_999, 0],
    [741_000, 1_000],
    [1_360_000, 620_000], // 扶養親族の上限：給与136万円 → 所得62万円
    [1_690_000, 950_000], // 源泉控除対象配偶者：給与169万円 → 95万円
    [1_970_000, 1_230_000], // 特定親族：給与197万円 → 123万円
    [2_070_000, 1_330_000], // 配偶者特別控除：給与207万円 → 133万円
    [2_190_999, 1_450_999],
    [2_191_000, 1_451_000],
    [2_193_000, 1_453_000],
    [2_196_000, 1_456_000],
    [2_200_000, 1_460_000], // 550千円×2.8−8万円
    [3_000_000, 2_020_000], // 750千円×2.8−8万円
    [5_000_000, 3_560_000], // 1,250千円×3.2−44万円
    [7_000_000, 5_200_000], // ×90%−110万円
    [10_000_000, 8_050_000], // −195万円
  ])("給与 %i 円 → 所得 %i 円", (salary, income) => {
    expect(salaryIncome(salary)).toBe(income);
  });
});

describe("年齢（12月31日現在）", () => {
  it("1月1日生まれは1歳多く数える", () => {
    expect(ageAtYearEnd("2012-01-01", 2027)).toBe(16); // 令和9年分 16歳以上＝平24.1.1以前生
    expect(ageAtYearEnd("2012-01-02", 2027)).toBe(15);
    expect(ageAtYearEnd("1958-01-01", 2027)).toBe(70); // 令和9年分 70歳以上＝昭33.1.1以前生
    expect(ageAtYearEnd("2004-01-02", 2026)).toBe(22); // 令和8年分 23歳未満＝平16.1.2以後生
    expect(ageAtYearEnd("2004-01-01", 2026)).toBe(23);
  });
});

describe("基礎控除申告書（令和8年分）", () => {
  const fam = (salary: number, other = 0): Family => ({ self: { ...emptySelf(), salary, otherIncome: other }, spouse: null, dependents: [] });
  it("所得489万円以下は104万円・区分A", () => {
    const r = basicForm(fam(5_000_000)).basic; // 所得356万円
    expect(r.total).toBe(3_560_000);
    expect(r.amount).toBe(1_040_000);
    expect(r.kubun1).toBe("A");
  });
  it("所得489万円超655万円以下は67万円", () => {
    expect(basicForm(fam(7_000_000)).basic.amount).toBe(670_000); // 所得520万円
  });
  it("所得900万円超950万円以下は区分B、950万円超1,000万円以下は区分C", () => {
    expect(basicForm(fam(10_000_000, 1_000_000)).basic.kubun1).toBe("B"); // 805+100=905万
    expect(basicForm(fam(10_000_000, 1_500_000)).basic.kubun1).toBe("C"); // 955万
    expect(basicForm(fam(10_000_000, 2_000_000)).basic.kubun1).toBe(null); // 1,005万
  });
  it("所得2,500万円超は基礎控除なし", () => {
    expect(basicForm(fam(30_000_000)).basic.amount).toBe(0);
  });
});

describe("配偶者控除・配偶者特別控除（令和8年分）", () => {
  it("所得62万円以下・70歳未満は区分②、区分Aなら38万円", () => {
    const r = spouseDeduction(person({ relation: "配偶者", birth: "1980-05-01", salary: 1_360_000 }), "A");
    expect(r).toMatchObject({ kubun2: "②", kind: "配偶者控除", amount: 380_000 });
  });
  it("70歳以上（昭32.1.1以前生）は区分①、区分Bなら32万円", () => {
    const r = spouseDeduction(person({ birth: "1957-01-01", salary: 0 }), "B");
    expect(r).toMatchObject({ kubun2: "①", amount: 320_000 });
  });
  it("所得62万円超95万円以下は区分③、配偶者特別控除38万円", () => {
    expect(spouseDeduction(person({ birth: "1980-05-01", salary: 1_500_000 }), "A")).toMatchObject({ kubun2: "③", kind: "配偶者特別控除", amount: 380_000 });
  });
  it("区分④は所得に応じて減る（所得101万円・区分C → 11万円）", () => {
    expect(spouseDeduction(person({ birth: "1980-05-01", salary: 1_750_000 }), "C")).toMatchObject({ kubun2: "④", amount: 110_000 });
  });
  it("所得133万円超は対象外", () => {
    expect(spouseDeduction(person({ birth: "1980-05-01", salary: 2_080_000 }), "A").amount).toBe(0);
  });
});

describe("特定親族特別控除（令和8年分）", () => {
  it.each([
    [620_000, 0],
    [620_001, 630_000],
    [900_000, 610_000],
    [1_000_000, 410_000],
    [1_230_000, 30_000],
    [1_230_001, 0],
  ])("所得 %i 円 → %i 円", (income, amount) => expect(specificRelativeAmount(income)).toBe(amount));

  it("20歳の子・給与170万円（所得96万円）は特定親族で41万円", () => {
    const f: Family = { self: { ...emptySelf(), salary: 5_000_000 }, spouse: null, dependents: [person({ birth: "2006-04-01", salary: 1_700_000 })] };
    const r = basicForm(f);
    expect(r.specific).toHaveLength(1);
    expect(r.specific[0].amount).toBe(410_000);
  });
});

describe("扶養控除等申告書（令和9年分）", () => {
  const f: Family = {
    self: { ...emptySelf(), salary: 6_000_000 },
    spouse: person({ relation: "妻", birth: "1985-03-03", salary: 1_000_000 }),
    dependents: [
      person({ label: "長男", birth: "2007-06-01", salary: 0 }), // 20歳 → 特定扶養親族
      person({ label: "次男", birth: "2015-06-01" }), // 12歳 → 16歳未満
      person({ label: "長女", birth: "2006-06-01", salary: 1_700_000 }), // 21歳・所得96万 → 特定親族（100万以下なので源泉控除対象親族）
      person({ label: "父", relation: "父", birth: "1950-02-02", livingTogether: true }), // 77歳・同居 → 同居老親等
    ],
  };
  const r = dependentsForm(f);
  it("配偶者（所得26万円）はＡ欄", () => expect(r.spouseA?.show).toBe(true));
  it("Ｂ欄に長男・長女・父、住民税欄に次男", () => {
    expect(r.withholding.map((s) => s.person.label)).toEqual(["長男", "長女", "父"]);
    expect(r.under16.map((s) => s.person.label)).toEqual(["次男"]);
  });
  it("長男は特定扶養親族、長女は特定親族、父は同居老親等", () => {
    const [son, , daughter, father] = f.dependents.map((p) => classify(p, 2027));
    expect(son.isSpecialDependent).toBe(true);
    expect(daughter.isSpecificRelative).toBe(true);
    expect(daughter.isSpecialDependent).toBe(false);
    expect(father.isCoResidentParent).toBe(true);
  });
  it("23歳未満の扶養親族がいれば、保険料控除の特例が自動でオンになる", () => {
    expect(hasUnder23Dependent(f)).toBe(true);
    expect(hasUnder23Dependent({ ...f, dependents: [f.dependents[3]] })).toBe(false);
  });
});

describe("所得金額調整控除", () => {
  it("給与900万円で23歳未満の扶養親族がいれば5万円、合計所得から差し引く", () => {
    const f: Family = { self: { ...emptySelf(), salary: 9_000_000 }, spouse: null, dependents: [person({ birth: "2015-01-10" })] };
    const r = basicForm(f);
    expect(r.adjustment.applies).toBe(true);
    expect(r.adjustment.amount).toBe(50_000);
    expect(r.basic.total).toBe(9_000_000 - 1_950_000 - 50_000);
  });
});

describe("寡婦・ひとり親", () => {
  it("本人の所得が500万円を超えると対象外と表示する", () => {
    const f = (salary: number): Family => ({ self: { ...emptySelf(), salary, widow: "ひとり親" }, spouse: null, dependents: [] });
    expect(dependentsForm(f(6_000_000)).c).toEqual(["ひとり親"]); // 所得436万円
    expect(dependentsForm(f(8_000_000)).c[0]).toContain("対象外"); // 所得620万円
  });
});

describe("レビューで見つかった点", () => {
  it("勤労学生は、給与以外の所得が10万円を超えると対象外", () => {
    const f = (other: number): Family => ({ self: { ...emptySelf(), salary: 1_000_000, otherIncome: other, workingStudent: true }, spouse: null, dependents: [] });
    expect(dependentsForm(f(50_000)).c).toEqual(["勤労学生"]);
    expect(dependentsForm(f(150_000)).c[0]).toContain("対象外");
  });
  it("生年月日を和暦にする", () => {
    expect(toWareki("2006-03-03")).toBe("平成18年3月3日");
    expect(toWareki("2019-05-01")).toBe("令和元年5月1日");
    expect(toWareki("1985-05-05")).toBe("昭和60年5月5日");
  });
  it("☆欄に書く23歳未満の扶養親族を1人選ぶ", () => {
    const f: Family = { self: emptySelf(), spouse: null, dependents: [{ ...newPerson(), label: "長女", birth: "1990-01-01" }, { ...newPerson(), label: "次女", birth: "2010-07-07" }] };
    expect(under23DependentFor(f)?.person.label).toBe("次女");
  });
});
